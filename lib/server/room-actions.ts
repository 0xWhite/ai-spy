import { startGame } from "@/lib/game/engine";
import type { RoomState } from "@/lib/game/types";
import {
  roomStore,
  RoomStoreError,
  type CreateRoomInput,
} from "@/lib/server/room-store";

export function createRoomAction(input: CreateRoomInput) {
  return roomStore.createRoom(input);
}

export function joinRoomAction(code: string) {
  return roomStore.joinRoom(code);
}

export function startRoomAction(code: string, now = Date.now()) {
  const room = roomStore.getRoom(code);
  if (!room) {
    throw new RoomStoreError("ROOM_NOT_FOUND");
  }

  const startedRoom = startGame(room as RoomState, now);

  return roomStore.saveRoom({
    ...startedRoom,
    code: room.code,
  });
}
