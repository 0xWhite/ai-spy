import { afterEach, describe, expect, it, vi } from "vitest";

const connectMock = vi.fn();
const getMock = vi.fn();
const setMock = vi.fn();
const createClientMock = vi.fn(() => ({
  connect: connectMock,
  get: getMock,
  set: setMock,
  isOpen: false,
}));

vi.mock("redis", () => ({
  createClient: createClientMock,
}));

describe("getRedisClient", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    delete globalThis.__aiSpyRedisClient;
    delete globalThis.__aiSpyRedisConnectPromise;
  });

  it("retries connecting after an initial connection failure", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("REDIS_URL", "redis://127.0.0.1:6379");

    connectMock
      .mockRejectedValueOnce(new Error("connect failed"))
      .mockResolvedValueOnce(undefined);

    const redisModule = await import("@/lib/server/redis");

    await expect(redisModule.getRedisClient()).rejects.toThrow("connect failed");
    await expect(redisModule.getRedisClient()).resolves.toMatchObject({
      connect: connectMock,
      isOpen: false,
    });

    expect(createClientMock).toHaveBeenCalledTimes(2);
    expect(connectMock).toHaveBeenCalledTimes(2);
  });

  it("writes room snapshots with a phase-specific TTL", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("REDIS_URL", "redis://127.0.0.1:6379");

    connectMock.mockResolvedValue(undefined);
    getMock.mockResolvedValue(null);
    setMock.mockResolvedValue("OK");

    const { RedisRoomStore, getRoomSnapshotTtlSeconds } = await import("@/lib/server/room-store");

    const store = new RedisRoomStore();
    const room = await store.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
    });

    expect(setMock).toHaveBeenLastCalledWith(
      `room:${room.code}`,
      expect.any(String),
      { EX: getRoomSnapshotTtlSeconds(room) },
    );

    await store.saveRoom({
      ...room,
      phase: "closed",
      phaseEndsAt: null,
    });

    expect(setMock).toHaveBeenLastCalledWith(
      `room:${room.code}`,
      expect.any(String),
      { EX: 600 },
    );
  });
});
