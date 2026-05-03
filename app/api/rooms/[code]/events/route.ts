import { roomStore, toClientRoomSnapshot, type RoomSnapshot } from "@/lib/server/room-store";

export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{
    code: string;
  }>;
};

function toSsePayload(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  request: Request,
  context: RouteParams,
) {
  const { code } = await context.params;
  const room = roomStore.getRoom(code);

  if (!room) {
    return Response.json({ error: "ROOM_NOT_FOUND" }, { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const sendSnapshot = (snapshot: RoomSnapshot) => {
        controller.enqueue(encoder.encode(toSsePayload(snapshot)));
      };

      const unsubscribe = roomStore.subscribe(code, (snapshot) => {
        sendSnapshot(toClientRoomSnapshot(snapshot));
      });
      const latestRoom = roomStore.getRoom(code) ?? room;
      sendSnapshot(toClientRoomSnapshot(latestRoom));
      const handleAbort = () => {
        unsubscribe();

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
