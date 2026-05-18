import { cookies } from "next/headers";
import { toClientRoomSnapshot } from "@/lib/room-snapshot";
import { postRoomMessageAction, RoomActionError } from "@/lib/server/room-actions";
import { getValidatedBoundSeatId } from "@/lib/server/room-seat-binding";
import { roomStore, RoomStoreError } from "@/lib/server/room-store";

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
    typeof (body as { text?: unknown }).text !== "string"
  ) {
    throw new InvalidRequestBodyError();
  }

  return body as {
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
    const room = await roomStore.getRoom(code);
    if (!room) {
      throw new RoomStoreError("ROOM_NOT_FOUND");
    }

    const seatId = getValidatedBoundSeatId(await cookies(), room);
    if (!seatId) {
      return Response.json({ error: "SEAT_NOT_BOUND" }, { status: 403 });
    }
    const nextRoom = await postRoomMessageAction(code, {
      seatId,
      text: body.text,
    });

    return Response.json(
      toClientRoomSnapshot(nextRoom, seatId),
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
