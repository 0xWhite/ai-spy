import { advancePhaseFromTimeout, buildInitialRoomState } from "@/lib/game/engine";
import type {
  BuildInitialRoomStateInput,
  RoomResult,
  RoomState,
  SeatState,
} from "@/lib/game/types";
import { aiRuntime } from "@/lib/server/ai/runtime";
import { RoomBroadcast } from "@/lib/server/room-broadcast";

const ROOM_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ROOM_CODE_LENGTH = 6;
const HOST_SEAT_ID = "seat-1";

export type RoomSnapshotPhase = "waiting" | RoomState["phase"];

export interface RoomSnapshot extends Omit<RoomState, "phase"> {
  code: string;
  phase: RoomSnapshotPhase;
}

export type HiddenClientSeatState = Omit<SeatState, "role">;
export type RevealedClientSeatState = SeatState;
export type ClientSeatState = HiddenClientSeatState | RevealedClientSeatState;

export interface ClientRoomSnapshot extends Omit<RoomSnapshot, "seats"> {
  seats: ClientSeatState[];
}

export interface RevealedClientRoomSnapshot extends ClientRoomSnapshot {
  phase: "finished";
  result: RoomResult;
  seats: RevealedClientSeatState[];
}

export type CreateRoomInput = Omit<BuildInitialRoomStateInput, "hostSeatId">;

export class RoomStoreError extends Error {
  constructor(
    public readonly code:
      | "ROOM_NOT_FOUND"
      | "ROOM_FULL"
      | "ROOM_NOT_WAITING",
  ) {
    super(code);
    this.name = "RoomStoreError";
  }
}

function cloneRoomSnapshot(room: RoomSnapshot) {
  return structuredClone(room);
}

export function toClientRoomSnapshot(room: RoomSnapshot): ClientRoomSnapshot {
  const revealRoles = room.phase === "finished" && room.result !== null;

  return {
    ...cloneRoomSnapshot(room),
    seats: room.seats.map((seat) => {
      if (revealRoles) {
        return { ...seat };
      }

      return {
        id: seat.id,
        status: seat.status,
        color: seat.color,
        connected: seat.connected,
        isHost: seat.isHost,
      };
    }),
  };
}

export function hasRevealedClientRoles(
  room: ClientRoomSnapshot,
): room is RevealedClientRoomSnapshot {
  return (
    room.phase === "finished" &&
    room.result !== null &&
    room.seats.every((seat) => "role" in seat)
  );
}

function ensureHostSeatIsHuman(room: RoomState) {
  const hostSeat = room.seats.find((seat) => seat.id === room.hostSeatId);
  if (!hostSeat || hostSeat.role === "human") {
    return room;
  }

  const firstHumanSeat = room.seats.find((seat) => seat.role === "human");
  if (!firstHumanSeat) {
    return room;
  }

  return {
    ...room,
    seats: room.seats.map((seat) => {
      if (seat.id === hostSeat.id) {
        return {
          ...seat,
          role: "human" as const,
        };
      }

      if (seat.id === firstHumanSeat.id) {
        return {
          ...seat,
          role: "ai" as const,
        };
      }

      return seat;
    }),
  };
}

function normalizeRoomCode(code: string) {
  return code.trim().toUpperCase();
}

function generateRoomCode(existingCodes: Set<string>) {
  while (true) {
    const code = Array.from({ length: ROOM_CODE_LENGTH }, () => {
      const index = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
      return ROOM_CODE_ALPHABET[index];
    }).join("");

    if (!existingCodes.has(code)) {
      return code;
    }
  }
}

export class InMemoryRoomStore {
  private rooms = new Map<string, RoomSnapshot>();
  private roomTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private pendingAiRooms = new Set<string>();

  constructor(
    private readonly broadcast = new RoomBroadcast<RoomSnapshot>(),
  ) {}

  private clearRoomTimer(code: string) {
    const timer = this.roomTimers.get(code);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.roomTimers.delete(code);
  }

