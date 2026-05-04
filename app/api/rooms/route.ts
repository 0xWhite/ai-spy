import { cookies } from "next/headers";
import { createRoomAction } from "@/lib/server/room-actions";
import { bindSeatCookie } from "@/lib/server/room-seat-cookie";
import { toClientRoomSnapshot, type CreateRoomInput } from "@/lib/server/room-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const input = (await request.json()) as CreateRoomInput;
  const room = createRoomAction(input);
  const cookieStore = await cookies();

  bindSeatCookie(cookieStore, room.code, room.hostSeatId);

  return Response.json(toClientRoomSnapshot(room, room.hostSeatId), { status: 201 });
}
