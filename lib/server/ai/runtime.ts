import { appendPlayerMessage, castVote } from "@/lib/game/engine";
import type { RoomState, SeatState } from "@/lib/game/types";
import { mockAiProvider } from "@/lib/server/ai/mock-provider";
import {
  createOpenAiCompatibleProvider,
  getOpenAiCompatibleConfigStatus,
} from "@/lib/server/ai/openai-compatible-provider";
import type { AiProvider, AiTurnContext } from "@/lib/server/ai/provider";

type AiManagedRoom = RoomState & {
  code: string;
};

type ActivePhase =
  | "discussion"
  | "tiebreak_discussion"
  | "voting"
  | "tiebreak_voting";

export interface AiPhaseState {
  key: string;
  messageResponseKeys: string[];
  voteSeatIds: string[];
}

export interface AiRunResult {
  phaseState: AiPhaseState;
  room: AiManagedRoom;
}

export type AiDiagnosticReporter = (message: string, detail?: unknown) => void;

interface CreateRuntimeAiProviderOptions {
  env?: NodeJS.ProcessEnv;
  fallbackProvider?: AiProvider;
  primaryProvider?: AiProvider;
  reportIssue?: AiDiagnosticReporter;
}

interface AiRuntimeOptions {
  random?: () => number;
}

