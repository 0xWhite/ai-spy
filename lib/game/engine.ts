import { DEFAULT_ROOM_CONFIG, SEAT_COLORS } from "@/lib/game/config";
import type {
  BuildInitialRoomStateInput,
  RoomMessage,
  RoomState,
  SeatState,
  VoteMap,
} from "@/lib/game/types";

function buildSystemMessage(text: string, createdAt: number): RoomMessage {
  return {
    id: `system-${createdAt}-${text}`,
    kind: "system",
    text,
    createdAt,
  };
}

function getAliveSeats(seats: SeatState[]) {
  return seats.filter((seat) => seat.status === "alive");
}

function countVotes(votes: VoteMap) {
  const tallies = new Map<string, number>();

  for (const targetSeatId of Object.values(votes)) {
    tallies.set(targetSeatId, (tallies.get(targetSeatId) ?? 0) + 1);
  }

  return tallies;
}

export function buildInitialRoomState(
  input: BuildInitialRoomStateInput,
): RoomState {
  const config = {
    ...DEFAULT_ROOM_CONFIG,
    ...input,
  };

  return {
    phase: "lobby",
    round: 0,
    hostSeatId: input.hostSeatId,
    seats: Array.from({ length: config.totalSeats }, (_, index) => {
      const seatId = `seat-${index + 1}`;

      return {
        id: seatId,
        role: index < config.aiCount ? "ai" : "human",
        status: "alive",
        color: SEAT_COLORS[index % SEAT_COLORS.length],
        connected: seatId === input.hostSeatId,
        isHost: seatId === input.hostSeatId,
      };
    }),
    votes: {},
    tieSeatIds: [],
    eliminatedSeatIds: [],
    messages: [],
    result: null,
    phaseEndsAt: null,
    config,
  };
}

export function enterTieBreakFromVotes(
  room: RoomState,
  tieSeatIds: string[],
): RoomState {
  return {
    ...room,
    phase: "tiebreak_discussion",
    tieSeatIds: [...tieSeatIds].sort(),
    votes: {},
  };
}

export function eliminateSeat(room: RoomState, targetSeatId: string): RoomState {
  const seats = room.seats.map((seat) =>
    seat.id === targetSeatId ? { ...seat, status: "spectator" as const } : seat,
  );
  const aliveSeats = getAliveSeats(seats);
  const aliveAiSeats = aliveSeats.filter((seat) => seat.role === "ai");
  const eliminatedSeatIds = room.eliminatedSeatIds.includes(targetSeatId)
    ? room.eliminatedSeatIds
    : [...room.eliminatedSeatIds, targetSeatId];

  if (aliveAiSeats.length === 0) {
    return {
      ...room,
      phase: "finished",
      seats,
      eliminatedSeatIds,
      votes: {},
      tieSeatIds: [],
      result: { winner: "human" },
      phaseEndsAt: null,
    };
  }

  if (aliveSeats.length === 3) {
    return {
      ...room,
      phase: "finished",
      seats,
      eliminatedSeatIds,
      votes: {},
      tieSeatIds: [],
      result: { winner: "ai" },
      phaseEndsAt: null,
    };
  }

  return {
    ...room,
    phase: "eliminated_reveal",
    seats,
    eliminatedSeatIds,
    votes: {},
    tieSeatIds: [],
    phaseEndsAt: null,
  };
}

export function closeVotingPhase(room: RoomState): RoomState {
  const tallies = countVotes(room.votes);

  if (tallies.size === 0) {
    return {
      ...room,
      votes: {},
    };
  }

  let topVotes = 0;
  let topSeatIds: string[] = [];

  for (const [seatId, count] of tallies.entries()) {
    if (count > topVotes) {
      topVotes = count;
      topSeatIds = [seatId];
      continue;
    }

    if (count === topVotes) {
      topSeatIds.push(seatId);
    }
  }

  if (topSeatIds.length > 1) {
    return enterTieBreakFromVotes(room, topSeatIds);
  }

  return eliminateSeat(room, topSeatIds[0]);
}

export function startGame(room: RoomState, now: number): RoomState {
  return {
    ...room,
    phase: "discussion",
    round: 1,
    votes: {},
    tieSeatIds: [],
    phaseEndsAt: now + room.config.roundOneSeconds * 1000,
    messages: [
      ...room.messages,
      buildSystemMessage("第 1 轮讨论开始", now),
    ],
  };
}

export function startNextDiscussion(room: RoomState, now: number): RoomState {
  return {
    ...room,
    phase: "discussion",
    round: room.round + 1,
    votes: {},
    tieSeatIds: [],
    phaseEndsAt: now + room.config.roundSeconds * 1000,
  };
}
