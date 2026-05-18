"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RoomShell } from "@/components/room-shell";
import type { ClientRoomSnapshot } from "@/lib/room-snapshot";

class RequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | null,
  ) {
    super(code ? `REQUEST_FAILED_${status}_${code}` : `REQUEST_FAILED_${status}`);
    this.name = "RequestError";
  }
}

type RoomClientProps = {
  initialRoom: ClientRoomSnapshot;
  selfSeatId: string | null;
};

type ConfirmState =
  | {
      type: "close" | "leave";
      title: string;
      description: string;
      confirmLabel: string;
    }
  | null;

export function RoomClient({ initialRoom, selfSeatId }: RoomClientProps) {
  const [room, setRoom] = useState(initialRoom);
  const [isStarting, setIsStarting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const router = useRouter();

  useEffect(() => {
    if (room.phase === "closed") {
      router.replace("/?error=room-closed");
    }
  }, [room.phase, router]);

  useEffect(() => {
    const eventSource = new EventSource(`/api/rooms/${initialRoom.code}/events`);

    eventSource.onmessage = (event) => {
      try {
        setRoom(JSON.parse(event.data) as ClientRoomSnapshot);
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
      let code: string | null = null;

      try {
        const payload = (await response.json()) as { error?: string };
        code = payload.error ?? null;
      } catch {
        code = null;
      }

      throw new RequestError(response.status, code);
    }

    return (await response.json()) as ClientRoomSnapshot;
  }

  const actions = useMemo(
    () => {
      if (!selfSeatId) {
        return {
          close: undefined,
          leave: undefined,
          rematch: undefined,
          start: undefined,
          sendMessage: undefined,
          vote: undefined,
        };
      }

      return {
        close() {
          setConfirmState({
            type: "close",
            title: "确认解散房间",
            description: "确认解散房间吗？所有玩家都会被送回首页。",
            confirmLabel: "确认解散",
          });
        },
        leave() {
          setConfirmState({
            type: "leave",
            title: "确认退出房间",
            description: "确认退出房间吗？你会返回首页。",
            confirmLabel: "确认退出",
          });
        },
        async rematch() {
          setActionError(null);
          setIsRestarting(true);

          try {
            const nextRoom = await postJson(`/api/rooms/${roomCode}/rematch`);
            setRoom(nextRoom);
          } catch (error) {
            if (error instanceof RequestError && error.code === "SEAT_NOT_HOST") {
              setActionError("只有房主可以重开这一局。");
              return;
            }

            setActionError("重开失败，请稍后重试。");
          } finally {
            setIsRestarting(false);
          }
        },
        async start() {
          setActionError(null);
          setIsStarting(true);

          try {
            const nextRoom = await postJson(`/api/rooms/${roomCode}/start`);
            setRoom(nextRoom);
            router.refresh();
          } catch (error) {
            if (error instanceof RequestError) {
              if (error.code === "SEAT_NOT_BOUND") {
                router.replace(`/?code=${roomCode}&error=seat-required`);
                return;
              }

              if (error.code === "SEAT_NOT_HOST") {
                setActionError("只有房主可以开始游戏。");
                return;
              }

              if (error.code === "ROOM_NOT_WAITING") {
                setActionError("房间已经开始或状态已变化，请刷新后重试。");
                return;
              }
            }

            setActionError("开始游戏失败，请稍后重试。");
          } finally {
            setIsStarting(false);
          }
        },
        async sendMessage(text: string) {
          setActionError(null);
          const nextRoom = await postJson(`/api/rooms/${roomCode}/message`, { text });
          setRoom(nextRoom);
        },
        async vote(targetSeatId: string) {
          setActionError(null);
          const nextRoom = await postJson(`/api/rooms/${roomCode}/vote`, {
            targetSeatId,
          });
          setRoom(nextRoom);
        },
      };
    },
    [roomCode, router, selfSeatId],
  );

  async function handleConfirmAction() {
    if (!confirmState) {
      return;
    }

    if (confirmState.type === "close") {
      setActionError(null);
      setIsClosing(true);

      try {
        const nextRoom = await postJson(`/api/rooms/${roomCode}/close`);
        setRoom(nextRoom);
        setConfirmState(null);
      } finally {
        setIsClosing(false);
      }

      return;
    }

    setActionError(null);
    setIsLeaving(true);

    try {
      await postJson(`/api/rooms/${roomCode}/leave`);
      setConfirmState(null);
      router.replace("/");
    } finally {
      setIsLeaving(false);
    }
  }

  return (
    <>
      <RoomShell
        isClosing={isClosing}
        actionError={actionError}
        isLeaving={isLeaving}
        isRestarting={isRestarting}
        isStarting={isStarting}
        onClose={room.phase === "waiting" ? actions.close : undefined}
        onLeave={actions.leave}
        onRematch={actions.rematch}
        onReturnHome={() => router.replace("/")}
        onSendMessage={actions.sendMessage}
        onStart={actions.start}
        onVote={actions.vote}
        room={room}
        selfSeatId={selfSeatId}
      />
      <ConfirmDialog
        cancelLabel="取消"
        confirmLabel={confirmState?.confirmLabel ?? "确认"}
        confirmVariant={confirmState?.type === "close" ? "danger" : "neutral"}
        description={confirmState?.description ?? ""}
        isConfirming={confirmState?.type === "close" ? isClosing : isLeaving}
        onCancel={() => setConfirmState(null)}
        onConfirm={handleConfirmAction}
        open={confirmState !== null}
        title={confirmState?.title ?? ""}
      />
    </>
  );
}
