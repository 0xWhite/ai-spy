import type {
  GamePhase,
  RoomMessage,
  SeatColor,
  SeatState,
} from "@/lib/game/types";

const SEAT_COLOR_LABELS: Record<SeatColor, string> = {
  red: "红色",
  blue: "蓝色",
  green: "绿色",
  yellow: "黄色",
  purple: "紫色",
  cyan: "青色",
  orange: "橙色",
};

const PHASE_LABELS: Record<GamePhase, string> = {
  lobby: "大厅",
  discussion: "讨论阶段",
  voting: "投票阶段",
  tiebreak_discussion: "加赛讨论",
  tiebreak_voting: "加赛投票",
  eliminated_reveal: "淘汰结算",
  finished: "结算完成",
};

export function formatSeatLabel(seat: Pick<SeatState, "color" | "id">) {
  const seatNumber = seat.id.replace("seat-", "");
  return `${SEAT_COLOR_LABELS[seat.color]} ${seatNumber} 号`;
}

export function formatPhaseLabel(phase: "waiting" | GamePhase) {
  if (phase === "waiting") {
    return "等待开局";
  }

  return PHASE_LABELS[phase];
}

export function formatCountdown(targetTime: number | null, now = Date.now()) {
  if (targetTime === null) {
    return "--:--";
  }

  const remainingSeconds = Math.max(Math.ceil((targetTime - now) / 1000), 0);
  const minutes = Math.floor(remainingSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (remainingSeconds % 60).toString().padStart(2, "0");

  return `${minutes}:${seconds}`;
}

export function formatMessageTime(message: Pick<RoomMessage, "createdAt">) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(message.createdAt);
}
