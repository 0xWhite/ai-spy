import {
  hasRevealedClientRoles,
  type ClientRoomSnapshot,
  type WaitingClientSeatState,
} from "@/lib/room-snapshot";
import { useLayoutEffect, useRef, useState } from "react";
import { ChatMessage } from "@/components/chat-message";
import { CountdownChip } from "@/components/countdown-chip";
import { MessageComposer } from "@/components/message-composer";
import { ResultsPanel } from "@/components/results-panel";
import { SeatBadge } from "@/components/seat-badge";
import { SystemMessage } from "@/components/system-message";
import { VotingPanel } from "@/components/voting-panel";
import { WaitingRoomPanel } from "@/components/waiting-room-panel";
import { formatMessageDay, formatPhaseLabel } from "@/lib/utils/format";

type RoomShellProps = {
  room: ClientRoomSnapshot;
  selfSeatId: string | null;
  onStart?: () => Promise<void> | void;
  onClose?: () => Promise<void> | void;
  onLeave?: () => Promise<void> | void;
  onRematch?: () => Promise<void> | void;
  onReturnHome?: () => Promise<void> | void;
  onSendMessage?: (text: string) => Promise<void> | void;
  onVote?: (targetSeatId: string) => Promise<void> | void;
  actionError?: string | null;
  isStarting?: boolean;
  isClosing?: boolean;
  isLeaving?: boolean;
  isRestarting?: boolean;
};

