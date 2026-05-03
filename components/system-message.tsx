import type { SystemRoomMessage } from "@/lib/game/types";
import { formatMessageTime } from "@/lib/utils/format";

type SystemMessageProps = {
  message: SystemRoomMessage;
};

export function SystemMessage({ message }: SystemMessageProps) {
  return (
    <li className="grid gap-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <span className="font-medium">系统消息</span>
      <p>{message.text}</p>
      <span className="text-xs text-amber-700">
        {formatMessageTime(message)}
      </span>
    </li>
  );
}
