export type GamePhase =
  | "lobby"
  | "discussion"
  | "voting"
  | "tiebreak_discussion"
  | "tiebreak_voting"
  | "eliminated_reveal"
  | "finished";

export type SeatRole = "human" | "ai";
export type SeatStatus = "alive" | "spectator";
export type SeatColor =
  | "red"
  | "blue"
  | "green"
  | "yellow"
  | "purple"
  | "cyan"
  | "orange";

export interface RoomConfig {
  totalSeats: number;
  aiCount: number;
  endgameAliveSeatCount: number;
  roundOneSeconds: number;
  roundSeconds: number;
  voteSeconds: number;
  tiebreakSeconds: number;
}

export interface SeatState {
  id: string;
  role: SeatRole;
  status: SeatStatus;
  color: SeatColor;
  connected: boolean;
  isHost: boolean;
}

export interface SystemRoomMessage {
  id: string;
  kind: "system";
  text: string;
  createdAt: number;
}

export interface PlayerRoomMessage {
  id: string;
  kind: "player";
  seatId: string;
  text: string;
  createdAt: number;
}

export type RoomMessage = SystemRoomMessage | PlayerRoomMessage;

export interface RoomResult {
  winner: "human" | "ai";
}

export type VoteMap = Record<string, string>;

export interface RoomState {
  phase: GamePhase;
  round: number;
  hostSeatId: string;
  seats: SeatState[];
  votes: VoteMap;
  tieSeatIds: string[];
  eliminatedSeatIds: string[];
  messages: RoomMessage[];
  result: RoomResult | null;
  phaseEndsAt: number | null;
  config: RoomConfig;
}

export interface BuildInitialRoomStateInput extends Partial<RoomConfig> {
  hostSeatId: string;
}
