import { joinRoomAction } from "@/lib/server/room-actions";
import { RoomStoreError, toClientRoomSnapshot } from "@/lib/server/room-store";

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

    return Response.json(toClientRoomSnapshot(joinRoomAction(code)));
  } catch (error) {
    if (error instanceof RoomStoreError) {
      const status = error.code === "ROOM_NOT_FOUND" ? 404 : 409;
      return Response.json({ error: error.code }, { status });
    }

    throw error;
  }
}
