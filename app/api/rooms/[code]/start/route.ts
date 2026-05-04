import { cookies } from "next/headers";
import { startRoomAction } from "@/lib/server/room-actions";
import { getValidatedBoundSeatId } from "@/lib/server/room-seat-binding";
import { roomStore, RoomStoreError, toClientRoomSnapshot } from "@/lib/server/room-store";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{
    code: string;
  }>;
};

export async function POST(
  _request: Request,
  context: RouteParams,
) {
  try {
    const { code } = await context.params;
    const room = roomStore.getRoom(code);
    if (!room) {
      throw new RoomStoreError("ROOM_NOT_FOUND");
    }

    const seatId = getValidatedBoundSeatId(await cookies(), room);
    if (!seatId) {
      return Response.json({ error: "SEAT_NOT_BOUND" }, { status: 403 });
    }
    if (seatId !== room.hostSeatId) {
      return Response.json({ error: "SEAT_NOT_HOST" }, { status: 403 });
    }

    const nextRoom = startRoomAction(code);

    return Response.json(toClientRoomSnapshot(nextRoom, seatId));
  } catch (error) {
    if (error instanceof RoomStoreError) {
      const status = error.code === "ROOM_NOT_FOUND" ? 404 : 409;
      return Response.json({ error: error.code }, { status });
    }

    throw error;
  }
}
