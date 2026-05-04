import type { RoomState } from "@/lib/game/types";
import type { AiProvider } from "@/lib/server/ai/provider";

function getAliveTargets(room: RoomState, seatId: string) {
  const allowedSeatIds =
    room.phase === "tiebreak_voting" ? new Set(room.tieSeatIds) : null;

  return room.seats.filter((candidate) => {
    if (candidate.id === seatId || candidate.status !== "alive") {
      return false;
    }

    return allowedSeatIds ? allowedSeatIds.has(candidate.id) : true;
  });
}

export const mockAiProvider: AiProvider = {
  async generateMessage({ room, seat }) {
    const target = getAliveTargets(room, seat.id)[0];
    if (!target) {
      return null;
    }

    return `${target.color} 座这轮发言不多，我先继续听。`;
  },
  async chooseVote({ room, seat }) {
    return getAliveTargets(room, seat.id)[0]?.id ?? null;
  },
};
