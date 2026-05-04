import {
  hasRevealedClientRoles,
  type ClientRoomSnapshot,
} from "@/lib/server/room-store";
import { ChatMessage } from "@/components/chat-message";
import { CountdownChip } from "@/components/countdown-chip";
import { MessageComposer } from "@/components/message-composer";
import { ResultsPanel } from "@/components/results-panel";
import { SeatBadge } from "@/components/seat-badge";
import { SystemMessage } from "@/components/system-message";
import { VotingPanel } from "@/components/voting-panel";
import { WaitingRoomPanel } from "@/components/waiting-room-panel";
import { formatPhaseLabel } from "@/lib/utils/format";

type RoomShellProps = {
  room: ClientRoomSnapshot;
  selfSeatId: string | null;
  onStart?: () => Promise<void> | void;
  onSendMessage?: (text: string) => Promise<void> | void;
  onVote?: (targetSeatId: string) => Promise<void> | void;
  isStarting?: boolean;
};

export function RoomShell({
  room,
  selfSeatId,
  onStart,
  onSendMessage,
  onVote,
  isStarting = false,
}: RoomShellProps) {
  if (room.phase === "waiting") {
    return (
      <WaitingRoomPanel
        code={room.code}
        isStarting={isStarting}
        onStart={onStart}
        seats={room.seats}
        selfSeatId={selfSeatId}
      />
    );
  }

  if (hasRevealedClientRoles(room)) {
    return (
      <ResultsPanel
        eliminatedSeatIds={room.eliminatedSeatIds}
        result={room.result}
        seats={room.seats}
      />
    );
  }

  const aliveCount = room.seats.filter((seat) => seat.status === "alive").length;
  const selfSeat = room.seats.find((seat) => seat.id === selfSeatId);
  const isSelfAlive = selfSeat?.status === "alive";

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[1.7fr_0.9fr]">
      <section className="grid gap-4">
        <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-1">
              <p className="text-sm font-medium uppercase tracking-[0.12em] text-slate-500">
                {room.code}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-slate-950">
                <span className="text-2xl font-semibold">第 {room.round} 轮</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium">
                  {formatPhaseLabel(room.phase)}
                </span>
              </div>
            </div>
            <CountdownChip phaseEndsAt={room.phaseEndsAt} />
          </div>
          <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              当前阶段
              <div className="font-medium text-slate-950">
                {formatPhaseLabel(room.phase)}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              存活人数
              <div className="font-medium text-slate-950">{aliveCount} 人存活</div>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              当前席位
              <div className="font-medium text-slate-950">
                {selfSeat ? <SeatBadge seat={selfSeat} /> : "未绑定席位"}
              </div>
            </div>
          </div>
        </div>

        <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">聊天时间线</h2>
          <ul className="grid gap-3">
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
        </section>
      </section>

      <aside className="grid gap-4 self-start">
        <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-950">席位面板</h2>
          <div className="grid gap-2">
            {room.seats.map((seat) => (
              <SeatBadge
                key={seat.id}
                highlight={seat.id === selfSeatId}
                seat={seat}
              />
            ))}
          </div>
        </section>

        <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5">
          {room.phase === "discussion" || room.phase === "tiebreak_discussion" ? (
            isSelfAlive ? (
              <MessageComposer onSend={onSendMessage} />
            ) : (
              <p className="text-sm text-slate-600">你已出局，当前只能旁观聊天。</p>
            )
          ) : null}

          {room.phase === "voting" || room.phase === "tiebreak_voting" ? (
            isSelfAlive ? (
              <VotingPanel
                disabled={!onVote}
                onVote={onVote}
                seats={room.seats}
                selectedSeatId={selfSeatId ? room.votes[selfSeatId] : undefined}
                selfSeatId={selfSeatId ?? ""}
                tieSeatIds={room.phase === "tiebreak_voting" ? room.tieSeatIds : []}
              />
            ) : (
              <p className="text-sm text-slate-600">你已出局，当前只能旁观投票结果。</p>
            )
          ) : null}

          {room.phase === "eliminated_reveal" ? (
            <div className="grid gap-1 text-sm text-slate-600">
              <h3 className="text-base font-semibold text-slate-950">等待下一轮</h3>
              <p>系统正在结算淘汰结果，下一轮会自动开始。</p>
            </div>
          ) : null}
        </section>
      </aside>
    </main>
  );
}
