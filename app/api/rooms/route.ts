import { createRoomAction } from "@/lib/server/room-actions";
import { toClientRoomSnapshot, type CreateRoomInput } from "@/lib/server/room-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const input = (await request.json()) as CreateRoomInput;
  const room = createRoomAction(input);

  return Response.json(toClientRoomSnapshot(room), { status: 201 });
}
