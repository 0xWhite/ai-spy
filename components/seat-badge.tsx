import type { SeatState } from "@/lib/game/types";
import { formatSeatLabel } from "@/lib/utils/format";

type SeatBadgeProps = {
  seat: SeatState;
  highlight?: boolean;
};

export function SeatBadge({ seat, highlight = false }: SeatBadgeProps) {
  return (
    <div
      className={`grid gap-1 rounded-lg border px-3 py-2 text-sm ${
        highlight
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-900"
      }`}
    >
      <span className="font-medium">{formatSeatLabel(seat)}</span>
      <span
        className={`text-xs ${
          highlight ? "text-slate-200" : "text-slate-500"
        }`}
      >
        {seat.status === "alive" ? "存活" : "旁观"}
        {seat.connected ? " · 在线" : " · 离线"}
        {seat.isHost ? " · 房主" : ""}
      </span>
    </div>
  );
}
