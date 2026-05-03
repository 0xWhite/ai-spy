import { startGame } from "@/lib/game/engine";
import type { RoomState } from "@/lib/game/types";
import {
  roomStore,
  RoomStoreError,
  type InMemoryRoomStore,
  type CreateRoomInput,
} from "@/lib/server/room-store";

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
