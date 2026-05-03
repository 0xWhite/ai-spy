import { postRoomMessageAction, RoomActionError } from "@/lib/server/room-actions";
import { RoomStoreError } from "@/lib/server/room-store";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{
    code: string;
  }>;
};

export async function POST(
  request: Request,
  context: RouteParams,
) {
  try {
    const { code } = await context.params;
    const body = (await request.json()) as {
      seatId: string;
      text: string;
    };

    return Response.json(
      postRoomMessageAction(code, {
        seatId: body.seatId,
        text: body.text,
      }),
    );
  } catch (error) {
    if (error instanceof RoomStoreError) {
      return Response.json({ error: error.code }, { status: 404 });
    }

    if (error instanceof RoomActionError) {
      return Response.json({ error: error.code }, { status: 400 });
    }

    throw error;
  }
}
