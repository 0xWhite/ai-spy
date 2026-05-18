import type { SystemRoomMessage } from "@/lib/game/types";
import { formatMessageTime } from "@/lib/utils/format";

type SystemMessageProps = {
  message: SystemRoomMessage;
};

export function SystemMessage({ message }: SystemMessageProps) {
  return (
    <li className="grid gap-2 rounded-[22px] border border-amber-200/70 bg-gradient-to-r from-[#fff5cc] to-[#fff8e8] px-5 py-4 text-sm text-[#493200] shadow-[0_12px_32px_rgba(255,236,179,0.18)]">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-sm font-bold text-white">
          !
        </span>
        <div className="grid gap-1">
          <span className="font-semibold text-[#3a2b00]">系统消息</span>
          <p>{message.text}</p>
          <span className="text-xs text-amber-700">
            {formatMessageTime(message)}
          </span>
        </div>
      </div>
    </li>
  );
}
