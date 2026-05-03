import type { RoomConfig, SeatColor } from "@/lib/game/types";

export const SEAT_COLORS: SeatColor[] = [
  "red",
  "blue",
  "green",
  "yellow",
  "purple",
  "cyan",
  "orange",
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
