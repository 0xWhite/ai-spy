import type { RoomConfig, SeatColor } from "@/lib/game/types";

export const SEAT_COLORS: SeatColor[] = [
  "red",
  "blue",
  "green",
  "yellow",
  "purple",
  "cyan",
  "orange",
  "pink",
];

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  totalSeats: 7,
  aiCount: 1,
  endgameAliveSeatCount: 3,
  roundOneSeconds: 300,
  roundSeconds: 180,
  voteSeconds: 60,
  tiebreakSeconds: 60,
};

const DEFAULT_MIN_CONNECTED_TO_START = 3;

export function getMinConnectedToStart() {
  const rawValue = process.env.NEXT_PUBLIC_MIN_CONNECTED_TO_START?.trim();
  if (!rawValue) {
    return DEFAULT_MIN_CONNECTED_TO_START;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isInteger(parsedValue)) {
    return DEFAULT_MIN_CONNECTED_TO_START;
  }

  return Math.min(Math.max(parsedValue, 2), DEFAULT_ROOM_CONFIG.totalSeats);
}
