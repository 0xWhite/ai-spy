import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { RoomClient } from "@/components/room-client";
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
  const selfSeatId = cookieStore.get(`room-${code}-seat`)?.value ?? null;

  return <RoomClient initialRoom={toClientRoomSnapshot(room)} selfSeatId={selfSeatId} />;
}