function defaultReportIssue(message: string, detail?: unknown) {
  if (detail === undefined) {
    console.warn(`[ai-runtime] ${message}`);
    return;
  }

  console.warn(`[ai-runtime] ${message}`, detail);
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

function createEmptyPhaseState(key: string): AiPhaseState {
  return {
    key,
    messageResponseKeys: [],
    voteSeatIds: [],
  };
}

function normalizePhaseState(
  room: AiManagedRoom,
  phaseState?: AiPhaseState,
) {
  const key = createPhaseKey(room);
  const nextPhaseState =
    phaseState?.key === key ? phaseState : createEmptyPhaseState(key);

  return {
    key,
    messageResponseKeys: new Set(nextPhaseState.messageResponseKeys),
    voteSeatIds: new Set(nextPhaseState.voteSeatIds),
  };
}

function serializePhaseState(state: {
  key: string;
  messageResponseKeys: Set<string>;
  voteSeatIds: Set<string>;
}): AiPhaseState {
  return {
    key: state.key,
    messageResponseKeys: [...state.messageResponseKeys].sort(),
    voteSeatIds: [...state.voteSeatIds].sort(),
  };
}

function getDiscussionPhaseStartedAt(room: AiManagedRoom) {
  if (room.phaseEndsAt === null) {
    return null;
  }

  if (room.phase === "discussion") {
    const durationSeconds =
      room.round === 1 ? room.config.roundOneSeconds : room.config.roundSeconds;
    return room.phaseEndsAt - durationSeconds * 1000;
  }

  if (room.phase === "tiebreak_discussion") {
    return room.phaseEndsAt - room.config.tiebreakSeconds * 1000;
  }

  return null;
}

function getLatestHumanDiscussionTriggerId(room: AiManagedRoom) {
  const phaseStartedAt = getDiscussionPhaseStartedAt(room);
  if (phaseStartedAt === null) {
    return "__opening__";
  }

  const humanSeatIds = new Set(
    room.seats.filter((seat) => seat.role === "human").map((seat) => seat.id),
  );
  const latestHumanMessage = [...room.messages]
    .reverse()
    .find(
      (message) =>
        message.kind === "player" &&
        message.createdAt >= phaseStartedAt &&
        humanSeatIds.has(message.seatId),
    );

  return latestHumanMessage?.id ?? "__opening__";
}

function buildSeatReferencePatterns(seat: Pick<SeatState, "number" | "color">) {
  return [
    `${seat.number}号`,
    `${seat.color}色`,
    `${seat.color}${seat.number}号`,
  ];
}

function getLatestHumanPlayerMessage(room: AiManagedRoom) {
  return [...room.messages]
    .reverse()
    .find(
      (message) =>
        message.kind === "player" &&
        room.seats.some(
          (seat) => seat.id === message.seatId && seat.role === "human",
        ),
    );
}

function shouldAiReplyToTrigger(
  room: AiManagedRoom,
  seat: SeatState,
  triggerId: string,
  random: () => number,
) {
  if (triggerId === "__opening__") {
    return random() < 0.38;
  }

  const latestHumanMessage = getLatestHumanPlayerMessage(room);
  if (!latestHumanMessage || latestHumanMessage.kind !== "player") {
    return false;
  }

  const text = latestHumanMessage.text.trim();
  const seatPatterns = buildSeatReferencePatterns(seat);
  const isDirectMention = seatPatterns.some((pattern) => text.includes(pattern));
  const isQuestion = /[？?]|吗$|呢$|吧$/.test(text);

  if (isDirectMention) {
    return random() < 0.92;
  }

  if (isQuestion) {
    return random() < 0.6;
  }

  return random() < 0.32;
}

async function callWithFallback<T>(
  context: AiTurnContext,
  primaryCall: (provider: AiProvider) => Promise<T>,
  options: {
    action: "generateMessage" | "chooseVote";
    fallbackProvider: AiProvider;
    primaryProvider: AiProvider;
    reportIssue: AiDiagnosticReporter;
  },
) {
  try {
    return await primaryCall(options.primaryProvider);
  } catch (error) {
    options.reportIssue(
      `OpenAI-compatible ${options.action} failed; falling back to mock AI.`,
      error,
    );
    return primaryCall(options.fallbackProvider);
  }
}

export function createRuntimeAiProvider(
  options: CreateRuntimeAiProviderOptions = {},
): AiProvider {
  const env = options.env ?? process.env;
  const fallbackProvider = options.fallbackProvider ?? mockAiProvider;
  const reportIssue = options.reportIssue ?? defaultReportIssue;
  const configStatus = getOpenAiCompatibleConfigStatus(env);

  if (configStatus.kind === "absent") {
    return fallbackProvider;
  }

  if (configStatus.kind === "misconfigured") {
    reportIssue(
      "AI env vars are partially configured; using mock AI instead.",
      {
        missing: configStatus.missing,
      },
    );
    return fallbackProvider;
  }

  const primaryProvider =
    options.primaryProvider ??
    createOpenAiCompatibleProvider(configStatus.config);

  return {
    async generateMessage(context) {
      return callWithFallback(context, (provider) => provider.generateMessage(context), {
        action: "generateMessage",
        fallbackProvider,
        primaryProvider,
        reportIssue,
      });
    },
    async chooseVote(context) {
      return callWithFallback(context, (provider) => provider.chooseVote(context), {
        action: "chooseVote",
        fallbackProvider,
        primaryProvider,
        reportIssue,
      });
    },
  };
}

export class AiRuntime {
  constructor(
    private readonly provider: AiProvider = createRuntimeAiProvider(),
    private readonly options: AiRuntimeOptions = {},
  ) {}

  async run(room: AiManagedRoom, phaseState?: AiPhaseState): Promise<AiRunResult> {
    if (!isAiPhase(room.phase)) {
      return {
        room,
        phaseState: createEmptyPhaseState(createPhaseKey(room)),
      };
    }

    const nextPhaseState = normalizePhaseState(room, phaseState);
    const aiSeats = room.seats.filter(
      (seat) => seat.role === "ai" && seat.status === "alive",
    );

    let nextRoom = room;
    const random = this.options.random ?? Math.random;

    for (const seat of aiSeats) {
      if (nextRoom.phase === "discussion" || nextRoom.phase === "tiebreak_discussion") {
        const triggerId = getLatestHumanDiscussionTriggerId(nextRoom);
        const responseKey = `${seat.id}:${triggerId}`;

        if (!nextPhaseState.messageResponseKeys.has(responseKey)) {
          nextPhaseState.messageResponseKeys.add(responseKey);
          if (shouldAiReplyToTrigger(nextRoom, seat, triggerId, random)) {
            nextRoom = await this.applyMessageTurn(nextRoom, seat);
          }
        }
      }

      if (
        (nextRoom.phase === "voting" || nextRoom.phase === "tiebreak_voting") &&
        !nextPhaseState.voteSeatIds.has(seat.id)
      ) {
        nextPhaseState.voteSeatIds.add(seat.id);
        nextRoom = await this.applyVoteTurn(nextRoom, seat);
      }
    }

    return {
      room: nextRoom,
      phaseState: serializePhaseState(nextPhaseState),
    };
  }

  private async applyMessageTurn(room: AiManagedRoom, seat: SeatState) {
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
  }

  private async applyVoteTurn(room: AiManagedRoom, seat: SeatState) {
    const targetSeatId = await this.provider.chooseVote({
      room,
      seat,
      now: Date.now(),
    });

    if (!targetSeatId) {
      return room;
    }

    try {
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
