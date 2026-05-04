import { afterEach, describe, expect, it, vi } from "vitest";
import { startRoomAction } from "@/lib/server/room-actions";
import { AiRuntime } from "@/lib/server/ai/runtime";
import {
  InMemoryRoomStore,
  RoomStoreError,
  toClientRoomSnapshot,
} from "@/lib/server/room-store";

describe("room store", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("createRoom returns an initial waiting snapshot with a 6-character code", () => {
    const store = new InMemoryRoomStore();

    const room = store.createRoom({
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

  it("broadcasts to room subscribers when a player joins", () => {
    const store = new InMemoryRoomStore();
    const room = store.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
    });
    const listener = vi.fn();

    const unsubscribe = store.subscribe(room.code, listener);
    const updatedRoom = store.joinRoom(room.code);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(updatedRoom);
    expect(updatedRoom.seats.find((seat) => seat.id === "seat-3")?.connected).toBe(
      true,
    );
    expect(updatedRoom.seats.find((seat) => seat.id === "seat-2")?.connected).toBe(
      false,
    );

    unsubscribe();
  });

  it("does not allow external room mutations to corrupt stored state", () => {
    const store = new InMemoryRoomStore();
    const room = store.createRoom({
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

    const storedRoom = store.getRoom(room.code);

    expect(storedRoom?.seats[0].connected).toBe(true);
    expect(storedRoom?.messages).toEqual([]);
  });

  it("does not let subscriber mutations leak back into the store", () => {
    const store = new InMemoryRoomStore();
    const room = store.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
    });

    const unsubscribe = store.subscribe(room.code, (snapshot) => {
      snapshot.seats[2].connected = false;
      snapshot.messages.push({
        id: "listener-mutation",
        kind: "system",
        text: "listener mutation",
        createdAt: 456,
      });
    });

    store.joinRoom(room.code);

    const storedRoom = store.getRoom(room.code);

    expect(storedRoom?.seats[2].connected).toBe(true);
    expect(storedRoom?.messages).toEqual([]);

    unsubscribe();
  });

  it("isolates listener failures while still notifying later listeners", () => {
    const store = new InMemoryRoomStore();
    const room = store.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
    });
    const healthyListener = vi.fn();

    store.subscribe(room.code, () => {
      throw new Error("listener failed");
    });
    store.subscribe(room.code, healthyListener);

    expect(() => store.joinRoom(room.code)).not.toThrow();
    expect(healthyListener).toHaveBeenCalledTimes(1);
  });

  it("rejects starting a room that is no longer waiting", () => {
    const store = new InMemoryRoomStore();
    const room = store.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
    });

    startRoomAction(room.code, 1_700_000_000_000, store);

    expect(() => startRoomAction(room.code, 1_700_000_000_001, store)).toThrow(
      new RoomStoreError("ROOM_NOT_WAITING"),
    );
  });

  it("advances and persists a room when the phase timer expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-03T00:00:00.000Z"));

    const store = new InMemoryRoomStore();
    const room = store.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 1,
      roundSeconds: 180,
      voteSeconds: 30,
    });

    startRoomAction(room.code, Date.now(), store);

    await vi.advanceTimersByTimeAsync(1_000);

    const advancedRoom = store.getRoom(room.code);

    expect(advancedRoom?.phase).toBe("voting");
    expect(advancedRoom?.phaseEndsAt).toBe(Date.now() + 30_000);
    expect(advancedRoom?.messages.at(-1)).toMatchObject({
      kind: "system",
      text: "讨论结束，进入投票阶段",
    });
  });

  it("settles zero-vote timeout into tiebreak discussion without rescheduling an immediate loop", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-03T00:00:00.000Z"));

    const store = new InMemoryRoomStore();
    const room = store.createRoom({
      totalSeats: 7,
      aiCount: 0,
      roundOneSeconds: 300,
      roundSeconds: 180,
      voteSeconds: 30,
    });
    const listener = vi.fn();

    store.subscribe(room.code, listener);
    store.saveRoom({
      ...room,
      phase: "voting",
      phaseEndsAt: Date.now() + 1_000,
      votes: {},
    });

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(10_000);

    const settledRoom = store.getRoom(room.code);

    expect(settledRoom?.phase).toBe("tiebreak_discussion");
    expect(settledRoom?.tieSeatIds).toEqual([
      "seat-1",
      "seat-2",
      "seat-3",
      "seat-4",
      "seat-5",
      "seat-6",
      "seat-7",
    ]);
    expect(settledRoom?.phaseEndsAt).toBe(Date.now() + 50_000);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("runs AI discussion turns once per phase without recursive resaves", async () => {
    const store = new InMemoryRoomStore();
    const room = store.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
    });

    startRoomAction(room.code, 1_700_000_000_000, store);

    await vi.waitFor(() => {
      expect(
        store
          .getRoom(room.code)
          ?.messages.filter((message) => message.kind === "player"),
      ).toHaveLength(1);
    });

    const afterAiTurn = store.getRoom(room.code);

    expect(afterAiTurn?.messages).toContainEqual(
      expect.objectContaining({
        kind: "player",
        seatId: "seat-2",
      }),
    );

    store.saveRoom(afterAiTurn!);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(
      store
        .getRoom(room.code)
        ?.messages.filter((message) => message.kind === "player"),
    ).toHaveLength(1);
  });

  it("runs AI voting turns once and records AI votes", async () => {
    const store = new InMemoryRoomStore();
    const room = store.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
      voteSeconds: 60,
    });

    store.saveRoom({
      ...room,
      phase: "voting",
      phaseEndsAt: Date.now() + 60_000,
    });

    await vi.waitFor(() => {
      expect(store.getRoom(room.code)?.votes).toMatchObject({
        "seat-2": expect.any(String),
      });
    });

    const afterAiVote = store.getRoom(room.code);

    store.saveRoom(afterAiVote!);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(store.getRoom(room.code)?.votes).toEqual(afterAiVote?.votes);
  });

  it("drops stale AI output and still runs AI for a newer phase", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-03T00:00:00.000Z"));

    let resolveDiscussionMessage: ((value: string | null) => void) | null = null;
    let chooseVoteCalls = 0;

    const store = new InMemoryRoomStore(
      undefined,
      new AiRuntime({
        generateMessage: () =>
          new Promise((resolve) => {
            resolveDiscussionMessage = resolve;
          }),
        chooseVote: async () => {
          chooseVoteCalls += 1;
          return "seat-1";
        },
      }),
    );
    const room = store.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
      voteSeconds: 60,
    });

    startRoomAction(room.code, Date.now(), store);

    await vi.waitFor(() => {
      expect(resolveDiscussionMessage).not.toBeNull();
    });

    const discussionRoom = store.getRoom(room.code)!;
    store.saveRoom({
      ...discussionRoom,
      phase: "voting",
      votes: {},
      phaseEndsAt: Date.now() + 60_000,
    });

    const discussionResolver = resolveDiscussionMessage!;
    discussionResolver("过期的讨论发言");
    await vi.advanceTimersByTimeAsync(0);

    await vi.waitFor(() => {
      expect(chooseVoteCalls).toBe(1);
      expect(store.getRoom(room.code)?.votes).toMatchObject({
        "seat-2": "seat-1",
      });
    });

    const settledRoom = store.getRoom(room.code)!;

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

  it("redacts hidden seat roles before the game result exists", () => {
    const store = new InMemoryRoomStore();
    const room = store.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
    });

    const clientRoom = toClientRoomSnapshot(room);

    expect(clientRoom.seats[0]).not.toHaveProperty("role");
  });

  it("keeps seat roles in the client snapshot after the game finishes", () => {
    const store = new InMemoryRoomStore();
    const room = store.saveRoom({
      ...store.createRoom({
        totalSeats: 7,
        aiCount: 1,
        roundOneSeconds: 300,
        roundSeconds: 180,
      }),
      phase: "finished",
      result: { winner: "human" },
    });

    const clientRoom = toClientRoomSnapshot(room);

    expect(clientRoom.seats[0]).toHaveProperty("role");
  });

  it("redacts active vote maps from client snapshots while preserving the viewer's own vote", () => {
    const store = new InMemoryRoomStore();
    const room = store.saveRoom({
      ...store.createRoom({
        totalSeats: 7,
        aiCount: 0,
        roundOneSeconds: 300,
        roundSeconds: 180,
        voteSeconds: 60,
      }),
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
