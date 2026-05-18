import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { RoomClient } from "@/components/room-client";
import { toClientRoomSnapshot } from "@/lib/room-snapshot";
import { getValidatedBoundSeatId } from "@/lib/server/room-seat-binding";
import { roomStore } from "@/lib/server/room-store";

export const dynamic = "force-dynamic";

type RoomPageProps = {
  params: Promise<{
    code: string;
  }>;
};

export default async function RoomPage({ params }: RoomPageProps) {
  const { code } = await params;
  const room = await roomStore.getRoom(code);

  if (!room) {
    notFound();
  }

  const cookieStore = await cookies();
  const selfSeatId = getValidatedBoundSeatId(cookieStore, room);
  if (room.phase === "closed") {
    redirect("/?error=room-closed");
  }
  if (!selfSeatId) {
    redirect(`/?code=${room.code}&error=seat-required`);
  }

  return <RoomClient initialRoom={toClientRoomSnapshot(room, selfSeatId)} selfSeatId={selfSeatId} />;
}
