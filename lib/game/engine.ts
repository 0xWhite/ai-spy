import { DEFAULT_ROOM_CONFIG, SEAT_COLORS } from "@/lib/game/config";
import type {
  BuildInitialRoomStateInput,
  RoomMessage,
  RoomState,
  SeatState,
  VoteMap,
} from "@/lib/game/types";

function invariant(code: string): never {
  throw new Error(code);
}

function buildSystemMessage(text: string, createdAt: number): RoomMessage {
  return {
    id: `system-${createdAt}-${text}`,
    kind: "system",
    text,
    createdAt,
  };
}

function buildPlayerMessage(
  seatId: string,
  text: string,
  createdAt: number,
): RoomMessage {
  return {
    id: `player-${seatId}-${createdAt}`,
    kind: "player",
    seatId,
    text,
    createdAt,
  };
}

function getAliveSeats(seats: SeatState[]) {
  return seats.filter((seat) => seat.status === "alive");
}

function getAliveSeatIdSet(seats: SeatState[]) {
  return new Set(getAliveSeats(seats).map((seat) => seat.id));
}

function getSeatById(seats: SeatState[], seatId: string) {
  return seats.find((seat) => seat.id === seatId);
}

function canSpeakInPhase(room: RoomState) {
  return room.phase === "discussion" || room.phase === "tiebreak_discussion";
}

function canVoteInPhase(room: RoomState) {
  return room.phase === "voting" || room.phase === "tiebreak_voting";
}

function getValidVoteTargetSeatIds(room: RoomState) {
  if (room.phase === "tiebreak_voting") {
    return new Set(room.tieSeatIds);
  }

  return getAliveSeatIdSet(room.seats);
}

function getSortedAliveSeatIds(room: RoomState) {
  return [...getAliveSeatIdSet(room.seats)].sort();
}

function getDeterministicTiebreakEliminationSeatId(room: RoomState) {
  const candidateSeatIds =
    room.tieSeatIds.length > 0 ? [...room.tieSeatIds].sort() : getSortedAliveSeatIds(room);

  return candidateSeatIds[0];
}

function countVotes(votes: VoteMap, validSeatIds: Set<string>) {
  const tallies = new Map<string, number>();

  for (const targetSeatId of Object.values(votes)) {
    if (!validSeatIds.has(targetSeatId)) {
      continue;
    }

    tallies.set(targetSeatId, (tallies.get(targetSeatId) ?? 0) + 1);
  }

  return tallies;
}

export function buildInitialRoomState(
  input: BuildInitialRoomStateInput,
): RoomState {
  const config = {
    ...DEFAULT_ROOM_CONFIG,
    totalSeats: input.totalSeats ?? DEFAULT_ROOM_CONFIG.totalSeats,
    aiCount: input.aiCount ?? DEFAULT_ROOM_CONFIG.aiCount,
    endgameAliveSeatCount:
      input.endgameAliveSeatCount ?? DEFAULT_ROOM_CONFIG.endgameAliveSeatCount,
    roundOneSeconds:
      input.roundOneSeconds ?? DEFAULT_ROOM_CONFIG.roundOneSeconds,
    roundSeconds: input.roundSeconds ?? DEFAULT_ROOM_CONFIG.roundSeconds,
    voteSeconds: input.voteSeconds ?? DEFAULT_ROOM_CONFIG.voteSeconds,
    tiebreakSeconds:
      input.tiebreakSeconds ?? DEFAULT_ROOM_CONFIG.tiebreakSeconds,
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
  now: number,
): RoomState {
  return {
    ...room,
    phase: "tiebreak_discussion",
    tieSeatIds: [...tieSeatIds].sort(),
    votes: {},
    phaseEndsAt: now + room.config.tiebreakSeconds * 1000,
  };
}

export function eliminateSeat(room: RoomState, targetSeatId: string): RoomState {
  const aliveSeatIds = getAliveSeatIdSet(room.seats);

  if (!aliveSeatIds.has(targetSeatId)) {
    return room;
  }

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

  if (aliveSeats.length === room.config.endgameAliveSeatCount) {
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

export function closeVotingPhase(room: RoomState, now: number): RoomState {
  const tallies = countVotes(room.votes, getValidVoteTargetSeatIds(room));

  if (tallies.size === 0) {
    if (room.phase === "tiebreak_voting") {
      const targetSeatId = getDeterministicTiebreakEliminationSeatId(room);
      return targetSeatId ? eliminateSeat(room, targetSeatId) : room;
    }

    return enterTieBreakFromVotes(room, getSortedAliveSeatIds(room), now);
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
    return enterTieBreakFromVotes(room, topSeatIds, now);
  }

  return eliminateSeat(room, topSeatIds[0]);
}

export function appendPlayerMessage(
  room: RoomState,
  input: {
    seatId: string;
    text: string;
    now: number;
  },
): RoomState {
  const seat = getSeatById(room.seats, input.seatId);

  if (!seat || seat.status !== "alive" || room.phase === "finished") {
    invariant("SEAT_CANNOT_SPEAK");
  }

  if (!canSpeakInPhase(room)) {
    invariant("PHASE_DOES_NOT_ALLOW_MESSAGES");
  }

  return {
    ...room,
    messages: [
      ...room.messages,
      buildPlayerMessage(input.seatId, input.text.trim(), input.now),
    ],
  };
}

export function castVote(
  room: RoomState,
  input: {
    voterSeatId: string;
    targetSeatId: string;
  },
): RoomState {
  const voterSeat = getSeatById(room.seats, input.voterSeatId);
  const validTargetSeatIds = getValidVoteTargetSeatIds(room);

  if (!voterSeat || voterSeat.status !== "alive" || room.phase === "finished") {
    invariant("SEAT_CANNOT_VOTE");
  }

  if (!canVoteInPhase(room)) {
    invariant("PHASE_DOES_NOT_ALLOW_VOTES");
  }

  if (input.voterSeatId === input.targetSeatId) {
    invariant("CANNOT_VOTE_SELF");
  }

  if (!validTargetSeatIds.has(input.targetSeatId)) {
    invariant("INVALID_VOTE_TARGET");
  }

  return {
    ...room,
    votes: {
      ...room.votes,
      [input.voterSeatId]: input.targetSeatId,
    },
  };
}

export function advancePhaseFromTimeout(
  room: RoomState,
  now: number,
): RoomState {
  switch (room.phase) {
    case "discussion":
      return {
        ...room,
        phase: "voting",
        votes: {},
        phaseEndsAt: now + room.config.voteSeconds * 1000,
        messages: [
          ...room.messages,
          buildSystemMessage("讨论结束，进入投票阶段", now),
        ],
      };
    case "tiebreak_discussion":
      return {
        ...room,
        phase: "tiebreak_voting",
        votes: {},
        phaseEndsAt: now + room.config.voteSeconds * 1000,
      };
    case "voting":
    case "tiebreak_voting":
      return closeVotingPhase(room, now);
    case "eliminated_reveal":
      return startNextDiscussion(room, now);
    default:
      return room;
  }
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
