import { buildInitialRoomState } from "@/lib/game/engine";
import type { BuildInitialRoomStateInput, RoomState } from "@/lib/game/types";
import { RoomBroadcast } from "@/lib/server/room-broadcast";

const ROOM_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ROOM_CODE_LENGTH = 6;
const HOST_SEAT_ID = "seat-1";

export type RoomSnapshotPhase = "waiting" | RoomState["phase"];

export interface RoomSnapshot extends Omit<RoomState, "phase"> {
  code: string;
  phase: RoomSnapshotPhase;
}

export type CreateRoomInput = Omit<BuildInitialRoomStateInput, "hostSeatId">;

export class RoomStoreError extends Error {
  constructor(public readonly code: "ROOM_NOT_FOUND" | "ROOM_FULL") {
    super(code);
    this.name = "RoomStoreError";
  }
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

  constructor(
    private readonly broadcast = new RoomBroadcast<RoomSnapshot>(),
  ) {}

  createRoom(input: CreateRoomInput) {
    const code = generateRoomCode(new Set(this.rooms.keys()));
    const room = buildInitialRoomState({
      ...input,
      hostSeatId: HOST_SEAT_ID,
    });
    const snapshot: RoomSnapshot = {
      code,
      ...room,
      phase: "waiting",
    };

    this.rooms.set(code, snapshot);

    return snapshot;
  }

  getRoom(code: string) {
    return this.rooms.get(normalizeRoomCode(code));
  }

  saveRoom(room: RoomSnapshot) {
    const code = normalizeRoomCode(room.code);
    const snapshot = {
      ...room,
      code,
    };

    this.rooms.set(code, snapshot);
    this.broadcast.emit(code, snapshot);

    return snapshot;
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
    return this.broadcast.subscribe(normalizeRoomCode(code), listener);
  }
}

export const roomStore = new InMemoryRoomStore();
