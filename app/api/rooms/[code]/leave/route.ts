import { cookies } from "next/headers";
import { toClientRoomSnapshot } from "@/lib/room-snapshot";
import { leaveRoomAction } from "@/lib/server/room-actions";
import { getValidatedBoundSeatId } from "@/lib/server/room-seat-binding";
import { clearSeatCookie } from "@/lib/server/room-seat-cookie";
import { roomStore, RoomStoreError } from "@/lib/server/room-store";

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
    const room = await roomStore.getRoom(code);
    if (!room) {
      throw new RoomStoreError("ROOM_NOT_FOUND");
    }

    const cookieStore = await cookies();
    const seatId = getValidatedBoundSeatId(cookieStore, room);
    if (!seatId) {
      return Response.json({ error: "SEAT_NOT_BOUND" }, { status: 403 });
    }
    if (seatId === room.hostSeatId && room.phase === "waiting") {
      return Response.json({ error: "SEAT_IS_HOST" }, { status: 403 });
    }

    const nextRoom = await leaveRoomAction(code, seatId);
    clearSeatCookie(cookieStore, code);

    return Response.json(toClientRoomSnapshot(nextRoom, null));
  } catch (error) {
    if (error instanceof RoomStoreError) {
      const status =
        error.code === "ROOM_NOT_FOUND"
          ? 404
          : error.code === "ROOM_CLOSED" || error.code === "ROOM_NOT_WAITING"
            ? 409
            : 400;
      return Response.json({ error: error.code }, { status });
    }

    throw error;
  }
}
