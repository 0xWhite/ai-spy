import { cookies } from "next/headers";
import { toClientRoomSnapshot } from "@/lib/room-snapshot";
import { getValidatedBoundSeatId } from "@/lib/server/room-seat-binding";
import { roomStore } from "@/lib/server/room-store";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{
    code: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteParams,
) {
  const { code } = await context.params;
  const room = await roomStore.getRoom(code);

  if (!room) {
    return Response.json({ error: "ROOM_NOT_FOUND" }, { status: 404 });
  }

  return Response.json(
    toClientRoomSnapshot(room, getValidatedBoundSeatId(await cookies(), room)),
  );
}
