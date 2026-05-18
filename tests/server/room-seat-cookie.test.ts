import { afterEach, describe, expect, it, vi } from "vitest";

declare global {
  var __aiSpyRoomSeatCookieSecret: string | undefined;
}

describe("room seat cookie secret", () => {
  const originalSecret = process.env.ROOM_SEAT_COOKIE_SECRET;

  afterEach(() => {
    vi.resetModules();

    if (originalSecret === undefined) {
      delete process.env.ROOM_SEAT_COOKIE_SECRET;
    } else {
      process.env.ROOM_SEAT_COOKIE_SECRET = originalSecret;
    }

    delete globalThis.__aiSpyRoomSeatCookieSecret;
  });

  it("keeps validating cookies across separate module loads when no env secret is configured", async () => {
    delete process.env.ROOM_SEAT_COOKIE_SECRET;
    delete globalThis.__aiSpyRoomSeatCookieSecret;

    const firstModule = await import("@/lib/server/room-seat-cookie");
    const cookieValue = firstModule.createRoomSeatCookieValue("ABCDEF", "seat-1");

    vi.resetModules();

    const secondModule = await import("@/lib/server/room-seat-cookie");
    const seatId = secondModule.getBoundSeatIdFromCookies(
      {
        get: () => ({ value: cookieValue }),
      },
      "ABCDEF",
    );

    expect(seatId).toBe("seat-1");
  });
});
