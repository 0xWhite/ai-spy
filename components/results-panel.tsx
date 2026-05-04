import type { RoomResult } from "@/lib/game/types";
import type { RevealedClientSeatState } from "@/lib/server/room-store";
import { formatSeatLabel } from "@/lib/utils/format";

type ResultsPanelProps = {
  result: RoomResult | null;
  seats: RevealedClientSeatState[];
  eliminatedSeatIds: string[];
};

export function ResultsPanel({
  result,
  seats,
  eliminatedSeatIds,
}: ResultsPanelProps) {
  const aiSeats = seats.filter((seat) => seat.role === "ai");
  const aliveSeats = seats.filter((seat) => seat.status === "alive");

  return (
    <section className="mx-auto grid min-h-screen w-full max-w-5xl gap-6 px-6 py-10">
      <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-sm font-medium uppercase tracking-[0.12em] text-slate-500">
          对局结算
        </p>
        <h1 className="text-3xl font-semibold text-slate-950">
          {result?.winner === "human" ? "人类阵营获胜" : "AI 阵营获胜"}
        </h1>
        <p className="text-sm text-slate-600">
          AI 身份已公开，本局席位结果如下。
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-950">AI 身份</h2>
          <ul className="grid gap-2 text-sm text-slate-700">
            {aiSeats.map((seat) => (
              <li key={seat.id}>{formatSeatLabel(seat)}</li>
            ))}
          </ul>
        </section>

        <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-950">存活席位</h2>
          <ul className="grid gap-2 text-sm text-slate-700">
            {aliveSeats.map((seat) => (
              <li key={seat.id}>{formatSeatLabel(seat)}</li>
            ))}
          </ul>
        </section>

        <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-950">淘汰顺序</h2>
          <ol className="grid gap-2 text-sm text-slate-700">
            {eliminatedSeatIds.map((seatId) => {
              const seat = seats.find((entry) => entry.id === seatId);
              return <li key={seatId}>{seat ? formatSeatLabel(seat) : seatId}</li>;
            })}
          </ol>
        </section>
      </div>
    </section>
  );
}
