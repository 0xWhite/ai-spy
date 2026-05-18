import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

import { POST as closeRoom } from "@/app/api/rooms/[code]/close/route";
import { POST as createRoom } from "@/app/api/rooms/route";
import { createRoomSeatCookieValue } from "@/lib/server/room-seat-cookie";
import { roomStore } from "@/lib/server/room-store";

function cookieStoreFor(code: string, cookieValue?: string) {
  cookiesMock.mockResolvedValue({
    get: (name: string) =>
      cookieValue && name === `room-${code}-seat` ? { value: cookieValue } : undefined,
    set: vi.fn(),
  });
}

describe("room close route", () => {
  beforeEach(() => {
    cookiesMock.mockReset();
  });

  it("allows the host to close the room", async () => {
    cookieStoreFor("ignored");

    const createResponse = await createRoom(
      new Request("http://localhost/api/rooms", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          totalSeats: 7,
          aiCount: 1,
          roundOneSeconds: 300,
          roundSeconds: 180,
        }),
      }),
    );
    const room = await createResponse.json();

    cookieStoreFor(room.code, createRoomSeatCookieValue(room.code, "seat-1"));

    const response = await closeRoom(
      new Request(`http://localhost/api/rooms/${room.code}/close`, {
        method: "POST",
      }),
      {
        params: Promise.resolve({
          code: room.code,
        }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        code: room.code,
        phase: "closed",
      }),
    );
    await expect(roomStore.getRoom(room.code)).resolves.toEqual(
      expect.objectContaining({
        phase: "closed",
      }),
    );
  });

  it("rejects closing a room when the bound seat is not the host", async () => {
    const room = await roomStore.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
    });

    await roomStore.joinRoom(room.code);
    cookieStoreFor(room.code, createRoomSeatCookieValue(room.code, "seat-3"));

    const response = await closeRoom(
      new Request(`http://localhost/api/rooms/${room.code}/close`, {
        method: "POST",
      }),
      {
        params: Promise.resolve({
          code: room.code,
        }),
      },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "SEAT_NOT_HOST",
    });
  });
});
