import { appendPlayerMessage, castVote, startGame } from "@/lib/game/engine";
import type { RoomState } from "@/lib/game/types";
import {
  roomStore,
  RoomStoreError,
  type InMemoryRoomStore,
  type CreateRoomInput,
} from "@/lib/server/room-store";

export class RoomActionError extends Error {
  constructor(
    public readonly code:
      | "SEAT_CANNOT_SPEAK"
      | "SEAT_CANNOT_VOTE"
      | "PHASE_DOES_NOT_ALLOW_MESSAGES"
      | "PHASE_DOES_NOT_ALLOW_VOTES"
      | "CANNOT_VOTE_SELF"
      | "INVALID_VOTE_TARGET",
  ) {
    super(code);
    this.name = "RoomActionError";
  }
}

function toActionError(error: unknown): never {
  if (
    error instanceof Error &&
    (error.message === "SEAT_CANNOT_SPEAK" ||
      error.message === "SEAT_CANNOT_VOTE" ||
      error.message === "PHASE_DOES_NOT_ALLOW_MESSAGES" ||
      error.message === "PHASE_DOES_NOT_ALLOW_VOTES" ||
      error.message === "CANNOT_VOTE_SELF" ||
      error.message === "INVALID_VOTE_TARGET")
  ) {
    throw new RoomActionError(error.message);
  }

  throw error;
}

export function createRoomAction(input: CreateRoomInput) {
  return roomStore.createRoom(input);
}

export function joinRoomAction(code: string) {
  return roomStore.joinRoom(code);
}

export function startRoomAction(
  code: string,
  now = Date.now(),
  store: InMemoryRoomStore = roomStore,
) {
  const room = store.getRoom(code);
  if (!room) {
    throw new RoomStoreError("ROOM_NOT_FOUND");
  }
  if (room.phase !== "waiting") {
    throw new RoomStoreError("ROOM_NOT_WAITING");
  }

  const startedRoom = startGame(room as RoomState, now);

  return store.saveRoom({
    ...startedRoom,
    code: room.code,
  });
}

export function postRoomMessageAction(
  code: string,
  input: {
    seatId: string;
    text: string;
  },
  now = Date.now(),
  store: InMemoryRoomStore = roomStore,
) {
  const room = store.getRoom(code);
  if (!room) {
    throw new RoomStoreError("ROOM_NOT_FOUND");
  }

  try {
    const updatedRoom = appendPlayerMessage(room as RoomState, {
      ...input,
      now,
    });

    return store.saveRoom({
      ...updatedRoom,
      code: room.code,
    });
  } catch (error) {
    toActionError(error);
  }
}

export function castRoomVoteAction(
  code: string,
  input: {
    voterSeatId: string;
    targetSeatId: string;
  },
  store: InMemoryRoomStore = roomStore,
) {
  const room = store.getRoom(code);
  if (!room) {
    throw new RoomStoreError("ROOM_NOT_FOUND");
  }

  try {
    const updatedRoom = castVote(room as RoomState, input);

    return store.saveRoom({
      ...updatedRoom,
      code: room.code,
    });
  } catch (error) {
    toActionError(error);
  }
}
