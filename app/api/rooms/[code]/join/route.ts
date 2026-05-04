import { cookies } from "next/headers";
import { joinRoomAction } from "@/lib/server/room-actions";
import { getValidatedBoundSeatId } from "@/lib/server/room-seat-binding";
import { bindSeatCookie } from "@/lib/server/room-seat-cookie";
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
    const cookieStore = await cookies();
    const existingRoom = roomStore.getRoom(code);
    const boundSeatId = existingRoom
      ? getValidatedBoundSeatId(cookieStore, existingRoom)
      : null;
    const { room, seatId } = joinRoomAction(code, boundSeatId);

    bindSeatCookie(cookieStore, room.code, seatId);

    return Response.json(toClientRoomSnapshot(room, seatId));
  } catch (error) {
    if (error instanceof RoomStoreError) {
      const status = error.code === "ROOM_NOT_FOUND" ? 404 : 409;
      return Response.json({ error: error.code }, { status });
    }

    throw error;
  }
}
