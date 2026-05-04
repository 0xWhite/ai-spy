import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { RoomClient } from "@/components/room-client";
import { getValidatedBoundSeatId } from "@/lib/server/room-seat-binding";
import { roomStore, toClientRoomSnapshot } from "@/lib/server/room-store";

export const dynamic = "force-dynamic";

type RoomPageProps = {
  params: Promise<{
    code: string;
  }>;
};

export default async function RoomPage({ params }: RoomPageProps) {
  const { code } = await params;
  const room = roomStore.getRoom(code);

  if (!room) {
    notFound();
  }

  const cookieStore = await cookies();
  const selfSeatId = getValidatedBoundSeatId(cookieStore, room);

  return <RoomClient initialRoom={toClientRoomSnapshot(room, selfSeatId)} selfSeatId={selfSeatId} />;
}
