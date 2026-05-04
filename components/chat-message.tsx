import type { PlayerRoomMessage } from "@/lib/game/types";
import type { ClientSeatState } from "@/lib/server/room-store";
import { formatSeatLabel, formatMessageTime } from "@/lib/utils/format";

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
  return (
    <li
      className={`grid gap-1 rounded-lg border px-4 py-3 text-sm ${
        isSelf
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-900"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">
          {seat ? formatSeatLabel(seat) : message.seatId}
        </span>
        <span className={`text-xs ${isSelf ? "text-slate-200" : "text-slate-500"}`}>
          {formatMessageTime(message)}
        </span>
      </div>
      <p>{message.text}</p>
    </li>
  );
}
