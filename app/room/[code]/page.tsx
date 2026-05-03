import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { RoomClient } from "@/components/room-client";
import { roomStore } from "@/lib/server/room-store";

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
  const selfSeatId = cookieStore.get(`room-${room.code}-seat`)?.value ?? "seat-1";

  return <RoomClient initialRoom={room} selfSeatId={selfSeatId} />;
}
