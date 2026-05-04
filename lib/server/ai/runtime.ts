import { appendPlayerMessage, castVote } from "@/lib/game/engine";
import type { RoomState, SeatState } from "@/lib/game/types";
import { mockAiProvider } from "@/lib/server/ai/mock-provider";
import {
  createOpenAiCompatibleProvider,
  hasOpenAiCompatibleConfig,
} from "@/lib/server/ai/openai-compatible-provider";
import type { AiProvider } from "@/lib/server/ai/provider";

type AiManagedRoom = RoomState & {
  code: string;
};

type ActivePhase =
  | "discussion"
  | "tiebreak_discussion"
  | "voting"
  | "tiebreak_voting";

interface PhaseRecord {
  key: string;
  messageSeatIds: Set<string>;
  voteSeatIds: Set<string>;
}

function isAiPhase(phase: RoomState["phase"]): phase is ActivePhase {
  return (
    phase === "discussion" ||
    phase === "tiebreak_discussion" ||
    phase === "voting" ||
    phase === "tiebreak_voting"
  );
}

function createPhaseKey(room: AiManagedRoom) {
  return [
    room.phase,
    room.round,
    room.tieSeatIds.join(","),
    room.eliminatedSeatIds.join(","),
  ].join("|");
}

function createPhaseRecord(key: string): PhaseRecord {
  return {
    key,
    messageSeatIds: new Set(),
    voteSeatIds: new Set(),
  };
}

function createDefaultProvider() {
  if (hasOpenAiCompatibleConfig()) {
    return createOpenAiCompatibleProvider();
  }

  return mockAiProvider;
}

export class AiRuntime {
  private readonly phaseRecords = new Map<string, PhaseRecord>();

  constructor(private readonly provider: AiProvider = createDefaultProvider()) {}

  private getPhaseRecord(room: AiManagedRoom) {
    const key = createPhaseKey(room);
    const current = this.phaseRecords.get(room.code);

    if (current?.key === key) {
      return current;
    }

    const next = createPhaseRecord(key);
    this.phaseRecords.set(room.code, next);
    return next;
  }

  async run(room: AiManagedRoom) {
    if (!isAiPhase(room.phase)) {
      return room;
    }

    const phaseRecord = this.getPhaseRecord(room);
    const aiSeats = room.seats.filter(
      (seat) => seat.role === "ai" && seat.status === "alive",
    );

    let nextRoom = room;

    for (const seat of aiSeats) {
      if (
        (nextRoom.phase === "discussion" ||
          nextRoom.phase === "tiebreak_discussion") &&
        !phaseRecord.messageSeatIds.has(seat.id)
      ) {
        phaseRecord.messageSeatIds.add(seat.id);
        nextRoom = await this.applyMessageTurn(nextRoom, seat);
      }

      if (
        (nextRoom.phase === "voting" || nextRoom.phase === "tiebreak_voting") &&
        !phaseRecord.voteSeatIds.has(seat.id)
      ) {
        phaseRecord.voteSeatIds.add(seat.id);
        nextRoom = await this.applyVoteTurn(nextRoom, seat);
      }
    }

    return nextRoom;
  }

  private async applyMessageTurn(room: AiManagedRoom, seat: SeatState) {
    try {
      const text = await this.provider.generateMessage({
        room,
        seat,
        now: Date.now(),
      });

      if (!text?.trim()) {
        return room;
      }

      return {
        ...appendPlayerMessage(room, {
          seatId: seat.id,
          text,
          now: Date.now(),
        }),
        code: room.code,
      };
    } catch {
      return room;
    }
  }

  private async applyVoteTurn(room: AiManagedRoom, seat: SeatState) {
    try {
      const targetSeatId = await this.provider.chooseVote({
        room,
        seat,
        now: Date.now(),
      });

      if (!targetSeatId) {
        return room;
      }

      return {
        ...castVote(room, {
          voterSeatId: seat.id,
          targetSeatId,
        }),
        code: room.code,
      };
    } catch {
      return room;
    }
  }
}

export const aiRuntime = new AiRuntime();
