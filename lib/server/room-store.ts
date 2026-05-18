import { advancePhaseFromTimeout, buildInitialRoomState, closeVotingPhase } from "@/lib/game/engine";
import type { BuildInitialRoomStateInput, RoomState } from "@/lib/game/types";
import {
  aiRuntime,
  type AiPhaseState,
  type AiRuntime,
} from "@/lib/server/ai/runtime";
import { calculateAiTurnDelayMs } from "@/lib/server/ai/scheduling";
import {
  type RoomSnapshot,
} from "@/lib/room-snapshot";
import { getRedisClient, isRedisConfigured } from "@/lib/server/redis";
import { normalizeRoomCode } from "@/lib/server/room-seat-cookie";

const ROOM_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ROOM_CODE_LENGTH = 6;
const HOST_SEAT_ID = "seat-1";
const WAITING_ROOM_TTL_SECONDS = 24 * 60 * 60;
const ACTIVE_ROOM_TTL_SECONDS = 2 * 60 * 60;
const FINISHED_ROOM_TTL_SECONDS = 60 * 60;
const CLOSED_ROOM_TTL_SECONDS = 10 * 60;

export type CreateRoomInput = Omit<BuildInitialRoomStateInput, "hostSeatId">;

export class RoomStoreError extends Error {
  constructor(
    public readonly code:
      | "ROOM_NOT_FOUND"
      | "ROOM_FULL"
      | "ROOM_NOT_WAITING"
      | "ROOM_NOT_FINISHED"
      | "ROOM_CLOSED",
  ) {
    super(code);
    this.name = "RoomStoreError";
  }
}

function cloneRoomSnapshot(room: RoomSnapshot) {
  return structuredClone(room);
}

function ensureHostSeatIsHuman(room: RoomState) {
  const hostSeat = room.seats.find((seat) => seat.id === room.hostSeatId);
  if (!hostSeat || hostSeat.role === "human") {
    return room;
  }

  const firstHumanSeat = room.seats.find((seat) => seat.role === "human");
  if (!firstHumanSeat) {
    return room;
  }

  return {
    ...room,
    seats: room.seats.map((seat) => {
      if (seat.id === hostSeat.id) {
        return {
          ...seat,
          role: "human" as const,
        };
      }

      if (seat.id === firstHumanSeat.id) {
        return {
          ...seat,
          role: "ai" as const,
        };
      }

      return seat;
    }),
  };
}

function generateRoomCode() {
  return Array.from({ length: ROOM_CODE_LENGTH }, () => {
    const index = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
    return ROOM_CODE_ALPHABET[index];
  }).join("");
}

export function getRoomSnapshotTtlSeconds(
  room: Pick<RoomSnapshot, "phase">,
) {
  switch (room.phase) {
    case "waiting":
      return WAITING_ROOM_TTL_SECONDS;
    case "finished":
      return FINISHED_ROOM_TTL_SECONDS;
    case "closed":
      return CLOSED_ROOM_TTL_SECONDS;
    default:
      return ACTIVE_ROOM_TTL_SECONDS;
  }
}