  private scheduleRoomTimer(room: RoomSnapshot) {
    this.clearRoomTimer(room.code);

    if (room.phase === "waiting" || room.phaseEndsAt === null) {
      return;
    }

    const delay = Math.max(room.phaseEndsAt - Date.now(), 0);
    const expectedPhaseEndsAt = room.phaseEndsAt;

    const timer = setTimeout(() => {
      const currentRoom = this.rooms.get(room.code);
      if (
        !currentRoom ||
        currentRoom.phase === "waiting" ||
        currentRoom.phaseEndsAt !== expectedPhaseEndsAt
      ) {
        return;
      }

      const advancedRoom = advancePhaseFromTimeout(
        currentRoom as RoomState,
        Date.now(),
      );

      this.saveRoom(
        {
          ...advancedRoom,
          code: currentRoom.code,
        },
        { source: "timer" },
      );
    }, delay);

    this.roomTimers.set(room.code, timer);
  }

  createRoom(input: CreateRoomInput) {
    const code = generateRoomCode(new Set(this.rooms.keys()));
    const room = ensureHostSeatIsHuman(
      buildInitialRoomState({
        ...input,
        hostSeatId: HOST_SEAT_ID,
      }),
    );
    const snapshot: RoomSnapshot = {
      code,
      ...room,
      phase: "waiting",
    };

    this.rooms.set(code, cloneRoomSnapshot(snapshot));

    return cloneRoomSnapshot(snapshot);
  }

  getRoom(code: string) {
    const room = this.rooms.get(normalizeRoomCode(code));
    return room ? cloneRoomSnapshot(room) : undefined;
  }

  private shouldRunAi(room: RoomSnapshot) {
    return (
      room.phase === "discussion" ||
      room.phase === "tiebreak_discussion" ||
      room.phase === "voting" ||
      room.phase === "tiebreak_voting"
    );
  }

  private scheduleAiTurn(code: string) {
    if (this.pendingAiRooms.has(code)) {
      return;
    }

    this.pendingAiRooms.add(code);

    queueMicrotask(async () => {
      try {
        const currentRoom = this.rooms.get(code);
        if (!currentRoom || !this.shouldRunAi(currentRoom)) {
          return;
        }

        const aiRoom = await aiRuntime.run(currentRoom as RoomSnapshot & RoomState);
        if (aiRoom !== currentRoom) {
          this.saveRoom(aiRoom, { source: "ai" });
        }
      } finally {
        this.pendingAiRooms.delete(code);
      }
    });
  }

  saveRoom(room: RoomSnapshot, options?: { source?: "ai" | "timer" | "user" }) {
    const code = normalizeRoomCode(room.code);
    const snapshot: RoomSnapshot = {
      ...room,
      code,
    };
    const storedSnapshot = cloneRoomSnapshot(snapshot);

    this.rooms.set(code, storedSnapshot);
    this.scheduleRoomTimer(storedSnapshot);
    this.broadcast.emit(code, cloneRoomSnapshot(storedSnapshot));
    if (options?.source !== "ai" && this.shouldRunAi(storedSnapshot)) {
      this.scheduleAiTurn(code);
    }

    return cloneRoomSnapshot(storedSnapshot);
  }

  joinRoom(code: string) {
    const room = this.getRoom(code);
    if (!room) {
      throw new RoomStoreError("ROOM_NOT_FOUND");
    }

    const seatToConnect = room.seats.find((seat) => !seat.connected);
    if (!seatToConnect) {
      throw new RoomStoreError("ROOM_FULL");
    }

    return this.saveRoom({
      ...room,
      seats: room.seats.map((seat) =>
        seat.id === seatToConnect.id ? { ...seat, connected: true } : seat,
      ),
    });
  }

  subscribe(code: string, listener: (room: RoomSnapshot) => void) {
    return this.broadcast.subscribe(normalizeRoomCode(code), (room) => {
      listener(cloneRoomSnapshot(room));
    });
  }
}

export const roomStore = new InMemoryRoomStore();
