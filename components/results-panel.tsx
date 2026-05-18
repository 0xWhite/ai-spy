import type { RoomResult } from "@/lib/game/types";
import type { RevealedClientSeatState } from "@/lib/room-snapshot";
import { formatSeatLabel } from "@/lib/utils/format";
import { getSeatAccent } from "@/lib/utils/seat-style";

type ResultsPanelProps = {
  result: RoomResult | null;
  seats: RevealedClientSeatState[];
  eliminatedSeatIds: string[];
  onRematch?: () => Promise<void> | void;
  onReturnHome?: () => Promise<void> | void;
  isRestarting?: boolean;
  canRematch?: boolean;
};

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,_rgba(21,29,43,0.96),_rgba(12,18,30,0.98))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.42)]">
      <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
      {children}
    </section>
  );
}

function SeatPill({ seat }: { seat: RevealedClientSeatState }) {
  const accent = getSeatAccent(seat.color);

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
      <span
        aria-hidden="true"
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-slate-950 text-sm font-semibold text-white ${accent.ring} ${accent.glow}`}
      >
        {seat.number}号
      </span>
      <div className="grid gap-1">
        <span className="text-base font-semibold text-white">
          {formatSeatLabel(seat)}
        </span>
        <span className="text-sm text-slate-400">
          {seat.role === "ai" ? "AI 身份公开" : "真人席位"}
        </span>
      </div>
    </li>
  );
}

function EliminationRow({
  seat,
  index,
}: {
  seat: RevealedClientSeatState;
  index: number;
}) {
  const accent = getSeatAccent(seat.color);

  return (
    <li className="grid grid-cols-[auto_1fr] items-start gap-4">
      <div className="grid justify-items-center gap-2">
        <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-2 text-sm font-semibold text-white">
          {index + 1}
        </span>
        <span className="h-full w-px bg-white/10" />
      </div>
      <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3">
        <span
          aria-hidden="true"
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-slate-950 text-sm font-semibold text-white ${accent.ring} ${accent.glow}`}
        >
          {seat.number}号
        </span>
        <div className="grid gap-1">
          <span className="text-base font-semibold text-white">
            {formatSeatLabel(seat)}
          </span>
          <span className="text-sm text-slate-400">
            {seat.role === "ai" ? "被投出后揭晓为 AI" : "被淘汰出局"}
          </span>
        </div>
      </div>
    </li>
  );
}

