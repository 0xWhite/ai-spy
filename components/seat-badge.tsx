import type { ClientSeatState } from "@/lib/room-snapshot";
import { formatSeatLabel } from "@/lib/utils/format";
import { getSeatAccent } from "@/lib/utils/seat-style";

type SeatBadgeProps = {
  seat: ClientSeatState;
  highlight?: boolean;
  compact?: boolean;
};

export function SeatBadge({
  seat,
  highlight = false,
  compact = false,
}: SeatBadgeProps) {
  const seatLabel =
    "color" in seat && "number" in seat ? formatSeatLabel(seat) : "未分配席位";
  const accent = getSeatAccent("color" in seat ? seat.color : undefined);
  const statusLabel = seat.status === "alive" ? "在场" : "旁观";
  const metaLabel = `${statusLabel} · ${seat.connected ? "在线" : "离线"}`;

  return (
    <div
      className={`rounded-[22px] border px-4 py-3 text-sm transition ${
        highlight
          ? "border-white/16 bg-[#1d2635] text-white shadow-[0_20px_40px_rgba(15,23,42,0.24)]"
          : "border-white/6 bg-[#171f2c] text-white/90"
      }`}
    >
      <div className={`flex items-center gap-3 ${compact ? "gap-2" : "gap-3.5"}`}>
        <span
          aria-hidden="true"
          className={`inline-flex shrink-0 items-center justify-center rounded-full border bg-slate-900 font-semibold text-white ${accent.ring} ${accent.glow} ${
            compact ? "h-10 w-10 text-[11px]" : "h-12 w-12 text-xs"
          }`}
        >
          {"number" in seat ? `${seat.number}号` : "?"}
        </span>
        <div className="grid gap-1">
          <span className={`font-semibold ${compact ? "text-base" : "text-lg"} leading-none`}>
            {seatLabel}
          </span>
          <span className={`text-xs ${highlight ? "text-white/72" : "text-slate-400"}`}>
            <span className={seat.status === "alive" ? "text-green-400" : "text-slate-400"}>
              {statusLabel}
            </span>
            {` · ${seat.connected ? "在线" : "离线"}`}
          </span>
        </div>
      </div>
      <span className="sr-only">{metaLabel}</span>
    </div>
  );
}
