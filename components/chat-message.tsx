import type { PlayerRoomMessage } from "@/lib/game/types";
import type { ClientSeatState } from "@/lib/room-snapshot";
import { formatSeatLabel, formatMessageTime } from "@/lib/utils/format";
import { getSeatAccent } from "@/lib/utils/seat-style";

type ChatMessageProps = {
  message: PlayerRoomMessage;
  seat?: ClientSeatState;
  isSelf?: boolean;
};

export function ChatMessage({
  message,
  seat,
  isSelf = false,
}: ChatMessageProps) {
  const displayedSeat =
    seat && "color" in seat && "number" in seat ? seat : null;
  const seatLabel = displayedSeat ? formatSeatLabel(displayedSeat) : message.seatId;
  const accent = getSeatAccent(displayedSeat?.color);
  const seatNumber = displayedSeat?.number ?? "?";

  return (
    <li
      className={`flex gap-3 text-sm ${
        isSelf ? "justify-end" : "justify-start"
      }`}
    >
      {!isSelf ? (
        <span
          aria-hidden="true"
          className={`mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-slate-900 text-[11px] font-semibold text-white ${accent.ring} ${accent.glow}`}
        >
          {seatNumber}
        </span>
      ) : null}
      <div
        className={`max-w-[78%] rounded-[24px] border px-4 py-3 ${
          isSelf
            ? "border-red-500/70 bg-[#1f2431] text-white shadow-[0_18px_40px_rgba(220,38,38,0.14)]"
            : "border-white/8 bg-[#202938] text-white shadow-[0_18px_40px_rgba(15,23,42,0.2)]"
        }`}
      >
        <div className="mb-1 flex items-center justify-between gap-3">
          <span className={`font-semibold ${isSelf ? "text-white" : accent.text}`}>
            {seatLabel}
          </span>
          <span className="text-xs text-slate-400">{formatMessageTime(message)}</span>
        </div>
        <p className="leading-6 text-slate-100">{message.text}</p>
      </div>
      {isSelf ? (
        <span
          aria-hidden="true"
          className={`mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-slate-900 text-[11px] font-semibold text-white ${accent.ring} ${accent.glow}`}
        >
          {seatNumber}
        </span>
      ) : null}
    </li>
  );
}
