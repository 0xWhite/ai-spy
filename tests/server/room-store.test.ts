import { startRoomAction } from "@/lib/server/room-actions";
import { InMemoryRoomStore, RoomStoreError } from "@/lib/server/room-store";

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
    expect(updatedRoom.seats.find((seat) => seat.id === "seat-2")?.connected).toBe(
      true,
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
      snapshot.seats[1].connected = false;
      snapshot.messages.push({
        id: "listener-mutation",
        kind: "system",
        text: "listener mutation",
        createdAt: 456,
      });
    });

    store.joinRoom(room.code);

    const storedRoom = store.getRoom(room.code);

    expect(storedRoom?.seats[1].connected).toBe(true);
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

  it("settles zero-vote timeout without rescheduling an immediate loop", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-03T00:00:00.000Z"));

    const store = new InMemoryRoomStore();
    const room = store.createRoom({
      totalSeats: 7,
      aiCount: 1,
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

    expect(settledRoom?.phase).toBe("voting");
    expect(settledRoom?.phaseEndsAt).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