abstract class BaseRoomStore {
  private roomTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private roomVersions = new Map<string, number>();
  private aiPhaseStates = new Map<string, AiPhaseState>();
  private pendingAiJobs = new Set<string>();
  private pendingAiTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly roomAiRuntime: AiRuntime = aiRuntime,
  ) {}

  protected abstract readRoomSnapshot(code: string): Promise<RoomSnapshot | undefined>;
  protected abstract writeRoomSnapshot(room: RoomSnapshot): Promise<void>;

  private allAliveHumanVotesAreSubmitted(room: RoomSnapshot) {
    if (room.phase !== "voting" && room.phase !== "tiebreak_voting") {
      return false;
    }

    const aliveHumanSeats = room.seats.filter(
      (seat) => seat.role === "human" && seat.status === "alive",
    );

    return (
      aliveHumanSeats.length > 0 &&
      aliveHumanSeats.every((seat) => Boolean(room.votes[seat.id]))
    );
  }

  private allAliveVotesAreSubmitted(room: RoomSnapshot) {
    if (room.phase !== "voting" && room.phase !== "tiebreak_voting") {
      return false;
    }

    const aliveSeats = room.seats.filter((seat) => seat.status === "alive");
    return aliveSeats.length > 0 && aliveSeats.every((seat) => Boolean(room.votes[seat.id]));
  }

  private clearRoomTimer(code: string) {
    const timer = this.roomTimers.get(code);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    this.roomTimers.delete(code);
  }

  private scheduleRoomTimer(room: RoomSnapshot) {
    this.clearRoomTimer(room.code);

    if (
      room.phase === "waiting" ||
      room.phase === "closed" ||
      room.phaseEndsAt === null
    ) {
      return;
    }

    const delay = Math.max(room.phaseEndsAt - Date.now(), 0);
    const expectedPhaseEndsAt = room.phaseEndsAt;

    const timer = setTimeout(() => {
      void this.advanceRoomFromTimer(room.code, expectedPhaseEndsAt);
    }, delay);

    this.roomTimers.set(room.code, timer);
  }

  private async advanceRoomFromTimer(code: string, expectedPhaseEndsAt: number) {
    const currentRoom = await this.getRoom(code);
    if (
      !currentRoom ||
      currentRoom.phase === "waiting" ||
      currentRoom.phase === "closed" ||
      currentRoom.phaseEndsAt !== expectedPhaseEndsAt
    ) {
      return;
    }

    const advancedRoom = advancePhaseFromTimeout(
      currentRoom as RoomState,
      Date.now(),
    );

    await this.saveRoom(
      {
        ...advancedRoom,
        code: currentRoom.code,
      },
      { source: "timer" },
    );
  }

  private shouldRunAi(room: RoomSnapshot) {
    return (
      room.phase === "discussion" ||
      room.phase === "tiebreak_discussion" ||
      room.phase === "voting" ||
      room.phase === "tiebreak_voting"
    );
  }

  private scheduleAiTurn(code: string, version: number) {
    const jobKey = `${code}:${version}`;
    const launchAiJob = async () => {
      const currentRoom = await this.getRoom(code);
      if (!currentRoom || this.roomVersions.get(code) !== version) {
        this.pendingAiTimers.delete(jobKey);
        this.pendingAiJobs.delete(jobKey);
        return;
      }

      const delayMs = this.allAliveHumanVotesAreSubmitted(currentRoom)
        ? 0
        : calculateAiTurnDelayMs(currentRoom as RoomSnapshot & RoomState, {
            now: Date.now(),
          });

      const existingTimer = this.pendingAiTimers.get(jobKey);
      if (existingTimer) {
        if (delayMs > 0) {
          return;
        }

        clearTimeout(existingTimer);
        this.pendingAiTimers.delete(jobKey);
      } else if (this.pendingAiJobs.has(jobKey)) {
        return;
      } else {
        this.pendingAiJobs.add(jobKey);
      }

      const timer = setTimeout(() => {
        this.pendingAiTimers.delete(jobKey);
        void this.runAiTurn(code, version, jobKey);
      }, delayMs);

      this.pendingAiTimers.set(jobKey, timer);
    };

    void launchAiJob();
  }

  private async runAiTurn(code: string, version: number, jobKey: string) {
    try {
      const currentRoom = await this.getRoom(code);
      if (
        !currentRoom ||
        this.roomVersions.get(code) !== version ||
        !this.shouldRunAi(currentRoom)
      ) {
        return;
      }

      const currentPhaseState = this.aiPhaseStates.get(code);
      const { room: aiRoom, phaseState } = await this.roomAiRuntime.run(
        currentRoom as RoomSnapshot & RoomState,
        currentPhaseState,
      );

      if (this.roomVersions.get(code) !== version) {
        return;
      }

      this.aiPhaseStates.set(code, phaseState);

      if (aiRoom !== currentRoom) {
        const nextRoom =
          this.allAliveVotesAreSubmitted(aiRoom)
            ? {
                ...closeVotingPhase(aiRoom as RoomState, Date.now()),
                code: aiRoom.code,
              }
            : aiRoom;
        await this.saveRoom(nextRoom, { source: "ai" });
      }
    } finally {
      const pendingTimer = this.pendingAiTimers.get(jobKey);
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        this.pendingAiTimers.delete(jobKey);
      }
      this.pendingAiJobs.delete(jobKey);
    }
  }

  async createRoom(input: CreateRoomInput) {
    let code = generateRoomCode();
    while (await this.getRoom(code)) {
      code = generateRoomCode();
    }

    const room = ensureHostSeatIsHuman(
      buildInitialRoomState({
        ...input,
        hostSeatId: HOST_SEAT_ID,
      }),
    );
    const snapshot: RoomSnapshot = {
      code,
      ...room,
      phase: "waiting",
    };

    await this.writeRoomSnapshot(cloneRoomSnapshot(snapshot));
    this.roomVersions.set(code, 1);

    return cloneRoomSnapshot(snapshot);
  }

  async getRoom(code: string) {
    const room = await this.readRoomSnapshot(normalizeRoomCode(code));
    return room ? cloneRoomSnapshot(room) : undefined;
  }

  async saveRoom(
    room: RoomSnapshot,
    options?: { source?: "ai" | "timer" | "user" },
  ) {
    const code = normalizeRoomCode(room.code);
    const snapshot: RoomSnapshot = {
      ...room,
      code,
    };
    const storedSnapshot = cloneRoomSnapshot(snapshot);
    const nextVersion = (this.roomVersions.get(code) ?? 0) + 1;

    await this.writeRoomSnapshot(storedSnapshot);
    this.roomVersions.set(code, nextVersion);
    this.scheduleRoomTimer(storedSnapshot);
    if (options?.source !== "ai" && this.shouldRunAi(storedSnapshot)) {
      this.scheduleAiTurn(code, nextVersion);
    }

    return cloneRoomSnapshot(storedSnapshot);
  }

  async joinRoom(code: string) {
    const room = await this.getRoom(code);
    if (!room) {
      throw new RoomStoreError("ROOM_NOT_FOUND");
    }
    if (room.phase === "closed") {
      throw new RoomStoreError("ROOM_CLOSED");
    }

    const seatToConnect = room.seats.find(
      (seat) => seat.role === "human" && !seat.connected,
    );
    if (!seatToConnect) {
      throw new RoomStoreError("ROOM_FULL");
    }

    return this.saveRoom({
      ...room,
      seats: room.seats.map((seat) =>
        seat.id === seatToConnect.id ? { ...seat, connected: true } : seat,
      ),
    });
  }

  async leaveRoom(code: string, seatId: string) {
    const room = await this.getRoom(code);
    if (!room) {
      throw new RoomStoreError("ROOM_NOT_FOUND");
    }
    if (room.phase === "closed") {
      throw new RoomStoreError("ROOM_CLOSED");
    }

    const seatToDisconnect = room.seats.find(
      (seat) => seat.id === seatId && seat.role === "human",
    );
    if (!seatToDisconnect) {
      throw new RoomStoreError("ROOM_NOT_FOUND");
    }

    if (!seatToDisconnect.connected) {
      return room;
    }

    return this.saveRoom({
      ...room,
      seats: room.seats.map((seat) =>
        seat.id === seatToDisconnect.id ? { ...seat, connected: false } : seat,
      ),
    });
  }

  async closeRoom(code: string) {
    const room = await this.getRoom(code);
    if (!room) {
      throw new RoomStoreError("ROOM_NOT_FOUND");
    }
    if (room.phase === "closed") {
      return room;
    }
    if (room.phase !== "waiting") {
      throw new RoomStoreError("ROOM_NOT_WAITING");
    }

    this.aiPhaseStates.delete(room.code);
    return this.saveRoom({
      ...room,
      phase: "closed",
      phaseEndsAt: null,
      votes: {},
      tieSeatIds: [],
      messages: [
        ...room.messages,
        {
          id: `system-room-closed-${Date.now()}`,
          kind: "system",
          text: "房主已解散房间。",
          createdAt: Date.now(),
        },
      ],
    });
  }

  async restartRoom(code: string) {
    const room = await this.getRoom(code);
    if (!room) {
      throw new RoomStoreError("ROOM_NOT_FOUND");
    }
    if (room.phase === "closed") {
      throw new RoomStoreError("ROOM_CLOSED");
    }
    if (room.phase !== "finished") {
      throw new RoomStoreError("ROOM_NOT_FINISHED");
    }

    const connectedHumanSeatIds = new Set(
      room.seats
        .filter((seat) => seat.role === "human" && seat.connected)
        .map((seat) => seat.id),
    );

    const nextRoom = ensureHostSeatIsHuman(
      buildInitialRoomState({
        ...room.config,
        hostSeatId: room.hostSeatId,
      }),
    );

    this.aiPhaseStates.delete(room.code);

    return this.saveRoom({
      code: room.code,
      ...nextRoom,
      phase: "waiting",
      seats: nextRoom.seats.map((seat) =>
        seat.role === "human"
          ? {
              ...seat,
              connected: connectedHumanSeatIds.has(seat.id),
            }
          : seat,
      ),
    });
  }
}