export function RoomShell({
  room,
  selfSeatId,
  onStart,
  onClose,
  onLeave,
  onRematch,
  onReturnHome,
  onSendMessage,
  onVote,
  actionError = null,
  isStarting = false,
  isClosing = false,
  isLeaving = false,
  isRestarting = false,
}: RoomShellProps) {
  const timelineListRef = useRef<HTMLUListElement | null>(null);
  const [initialTimelineAt] = useState(() => Date.now());
  const latestTimelineAt =
    room.messages.at(-1)?.createdAt ?? room.phaseEndsAt ?? initialTimelineAt;
  const timelineScrollKey = [
    room.phase,
    room.messages.length,
    room.messages.at(-1)?.id ?? "",
    room.phaseEndsAt ?? "",
  ].join("|");

  useLayoutEffect(() => {
    const list = timelineListRef.current;
    if (!list) {
      return;
    }

    const scrollToBottom = () => {
      list.scrollTop = list.scrollHeight;
    };

    scrollToBottom();
    const frameId = window.requestAnimationFrame(scrollToBottom);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [timelineScrollKey]);

  if (room.phase === "waiting") {
    return (
      <WaitingRoomPanel
        aiCount={room.config.aiCount}
        code={room.code}
        isClosing={isClosing}
        errorMessage={actionError}
        isLeaving={isLeaving}
        isStarting={isStarting}
        onClose={onClose}
        onLeave={onLeave}
        onStart={onStart}
        seats={room.seats as WaitingClientSeatState[]}
        selfSeatId={selfSeatId}
        totalSeats={room.config.totalSeats}
      />
    );
  }

  if (hasRevealedClientRoles(room)) {
    return (
      <ResultsPanel
        canRematch={selfSeatId === room.hostSeatId}
        eliminatedSeatIds={room.eliminatedSeatIds}
        isRestarting={isRestarting}
        onRematch={onRematch}
        onReturnHome={onReturnHome}
        result={room.result}
        seats={room.seats}
      />
    );
  }

  const aliveCount = room.seats.filter((seat) => seat.status === "alive").length;
  const selfSeat = room.seats.find((seat) => seat.id === selfSeatId);
  const isSelfAlive = selfSeat?.status === "alive";
  const aliveSeats = room.seats.filter((seat) => seat.status === "alive");
  const spectatorSeats = room.seats.filter((seat) => seat.status === "spectator");

  return (
    <main className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_35%),linear-gradient(180deg,_#0a111d_0%,_#0d1421_100%)] px-4 py-5 text-white lg:px-6 lg:py-7">
      <div className="mx-auto grid h-full w-full max-w-[1500px] gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="grid gap-4 self-start">
          <section className="grid gap-12 rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,_rgba(22,30,45,0.96),_rgba(13,19,31,0.98))] px-6 py-9 shadow-[0_24px_70px_rgba(2,6,23,0.45)]">
            <div className="grid justify-items-center gap-5 pt-3 text-center">
              <h1 className="text-[3.35rem] font-bold tracking-tight text-white lg:text-[3.55rem]">
                第 {room.round} 轮
              </h1>
              <span className="inline-flex w-fit rounded-full bg-blue-500 px-4 py-2 text-base font-semibold text-white shadow-[0_10px_24px_rgba(59,130,246,0.35)]">
                {formatPhaseLabel(room.phase)}
              </span>
            </div>

            <CountdownChip
              className="min-h-[160px] min-w-0 px-5 text-[4.3rem] font-bold tracking-[-0.03em] lg:text-[5.15rem]"
              phaseEndsAt={room.phaseEndsAt}
              variant="dark"
            />

            <div className="grid justify-items-center">
              <div className="w-full max-w-[165px] rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,_rgba(28,37,52,0.95),_rgba(20,28,41,0.98))] px-4 py-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="mb-3 text-base font-medium text-slate-400">在场人数</div>
                <div className="text-[1.45rem] font-semibold text-white">{aliveCount} 人在场</div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,_rgba(22,30,45,0.96),_rgba(13,19,31,0.98))] p-5 shadow-[0_24px_70px_rgba(2,6,23,0.42)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold text-white">当前席位</h2>
              {selfSeat?.status === "alive" ? (
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-green-400 shadow-[0_0_18px_rgba(74,222,128,0.75)]" />
              ) : null}
            </div>
            <div>
              {selfSeat ? (
                <SeatBadge compact highlight seat={selfSeat} />
              ) : (
                <div className="rounded-[22px] border border-white/8 bg-[#171f2c] px-4 py-4 text-sm text-slate-400">
                  未绑定席位
                </div>
              )}
            </div>
            {onLeave ? (
              <button
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLeaving}
                onClick={() => void onLeave()}
                type="button"
              >
                {isLeaving ? "退出中..." : "退出房间"}
              </button>
            ) : null}
          </section>
        </aside>

        <section className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,_rgba(19,27,40,0.98),_rgba(13,19,31,0.98))] p-5 shadow-[0_24px_80px_rgba(2,6,23,0.48)]">
          <div className="grid justify-items-center gap-4 pb-1">
            <div className="text-lg font-medium text-slate-300">
              {formatMessageDay(latestTimelineAt)}
            </div>
          </div>

          <section className="grid min-h-0 gap-4 overflow-hidden">
            <h2 className="sr-only">聊天时间线</h2>
            <ul
              className="grid min-h-0 content-start gap-4 overflow-y-auto pr-1"
              ref={timelineListRef}
            >
            {room.messages.map((message) =>
              message.kind === "system" ? (
                <SystemMessage key={message.id} message={message} />
              ) : (
                <ChatMessage
                  key={message.id}
                  isSelf={message.seatId === selfSeatId}
                  message={message}
                  seat={room.seats.find((seat) => seat.id === message.seatId)}
                />
              ),
            )}
            </ul>

            {room.phase === "voting" || room.phase === "tiebreak_voting" ? (
              isSelfAlive ? (
                <section className="grid gap-4 rounded-[24px] border border-white/8 bg-[#121a28] p-5">
                  <VotingPanel
                    disabled={!onVote}
                    onVote={onVote}
                    seats={room.seats}
                    selectedSeatId={room.selfVoteTargetId ?? undefined}
                    selfSeatId={selfSeatId ?? ""}
                    tieSeatIds={room.phase === "tiebreak_voting" ? room.tieSeatIds : []}
                  />
                </section>
              ) : (
                <div className="rounded-[24px] border border-white/8 bg-[#121a28] px-5 py-4 text-sm text-slate-300">
                  你已出局，当前只能旁观投票结果。
                </div>
              )
            ) : null}

            {room.phase === "eliminated_reveal" ? (
              <div className="rounded-[24px] border border-white/8 bg-[#121a28] px-5 py-4 text-sm text-slate-300">
                <h3 className="mb-1 text-base font-semibold text-white">等待下一轮</h3>
                <p>系统正在结算淘汰结果，下一轮会自动开始。</p>
              </div>
            ) : null}
          </section>

          <section className="border-t border-white/8 pt-4">
            {room.phase === "discussion" || room.phase === "tiebreak_discussion" ? (
              isSelfAlive ? (
                <MessageComposer onSend={onSendMessage} />
              ) : (
                <div className="rounded-[22px] border border-white/8 bg-[#121a28] px-5 py-4 text-sm text-slate-300">
                  你已出局，当前只能旁观聊天。
                </div>
              )
            ) : (
              <div className="rounded-[22px] border border-white/8 bg-[#121a28] px-5 py-4 text-sm text-slate-500">
                当前阶段无需发送消息。
              </div>
            )}
          </section>
        </section>

        <aside className="grid h-full min-h-0 auto-rows-min content-start gap-4 overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,_rgba(19,27,40,0.98),_rgba(13,19,31,0.98))] p-5 shadow-[0_24px_70px_rgba(2,6,23,0.45)]">
          <h2 className="text-3xl font-semibold text-white">席位面板</h2>

          <section className="grid content-start gap-3 overflow-hidden">
            <h3 className="text-2xl font-semibold text-white">在场 ({aliveSeats.length})</h3>
            <div className="grid max-h-[44vh] content-start gap-3 overflow-y-auto pr-1">
              {aliveSeats.map((seat) => (
                <SeatBadge
                  key={seat.id}
                  highlight={seat.id === selfSeatId}
                  seat={seat}
                />
              ))}
            </div>
          </section>

          <section className="grid content-start gap-3 overflow-hidden pt-2">
            <h3 className="text-2xl font-semibold text-white">
              旁观 ({spectatorSeats.length})
            </h3>
            {spectatorSeats.length > 0 ? (
              <div className="grid max-h-[28vh] content-start gap-3 overflow-y-auto pr-1">
                {spectatorSeats.map((seat) => (
                  <SeatBadge
                    key={seat.id}
                    highlight={seat.id === selfSeatId}
                    seat={seat}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-[22px] border border-white/8 bg-[#171f2c] px-4 py-4 text-sm text-slate-400">
                暂无旁观席位
              </div>
            )}
          </section>

          {!isSelfAlive ? (
            <div className="mt-2 rounded-[24px] border border-blue-400/12 bg-blue-500/10 px-5 py-4">
              <div className="mb-1 text-xl font-semibold text-blue-300">你已出局</div>
              <p className="text-sm text-slate-200">当前只能旁观聊天。</p>
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
