import type { RoomState, SeatState } from "@/lib/game/types";

export interface AiTurnContext {
  room: RoomState;
  seat: SeatState;
  now: number;
}

export interface AiProvider {
  generateMessage(context: AiTurnContext): Promise<string | null>;
  chooseVote(context: AiTurnContext): Promise<string | null>;
}
