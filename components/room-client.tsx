"use client";

import { useEffect, useMemo, useState } from "react";
import { RoomShell } from "@/components/room-shell";
import type { RoomSnapshot } from "@/lib/server/room-store";

type RoomClientProps = {
  initialRoom: RoomSnapshot;
  selfSeatId: string;
};

export function RoomClient({ initialRoom, selfSeatId }: RoomClientProps) {
  const [room, setRoom] = useState(initialRoom);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource(`/api/rooms/${initialRoom.code}/events`);

    eventSource.onmessage = (event) => {
      try {
        setRoom(JSON.parse(event.data) as RoomSnapshot);
      } catch {
        // Ignore malformed snapshots and keep the last known room state.
      }
    };

    return () => {
      eventSource.close();
    };
  }, [initialRoom.code]);

  const roomCode = room.code;

  async function postJson(path: string, body?: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`REQUEST_FAILED_${response.status}`);
    }

    return (await response.json()) as RoomSnapshot;
  }

  const actions = useMemo(
    () => ({
      async start() {
        setIsStarting(true);

        try {
          const nextRoom = await postJson(`/api/rooms/${roomCode}/start`);
          setRoom(nextRoom);
        } finally {
          setIsStarting(false);
        }
      },
      async sendMessage(text: string) {
        const nextRoom = await postJson(`/api/rooms/${roomCode}/message`, {
          seatId: selfSeatId,
          text,
        });
        setRoom(nextRoom);
      },
      async vote(targetSeatId: string) {
        const nextRoom = await postJson(`/api/rooms/${roomCode}/vote`, {
          voterSeatId: selfSeatId,
          targetSeatId,
        });
        setRoom(nextRoom);
      },
    }),
    [roomCode, selfSeatId],
  );

  return (
    <RoomShell
      isStarting={isStarting}
      onSendMessage={actions.sendMessage}
      onStart={actions.start}
      onVote={actions.vote}
      room={room}
      selfSeatId={selfSeatId}
    />
  );
}
