import type { RoomMessage, RoomState } from "@/lib/game/types";

type AiSchedulingRoom = RoomState & {
  code: string;
};

type CalculateAiTurnDelayOptions = {
  now?: number;
  random?: () => number;
  source?: "ai" | "timer" | "user";
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getLatestHumanMessage(room: AiSchedulingRoom) {
  return [...room.messages]
    .reverse()
    .find(
      (message) =>
        message.kind === "player" &&
        room.seats.some(
          (seat) => seat.id === message.seatId && seat.role === "human",
        ),
    ) as Extract<RoomMessage, { kind: "player" }> | undefined;
}

function includesDirectQuestion(text: string) {
  return /[？?]|吗$|呢$|吧$/.test(text.trim());
}

function getTypingDelayMs(text: string) {
  const normalizedLength = text.trim().length;
  const base = 1_400;
  const perChar = 110;
  return clamp(base + normalizedLength * perChar, 2_200, 6_000);
}

export function calculateAiTurnDelayMs(
  room: AiSchedulingRoom,
  options: CalculateAiTurnDelayOptions = {},
) {
  const random = options.random ?? Math.random;
  const now = options.now ?? Date.now();
  const jitter = () => Math.floor(random() * 1_500);

  if (room.phase === "voting" || room.phase === "tiebreak_voting") {
    return 1_200 + jitter();
  }

  if (room.phase !== "discussion" && room.phase !== "tiebreak_discussion") {
    return 0;
  }

  const latestHumanMessage = getLatestHumanMessage(room);
  if (!latestHumanMessage) {
    return 4_000 + Math.floor(random() * 8_000);
  }

  const messageAgeMs = Math.max(now - latestHumanMessage.createdAt, 0);
  const typingDelayMs = getTypingDelayMs(latestHumanMessage.text);
  const responsivenessBias = includesDirectQuestion(latestHumanMessage.text)
    ? 500
    : 1_100;
  const targetDelayMs = typingDelayMs + responsivenessBias + jitter();

  return clamp(targetDelayMs - messageAgeMs, 1_500, 9_000);
}
