import { afterEach, describe, expect, it, vi } from "vitest";
import { startRoomAction } from "@/lib/server/room-actions";
import { AiRuntime } from "@/lib/server/ai/runtime";
import { toClientRoomSnapshot } from "@/lib/room-snapshot";
import {
  InMemoryRoomStore,
  RoomStoreError,
} from "@/lib/server/room-store";

async function getRequiredRoom(
  store: InMemoryRoomStore,
  code: string,
) {
  const room = await store.getRoom(code);
  expect(room).toBeDefined();
  return room!;
}

describe("room store", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("createRoom returns an initial waiting snapshot with a 6-character code", async () => {
    const store = new InMemoryRoomStore();

    const room = await store.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
    });

    expect(room.code).toMatch(/^[A-Z]{6}$/);
    expect(room.phase).toBe("waiting");
    expect(room.hostSeatId).toBe("seat-1");
    expect(room.seats.find((seat) => seat.id === "seat-1")).toMatchObject({
      connected: true,
      isHost: true,
      role: "human",
    });
    expect(room.seats.filter((seat) => seat.role === "ai")).toHaveLength(1);
    expect(room.seats.find((seat) => seat.id === "seat-2")?.role).toBe("ai");
  });

  it("joinRoom connects the next available human seat", async () => {
    const store = new InMemoryRoomStore();
    const room = await store.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
    });

    const updatedRoom = await store.joinRoom(room.code);

    expect(updatedRoom.seats.find((seat) => seat.id === "seat-3")).toMatchObject({
      connected: true,
      role: "human",
    });
    expect(updatedRoom.seats.find((seat) => seat.id === "seat-2")).toMatchObject({
      connected: false,
      role: "ai",
    });
  });

  it("does not allow external room mutations to corrupt stored state", async () => {
    const store = new InMemoryRoomStore();
    const room = await store.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
    });

    room.seats[0].connected = false;
    room.messages.push({
      id: "mutated",
      kind: "system",
      text: "mutated",
      createdAt: 123,
    });

    const storedRoom = await store.getRoom(room.code);

    expect(storedRoom?.seats[0].connected).toBe(true);
    expect(storedRoom?.messages).toEqual([]);
  });

  it("does not let saved snapshot mutations leak back into the store", async () => {
    const store = new InMemoryRoomStore();
    const room = await store.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
    });

    const joinedRoom = await store.joinRoom(room.code);
    joinedRoom.seats[2].connected = false;
    joinedRoom.messages.push({
      id: "listener-mutation",
      kind: "system",
      text: "listener mutation",
      createdAt: 456,
    });

    const storedRoom = await store.getRoom(room.code);

    expect(storedRoom?.seats[2].connected).toBe(true);
    expect(storedRoom?.messages).toEqual([]);
  });

  it("rejects starting a room that is no longer waiting", async () => {
    const store = new InMemoryRoomStore();
    const room = await store.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
    });

    await startRoomAction(room.code, Date.now(), store);

    await expect(
      startRoomAction(room.code, 1_700_000_000_001, store),
    ).rejects.toMatchObject({
      code: "ROOM_NOT_WAITING",
    } satisfies Pick<RoomStoreError, "code">);
  });

  it("advances and persists a room when the phase timer expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-03T00:00:00.000Z"));

    const store = new InMemoryRoomStore();
    const room = await store.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 1,
      roundSeconds: 180,
      voteSeconds: 30,
    });

    await startRoomAction(room.code, Date.now(), store);
    await vi.advanceTimersByTimeAsync(1_000);

    const advancedRoom = await getRequiredRoom(store, room.code);

    expect(advancedRoom.phase).toBe("voting");
    expect(advancedRoom.phaseEndsAt).toBe(Date.now() + 30_000);
    expect(advancedRoom.messages.at(-1)).toMatchObject({
      kind: "system",
      text: "讨论结束，进入投票阶段",
    });
  });

  it("settles zero-vote timeout into tiebreak discussion without looping immediately", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-03T00:00:00.000Z"));

    const store = new InMemoryRoomStore();
    const room = await store.createRoom({
      totalSeats: 7,
      aiCount: 0,
      roundOneSeconds: 300,
      roundSeconds: 180,
      voteSeconds: 30,
    });

    await store.saveRoom({
      ...room,
      phase: "voting",
      phaseEndsAt: Date.now() + 1_000,
      votes: {},
    });

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(10_000);

    const settledRoom = await getRequiredRoom(store, room.code);

    expect(settledRoom.phase).toBe("tiebreak_discussion");
    expect(settledRoom.tieSeatIds).toEqual([
      "seat-1",
      "seat-2",
      "seat-3",
      "seat-4",
      "seat-5",
      "seat-6",
      "seat-7",
    ]);
    expect(settledRoom.phaseEndsAt).toBe(Date.now() + 50_000);
  });

  it("does not recursively trigger extra AI discussion turns when re-saving the same room snapshot", async () => {
    const store = new InMemoryRoomStore(
      new AiRuntime({
        generateMessage: async () => "我先观察一下。",
        chooseVote: async () => null,
      }),
    );
    const room = await store.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
    });

    const startedRoom = await startRoomAction(room.code, 1_700_000_000_000, store);
    const roomWithAiMessage = await store.saveRoom({
      ...startedRoom,
      messages: [
        ...startedRoom.messages,
        {
          id: "msg-ai-opening",
          kind: "player",
          seatId: "seat-2",
          text: "我先观察一下。",
          createdAt: 1_700_000_000_100,
        },
      ],
    });

    const playerMessageCount = roomWithAiMessage.messages.filter(
      (message) => message.kind === "player",
    ).length;

    await store.saveRoom(roomWithAiMessage);

    const savedAgain = await getRequiredRoom(store, room.code);
    expect(
      savedAgain.messages.filter((message) => message.kind === "player"),
    ).toHaveLength(playerMessageCount);
  });

  it("runs AI voting turns once and records AI votes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-03T00:00:00.000Z"));

    const store = new InMemoryRoomStore();
    const room = await store.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
      voteSeconds: 60,
    });

    await store.saveRoom({
      ...room,
      phase: "voting",
      phaseEndsAt: Date.now() + 60_000,
    });
    await vi.advanceTimersByTimeAsync(5_000);

    await vi.waitFor(async () => {
      const currentRoom = await store.getRoom(room.code);
      expect(currentRoom?.votes).toMatchObject({
        "seat-2": expect.any(String),
      });
    });

    const afterAiVote = await getRequiredRoom(store, room.code);
    await store.saveRoom(afterAiVote);
    await vi.advanceTimersByTimeAsync(5_000);

    const savedAgain = await getRequiredRoom(store, room.code);
    expect(savedAgain.votes).toEqual(afterAiVote.votes);
  });

  it("immediately lets AI finish voting and settles the phase once all human votes are in", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-05T00:00:00.000Z"));

    const store = new InMemoryRoomStore(
      new AiRuntime({
        generateMessage: async () => null,
        chooseVote: async () => "seat-1",
      }),
    );
    const room = await store.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
      voteSeconds: 60,
    });

    const startedRoom = await startRoomAction(room.code, Date.now(), store);
    const votingRoom = await store.saveRoom({
      ...startedRoom,
      phase: "voting",
      votes: {
        "seat-1": "seat-3",
        "seat-3": "seat-1",
      },
      phaseEndsAt: Date.now() + 60_000,
    });

    await vi.advanceTimersByTimeAsync(0);
    await vi.waitFor(async () => {
      const currentRoom = await store.getRoom(votingRoom.code);
      expect(currentRoom?.phase).toBe("finished");
    });

    const settledRoom = await getRequiredRoom(store, votingRoom.code);

    expect(settledRoom.phase).toBe("finished");
    expect(settledRoom.votes).toEqual({});
    expect(settledRoom.eliminatedSeatIds).toEqual(["seat-1"]);
    expect(settledRoom.result?.winner).toBe("ai");
    expect(settledRoom.messages.at(-1)).toMatchObject({
      kind: "system",
    });
    expect(settledRoom.messages.at(-1)?.text).toContain("投票结果：");
    expect(settledRoom.messages.at(-1)?.text).toContain("出局。");
  });

  it("expedites a previously delayed AI vote as soon as all human votes are submitted", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-05T00:00:00.000Z"));

    const store = new InMemoryRoomStore(
      new AiRuntime({
        generateMessage: async () => null,
        chooseVote: async () => "seat-1",
      }),
    );
    const room = await store.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
      voteSeconds: 60,
    });

    const startedRoom = await startRoomAction(room.code, Date.now(), store);
    await store.saveRoom({
      ...startedRoom,
      phase: "voting",
      votes: {},
      phaseEndsAt: Date.now() + 60_000,
    });

    await store.saveRoom({
      ...(await getRequiredRoom(store, room.code)),
      phase: "voting",
      votes: {
        "seat-1": "seat-3",
        "seat-3": "seat-1",
      },
      phaseEndsAt: Date.now() + 60_000,
    });

    await vi.advanceTimersByTimeAsync(0);
    await vi.waitFor(async () => {
      const currentRoom = await store.getRoom(room.code);
      expect(currentRoom?.phase).toBe("finished");
    });

    const settledRoom = await getRequiredRoom(store, room.code);
    expect(settledRoom.result?.winner).toBe("ai");
    expect(settledRoom.votes).toEqual({});
    expect(settledRoom.messages.at(-1)?.text).toContain("投票结果：");
  });

  it("drops stale AI output and still runs AI for a newer phase", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-03T00:00:00.000Z"));

    let resolveDiscussionMessage: ((value: string | null) => void) | null = null;
    let chooseVoteCalls = 0;

    const store = new InMemoryRoomStore(
      new AiRuntime({
        generateMessage: () =>
          new Promise((resolve) => {
            resolveDiscussionMessage = resolve;
          }),
        chooseVote: async () => {
          chooseVoteCalls += 1;
          return "seat-1";
        },
      }, {
        random: () => 0.1,
      }),
    );
    const room = await store.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
      voteSeconds: 60,
    });

    await startRoomAction(room.code, Date.now(), store);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(12_000);

    await vi.waitFor(() => {
      expect(resolveDiscussionMessage).not.toBeNull();
    });

    const discussionRoom = await getRequiredRoom(store, room.code);
    await store.saveRoom({
      ...discussionRoom,
      phase: "voting",
      votes: {},
      phaseEndsAt: Date.now() + 60_000,
    });

    resolveDiscussionMessage!("过期的讨论发言");
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(5_000);

    await vi.waitFor(async () => {
      expect(chooseVoteCalls).toBe(1);
      const currentRoom = await store.getRoom(room.code);
      expect(currentRoom?.votes).toMatchObject({
        "seat-2": "seat-1",
      });
    });

    const settledRoom = await getRequiredRoom(store, room.code);

    expect(settledRoom.phase).toBe("voting");
    expect(settledRoom.votes).toMatchObject({
      "seat-2": "seat-1",
    });
    expect(
      settledRoom.messages.some(
        (message) =>
          message.kind === "player" && message.text === "过期的讨论发言",
      ),
    ).toBe(false);
  });

  it("redacts hidden seat roles before the game result exists", async () => {
    const store = new InMemoryRoomStore();
    const room = await store.createRoom({
      totalSeats: 7,
      aiCount: 2,
      roundOneSeconds: 300,
      roundSeconds: 180,
    });

    const clientRoom = toClientRoomSnapshot(room);

    expect(clientRoom.seats).toHaveLength(5);
    expect(clientRoom.seats.map((seat) => seat.id)).toEqual([
      "seat-1",
      "seat-4",
      "seat-5",
      "seat-6",
      "seat-7",
    ]);
    expect(clientRoom.seats[0]).not.toHaveProperty("color");
    expect(clientRoom.seats[0]).not.toHaveProperty("number");
    expect(clientRoom.seats[0]).not.toHaveProperty("role");
  });

  it("keeps seat roles in the client snapshot after the game finishes", async () => {
    const store = new InMemoryRoomStore();
    const createdRoom = await store.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
    });
    const room = await store.saveRoom({
      ...createdRoom,
      phase: "finished",
      result: { winner: "human" },
    });

    const clientRoom = toClientRoomSnapshot(room);

    expect(clientRoom.seats[0]).toHaveProperty("role");
    expect(clientRoom.seats[0]).not.toHaveProperty("isHost");
  });

  it("restarts a finished room back to waiting while preserving connected human seats", async () => {
    const store = new InMemoryRoomStore();
    const createdRoom = await store.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
    });
    const joinedRoom = await store.joinRoom(createdRoom.code);
    const finishedRoom = await store.saveRoom({
      ...joinedRoom,
      phase: "finished",
      result: { winner: "human" },
      seats: joinedRoom.seats
        .filter((seat) => seat.role === "human" && (seat.id === "seat-1" || seat.id === "seat-3"))
        .map((seat, index) => ({
          ...seat,
          number: index + 1,
          color: index === 0 ? "red" : "green",
        })),
    });

    const restartedRoom = await store.restartRoom(finishedRoom.code);

    expect(restartedRoom.phase).toBe("waiting");
    expect(restartedRoom.result).toBeNull();
    expect(restartedRoom.round).toBe(0);
    expect(restartedRoom.messages).toEqual([]);
    expect(restartedRoom.seats.find((seat) => seat.id === "seat-1")).toMatchObject({
      role: "human",
      connected: true,
      isHost: true,
    });
    expect(restartedRoom.seats.find((seat) => seat.id === "seat-3")).toMatchObject({
      role: "human",
      connected: true,
    });
    expect(restartedRoom.seats.filter((seat) => seat.role === "ai")).toHaveLength(1);
  });

  it("redacts host identity from client snapshots after the game starts", async () => {
    const store = new InMemoryRoomStore();
    const createdRoom = await store.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
    });
    const startedRoom = await store.saveRoom({
      ...createdRoom,
      phase: "discussion",
      phaseEndsAt: Date.now() + 300_000,
    });

    const clientRoom = toClientRoomSnapshot(startedRoom, "seat-1");

    expect(clientRoom.seats[0]).not.toHaveProperty("isHost");
    expect(clientRoom.seats.some((seat) => "isHost" in seat)).toBe(false);
  });

  it("redacts active vote maps from client snapshots while preserving the viewer's own vote", async () => {
    const store = new InMemoryRoomStore();
    const createdRoom = await store.createRoom({
      totalSeats: 7,
      aiCount: 0,
      roundOneSeconds: 300,
      roundSeconds: 180,
      voteSeconds: 60,
    });
    const room = await store.saveRoom({
      ...createdRoom,
      phase: "voting",
      round: 1,
      phaseEndsAt: Date.now() + 60_000,
      votes: {
        "seat-1": "seat-2",
        "seat-2": "seat-3",
      },
    });

    const clientRoom = toClientRoomSnapshot(room, "seat-2");

    expect(clientRoom).not.toHaveProperty("votes");
    expect(clientRoom.selfVoteTargetId).toBe("seat-3");
  });
});
