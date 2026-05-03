import { postRoomMessageAction, RoomActionError } from "@/lib/server/room-actions";
import { RoomStoreError, toClientRoomSnapshot } from "@/lib/server/room-store";

export const dynamic = "force-dynamic";

class InvalidRequestBodyError extends Error {
  constructor() {
    super("INVALID_REQUEST_BODY");
    this.name = "InvalidRequestBodyError";
  }
}

type RouteParams = {
  params: Promise<{
    code: string;
  }>;
};

async function readMessageBody(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new InvalidRequestBodyError();
  }

  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as { seatId?: unknown }).seatId !== "string" ||
    typeof (body as { text?: unknown }).text !== "string"
  ) {
    throw new InvalidRequestBodyError();
  }

  return body as {
    seatId: string;
    text: string;
  };
}

export async function POST(
  request: Request,
  context: RouteParams,
) {
  try {
    const { code } = await context.params;
    const body = await readMessageBody(request);

    return Response.json(
      toClientRoomSnapshot(
        postRoomMessageAction(code, {
          seatId: body.seatId,
          text: body.text,
        }),
      ),
    );
  } catch (error) {
    if (error instanceof InvalidRequestBodyError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof RoomStoreError) {
      return Response.json({ error: error.code }, { status: 404 });
    }

    if (error instanceof RoomActionError) {
      return Response.json({ error: error.code }, { status: 400 });
    }

    throw error;
  }
}