function AiRevealCard({
  seat,
  winner,
  isSolo,
}: {
  seat: RevealedClientSeatState;
  winner: RoomResult["winner"];
  isSolo: boolean;
}) {
  const accent = getSeatAccent(seat.color);

  return (
    <article
      className={`relative overflow-hidden rounded-[32px] border p-7 ${
        isSolo ? "min-h-[320px]" : "min-h-[280px]"
      } ${
        winner === "human"
          ? "border-blue-400/18 bg-[linear-gradient(180deg,_rgba(24,41,73,0.92),_rgba(12,20,33,0.98))]"
          : "border-rose-400/18 bg-[linear-gradient(180deg,_rgba(55,21,37,0.92),_rgba(16,19,30,0.98))]"
      } shadow-[0_26px_80px_rgba(2,6,23,0.48)]`}
    >
      <div
        className={`pointer-events-none absolute -right-10 top-0 h-44 w-44 rounded-full blur-3xl ${
          winner === "human" ? "bg-blue-500/16" : "bg-rose-500/16"
        }`}
      />
      <div className="relative grid h-full content-between gap-8">
        <div className="flex items-start justify-between gap-4">
          <span
            className={`inline-flex h-12 items-center justify-center rounded-full border px-4 text-sm font-semibold uppercase tracking-[0.18em] ${accent.ring} ${accent.badge}`}
          >
            AI
          </span>
          <span className="text-sm font-medium text-slate-400">身份揭晓</span>
        </div>

        <div className="grid justify-items-start gap-5">
          <span
            aria-hidden="true"
            className={`inline-flex h-24 w-24 items-center justify-center rounded-full border bg-slate-950 text-3xl font-bold text-white ${accent.ring} ${accent.glow}`}
          >
            {seat.number}
          </span>
          <div className="grid gap-2">
            <h3 className="text-4xl font-bold tracking-tight text-white">
              {formatSeatLabel(seat)}
            </h3>
            <p className="max-w-xl text-lg leading-8 text-slate-300">
              这名席位在本局中属于 AI 阵营，身份已在结算阶段公开。
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

export function ResultsPanel({
  result,
  seats,
  eliminatedSeatIds,
  onRematch,
  onReturnHome,
  isRestarting = false,
  canRematch = false,
}: ResultsPanelProps) {
  const winner = result?.winner ?? "human";
  const aiSeats = seats.filter((seat) => seat.role === "ai");
  const aliveSeats = seats.filter((seat) => seat.status === "alive");
  const eliminatedSeats = eliminatedSeatIds
    .map((seatId) => seats.find((seat) => seat.id === seatId))
    .filter((seat): seat is RevealedClientSeatState => Boolean(seat));

  const winnerLabel = winner === "human" ? "人类阵营获胜" : "AI 阵营获胜";
  const winnerSummary =
    winner === "human"
      ? "所有 AI 已被识破并淘汰，结算阶段正式公开它们的真实身份。"
      : "AI 成功混入最终局面，直到结算时刻才揭开真实身份。";

  return (
    <main
      className={`h-screen overflow-hidden px-5 py-5 text-white lg:px-6 lg:py-6 ${
        winner === "human"
          ? "bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_34%),linear-gradient(180deg,_#09111d_0%,_#0d1522_100%)]"
          : "bg-[radial-gradient(circle_at_top,_rgba(244,63,94,0.12),_transparent_34%),linear-gradient(180deg,_#0c1018_0%,_#111522_100%)]"
      }`}
    >
      <section className="mx-auto grid h-full max-w-[1440px] grid-rows-[minmax(0,0.98fr)_minmax(0,1fr)] gap-5">
        <div className="grid min-h-0 gap-5 lg:grid-cols-[0.92fr_1.08fr]">
          <header className="relative overflow-hidden rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,_rgba(20,29,43,0.96),_rgba(11,17,28,0.98))] px-7 py-7 shadow-[0_28px_80px_rgba(2,6,23,0.48)]">
            <div
              className={`pointer-events-none absolute right-0 top-0 h-56 w-56 rounded-full blur-3xl ${
                winner === "human" ? "bg-blue-500/18" : "bg-rose-500/18"
              }`}
            />
            <div className="relative grid h-full content-between gap-6">
              <div className="grid gap-3">
                <span className="text-sm font-medium uppercase tracking-[0.22em] text-slate-400">
                  对局结算
                </span>
                <h1 className="text-4xl font-bold tracking-tight text-white lg:text-5xl">
                  {winnerLabel}
                </h1>
                <p className="max-w-xl text-base leading-7 text-slate-300 lg:text-lg">
                  {winnerSummary}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm font-medium text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => void onReturnHome?.()}
                  type="button"
                >
                  返回首页
                </button>
                {canRematch ? (
                  <button
                    className={`inline-flex h-11 items-center justify-center rounded-2xl px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      winner === "human"
                        ? "bg-blue-500 text-white shadow-[0_14px_32px_rgba(59,130,246,0.32)] hover:bg-blue-400"
                        : "bg-rose-500 text-white shadow-[0_14px_32px_rgba(244,63,94,0.28)] hover:bg-rose-400"
                    }`}
                    disabled={isRestarting}
                    onClick={() => void onRematch?.()}
                    type="button"
                  >
                    {isRestarting ? "准备中..." : "再来一局"}
                  </button>
                ) : null}
              </div>
              {!canRematch ? (
                <p className="text-sm text-slate-400">可以等待房主重开游戏</p>
              ) : null}
            </div>
          </header>

          <section className="grid min-h-0 gap-4 rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,_rgba(20,29,43,0.96),_rgba(11,17,28,0.98))] p-6 shadow-[0_28px_80px_rgba(2,6,23,0.48)]">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold tracking-tight text-white lg:text-3xl">
                AI 身份揭晓
              </h2>
              <span className="text-sm font-medium text-slate-400">
                {aiSeats.length} 名 AI
              </span>
            </div>
            <div
              className={`grid min-h-0 gap-4 ${
                aiSeats.length === 1 ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-2"
              }`}
            >
              {aiSeats.map((seat) => (
                <AiRevealCard
                  key={seat.id}
                  isSolo={aiSeats.length === 1}
                  seat={seat}
                  winner={winner}
                />
              ))}
            </div>
          </section>
        </div>

        <div className="grid min-h-0 gap-5 lg:grid-cols-[0.92fr_1.08fr]">
          <SectionCard title="最终在场">
            {aliveSeats.length > 0 ? (
              <ul className="grid content-start gap-3 overflow-y-auto pr-1">
                {aliveSeats.map((seat) => (
                  <SeatPill key={seat.id} seat={seat} />
                ))}
              </ul>
            ) : (
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4 text-sm text-slate-400">
                结算时没有仍在场的席位。
              </div>
            )}
          </SectionCard>

          <SectionCard title="淘汰顺序">
            {eliminatedSeats.length > 0 ? (
              <ol className="grid content-start gap-4 overflow-y-auto pr-1">
                {eliminatedSeats.map((seat, index) => (
                  <EliminationRow key={seat.id} index={index} seat={seat} />
                ))}
              </ol>
            ) : (
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4 text-sm text-slate-400">
                本局没有发生淘汰记录。
              </div>
            )}
          </SectionCard>
        </div>
      </section>
    </main>
  );
}
