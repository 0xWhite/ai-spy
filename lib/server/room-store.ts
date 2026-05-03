import { advancePhaseFromTimeout, buildInitialRoomState } from "@/lib/game/engine";
import type { BuildInitialRoomStateInput, RoomState, SeatState } from "@/lib/game/types";
import { RoomBroadcast } from "@/lib/server/room-broadcast";

const ROOM_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ROOM_CODE_LENGTH = 6;
const HOST_SEAT_ID = "seat-1";

export type RoomSnapshotPhase = "waiting" | RoomState["phase"];

export interface RoomSnapshot extends Omit<RoomState, "phase"> {
  code: string;
  phase: RoomSnapshotPhase;
}

export type ClientSeatState = Omit<SeatState, "role"> & {
  role?: SeatState["role"];
};

export interface ClientRoomSnapshot extends Omit<RoomSnapshot, "seats"> {
  seats: ClientSeatState[];
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

      this.saveRoom({
        ...advancedRoom,
        code: currentRoom.code,
      });
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

  saveRoom(room: RoomSnapshot) {
    const code = normalizeRoomCode(room.code);
    const snapshot: RoomSnapshot = {
      ...room,
      code,
    };
    const storedSnapshot = cloneRoomSnapshot(snapshot);

    this.rooms.set(code, storedSnapshot);
    this.scheduleRoomTimer(storedSnapshot);
    this.broadcast.emit(code, cloneRoomSnapshot(storedSnapshot));

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