export type RoomStore = BaseRoomStore;

export class InMemoryRoomStore extends BaseRoomStore {
  private rooms = new Map<string, RoomSnapshot>();

  protected async readRoomSnapshot(code: string) {
    const room = this.rooms.get(normalizeRoomCode(code));
    return room ? cloneRoomSnapshot(room) : undefined;
  }

  protected async writeRoomSnapshot(room: RoomSnapshot) {
    this.rooms.set(room.code, cloneRoomSnapshot(room));
  }
}

export class RedisRoomStore extends BaseRoomStore {
  private getRoomKey(code: string) {
    return `room:${normalizeRoomCode(code)}`;
  }

  protected async readRoomSnapshot(code: string) {
    const redis = await getRedisClient();
    const rawValue = await redis.get(this.getRoomKey(code));
    if (!rawValue) {
      return undefined;
    }

    return JSON.parse(rawValue) as RoomSnapshot;
  }

  protected async writeRoomSnapshot(room: RoomSnapshot) {
    const redis = await getRedisClient();
    await redis.set(this.getRoomKey(room.code), JSON.stringify(room), {
      EX: getRoomSnapshotTtlSeconds(room),
    });
  }
}

declare global {
  var __aiSpyRoomStore: BaseRoomStore | undefined;
}

export const roomStore =
  globalThis.__aiSpyRoomStore ??
  (globalThis.__aiSpyRoomStore = isRedisConfigured()
    ? new RedisRoomStore()
    : new InMemoryRoomStore());
