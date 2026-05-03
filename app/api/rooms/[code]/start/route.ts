import { startRoomAction } from "@/lib/server/room-actions";
import { RoomStoreError } from "@/lib/server/room-store";

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

    return Response.json(startRoomAction(code));
  } catch (error) {
    if (error instanceof RoomStoreError) {
      return Response.json({ error: error.code }, { status: 404 });
    }

    throw error;
  }
}
