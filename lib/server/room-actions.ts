import { appendPlayerMessage, castVote, startGame } from "@/lib/game/engine";
import type { RoomState } from "@/lib/game/types";
import {
  roomStore,
  RoomStoreError,
  type RoomStore,
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
      | "SEAT_ALREADY_VOTED"
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
      error.message === "SEAT_ALREADY_VOTED" ||
      error.message === "INVALID_VOTE_TARGET")
  ) {
    throw new RoomActionError(error.message);
  }

  throw error;
}

export function createRoomAction(input: CreateRoomInput) {
  return roomStore.createRoom(input);
}

export async function joinRoomAction(
  code: string,
  preferredSeatId: string | null = null,
  store: RoomStore = roomStore,
) {
  const room = await store.getRoom(code);
  if (!room) {
    throw new RoomStoreError("ROOM_NOT_FOUND");
  }

  const preferredSeat = preferredSeatId
    ? room.seats.find(
        (seat) => seat.id === preferredSeatId && seat.role === "human",
      )
    : undefined;

  if (preferredSeat) {
    if (preferredSeat.connected) {
      return {
        room,
        seatId: preferredSeat.id,
      };
    }

    return {
      room: await store.saveRoom({
        ...room,
        seats: room.seats.map((seat) =>
          seat.id === preferredSeat.id ? { ...seat, connected: true } : seat,
        ),
      }),
      seatId: preferredSeat.id,
    };
  }

  const joinedRoom = await store.joinRoom(code);
  const seatId = room.seats.find(
    (seat) => seat.role === "human" && !seat.connected,
  )?.id;

  if (!seatId) {
    throw new RoomStoreError("ROOM_FULL");
  }

  return {
    room: joinedRoom,
    seatId,
  };
}

export async function startRoomAction(
  code: string,
  now = Date.now(),
  store: RoomStore = roomStore,
) {
  const room = await store.getRoom(code);
  if (!room) {
    throw new RoomStoreError("ROOM_NOT_FOUND");
  }
  if (room.phase === "closed") {
    throw new RoomStoreError("ROOM_CLOSED");
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

export async function postRoomMessageAction(
  code: string,
  input: {
    seatId: string;
    text: string;
  },
  now = Date.now(),
  store: RoomStore = roomStore,
) {
  const room = await store.getRoom(code);
  if (!room) {
    throw new RoomStoreError("ROOM_NOT_FOUND");
  }
  if (room.phase === "closed") {
    throw new RoomStoreError("ROOM_CLOSED");
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

export async function castRoomVoteAction(
  code: string,
  input: {
    voterSeatId: string;
    targetSeatId: string;
  },
  store: RoomStore = roomStore,
) {
  const room = await store.getRoom(code);
  if (!room) {
    throw new RoomStoreError("ROOM_NOT_FOUND");
  }
  if (room.phase === "closed") {
    throw new RoomStoreError("ROOM_CLOSED");
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

export function closeRoomAction(
  code: string,
  store: RoomStore = roomStore,
) {
  return store.closeRoom(code);
}

export function restartRoomAction(
  code: string,
  store: RoomStore = roomStore,
) {
  return store.restartRoom(code);
}

export async function leaveRoomAction(
  code: string,
  seatId: string,
  store: RoomStore = roomStore,
) {
  const room = await store.getRoom(code);
  if (!room) {
    throw new RoomStoreError("ROOM_NOT_FOUND");
  }
  if (room.phase === "closed") {
    throw new RoomStoreError("ROOM_CLOSED");
  }

  return store.leaveRoom(code, seatId);
}
