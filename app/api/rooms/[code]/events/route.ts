import { cookies } from "next/headers";
import {
  toClientRoomSnapshot,
  type ClientRoomSnapshot,
} from "@/lib/room-snapshot";
import { getValidatedBoundSeatId } from "@/lib/server/room-seat-binding";
import { roomStore } from "@/lib/server/room-store";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{
    code: string;
  }>;
};

function toSsePayload(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

const EVENT_POLL_INTERVAL_MS = 500;

export async function GET(
  request: Request,
  context: RouteParams,
) {
  const { code } = await context.params;
  const room = await roomStore.getRoom(code);

  if (!room) {
    return Response.json({ error: "ROOM_NOT_FOUND" }, { status: 404 });
  }

  const seatId = getValidatedBoundSeatId(await cookies(), room);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let isClosed = false;
      let lastPayload = "";
      let isPolling = false;

      const sendSnapshot = (snapshot: ClientRoomSnapshot) => {
        const payload = JSON.stringify(snapshot);
        if (payload === lastPayload || isClosed) {
          return;
        }

        lastPayload = payload;
        controller.enqueue(encoder.encode(toSsePayload(snapshot)));
      };

      const pollLatestRoom = async () => {
        if (isPolling || isClosed) {
          return;
        }

        isPolling = true;

        try {
          const latestRoom = await roomStore.getRoom(code);
          if (!latestRoom) {
            return;
          }

          sendSnapshot(toClientRoomSnapshot(latestRoom, seatId));
        } finally {
          isPolling = false;
        }
      };

      void pollLatestRoom();
      const interval = setInterval(() => {
        void pollLatestRoom();
      }, EVENT_POLL_INTERVAL_MS);

      const handleAbort = () => {
        isClosed = true;
        clearInterval(interval);

        try {
          controller.close();
        } catch {
          // No-op. The stream may already be closed by the runtime.
        }
      };

      request.signal.addEventListener("abort", handleAbort, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}
