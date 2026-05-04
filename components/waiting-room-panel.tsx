import { SeatBadge } from "@/components/seat-badge";
import type { ClientSeatState } from "@/lib/server/room-store";

type WaitingRoomPanelProps = {
  code: string;
  seats: ClientSeatState[];
  selfSeatId: string | null;
  onStart?: () => Promise<void> | void;
  isStarting?: boolean;
};

export function WaitingRoomPanel({
  code,
  seats,
  selfSeatId,
  onStart,
  isStarting = false,
}: WaitingRoomPanelProps) {
  const connectedCount = seats.filter((seat) => seat.connected).length;
  const selfSeat = seats.find((seat) => seat.id === selfSeatId);
  const canStart = selfSeat?.isHost && connectedCount >= 3;

  return (
    <section className="mx-auto grid min-h-screen w-full max-w-5xl gap-6 px-6 py-10">
      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-sm font-medium uppercase tracking-[0.12em] text-slate-500">
          等待开局
        </p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-1">
            <h1 className="text-3xl font-semibold text-slate-950">{code}</h1>
            <p className="text-sm text-slate-600">{connectedCount} / {seats.length} 已连接</p>
          </div>
          {selfSeat?.isHost ? (
            <button
              className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-slate-100 px-4 text-sm font-medium text-slate-950 transition hover:border-slate-400 hover:bg-slate-200 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
              disabled={!canStart || isStarting}
              onClick={() => void onStart?.()}
              type="button"
            >
              {isStarting ? "开局中..." : "开始游戏"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-950">席位状态</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {seats.map((seat) => (
              <SeatBadge
                key={seat.id}
                highlight={seat.id === selfSeatId}
                seat={seat}
              />
            ))}
          </div>
        </section>

        <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-950">本局节奏</h2>
          <ul className="grid gap-2 text-sm leading-6 text-slate-600">
            <li>讨论结束后自动进入投票。</li>
            <li>被淘汰席位会转入旁观。</li>
            <li>所有 AI 出局则人类获胜。</li>
            <li>仅剩 3 名存活者且 AI 仍在场则 AI 获胜。</li>
          </ul>
        </section>
      </div>
    </section>
  );
}
