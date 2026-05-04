import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookiesMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

import { POST as createRoom } from "@/app/api/rooms/route";
import { POST as joinRoom } from "@/app/api/rooms/[code]/join/route";
import { POST as startRoom } from "@/app/api/rooms/[code]/start/route";
import { POST as postMessage } from "@/app/api/rooms/[code]/message/route";
import { POST as postVote } from "@/app/api/rooms/[code]/vote/route";
import { GET as getSnapshot } from "@/app/api/rooms/[code]/snapshot/route";
import { roomStore } from "@/lib/server/room-store";

function cookieStoreFor(code: string, seatId?: string) {
  const set = vi.fn();

  cookiesMock.mockResolvedValue({
    get: (name: string) =>
      seatId && name === `room-${code}-seat` ? { value: seatId } : undefined,
    set,
  });

  return {
    set,
  };
}

describe("room seat binding routes", () => {
  beforeEach(() => {
    cookiesMock.mockReset();
  });

  it("binds the host seat cookie when creating a room", async () => {
    const { set } = cookieStoreFor("ignored");

    const response = await createRoom(
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

    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(set).toHaveBeenCalledWith(
      `room-${payload.code}-seat`,
      "seat-1",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
      }),
    );
  });

  it("binds the joined human seat cookie when taking a seat", async () => {
    const room = roomStore.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
    });
    const { set } = cookieStoreFor(room.code);

    const response = await joinRoom(
      new Request(`http://localhost/api/rooms/${room.code}/join`, {
        method: "POST",
      }),
      {
        params: Promise.resolve({
          code: room.code,
        }),
      },
    );

    const payload = await response.json();

    expect(payload.seats.find((seat: { id: string }) => seat.id === "seat-3")).toEqual(
      expect.objectContaining({
        connected: true,
      }),
    );
    expect(set).toHaveBeenCalledWith(
      `room-${room.code}-seat`,
      "seat-3",
      expect.objectContaining({
        httpOnly: true,
      }),
    );
  });

  it("rejects starting a room when the bound seat is not the host", async () => {
    const room = roomStore.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
    });

    roomStore.joinRoom(room.code);
    cookieStoreFor(room.code, "seat-3");

    const response = await startRoom(
      new Request(`http://localhost/api/rooms/${room.code}/start`, {
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

  it("uses the cookie-bound seat for messages instead of trusting the JSON seatId", async () => {
    const room = roomStore.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
    });

    roomStore.joinRoom(room.code);
    roomStore.saveRoom({
      ...roomStore.getRoom(room.code)!,
      phase: "discussion",
      round: 1,
      phaseEndsAt: Date.now() + 30_000,
    });
    cookieStoreFor(room.code, "seat-3");

    const response = await postMessage(
      new Request(`http://localhost/api/rooms/${room.code}/message`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          seatId: "seat-1",
          text: "我其实是 seat-2",
        }),
      }),
      {
        params: Promise.resolve({
          code: room.code,
        }),
      },
    );

    const payload = await response.json();
    const playerMessages = payload.messages.filter(
      (message: { kind: string }) => message.kind === "player",
    );

    expect(playerMessages.at(-1)).toEqual(
      expect.objectContaining({
        seatId: "seat-3",
        text: "我其实是 seat-2",
      }),
    );
  });

  it("uses the cookie-bound seat for votes instead of trusting the JSON voterSeatId", async () => {
    const room = roomStore.createRoom({
      totalSeats: 7,
      aiCount: 0,
      roundOneSeconds: 300,
      roundSeconds: 180,
      voteSeconds: 60,
    });

    roomStore.joinRoom(room.code);
    roomStore.saveRoom({
      ...roomStore.getRoom(room.code)!,
      phase: "voting",
      round: 1,
      phaseEndsAt: Date.now() + 60_000,
      votes: {},
    });
    cookieStoreFor(room.code, "seat-2");

    const response = await postVote(
      new Request(`http://localhost/api/rooms/${room.code}/vote`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          voterSeatId: "seat-1",
          targetSeatId: "seat-3",
        }),
      }),
      {
        params: Promise.resolve({
          code: room.code,
        }),
      },
    );

    const payload = await response.json();

    expect(payload.selfVoteTargetId).toBe("seat-3");
    expect(payload).not.toHaveProperty("votes");
  });

  it("redacts active vote maps from room snapshots while preserving the viewer's own vote", async () => {
    const room = roomStore.createRoom({
      totalSeats: 7,
      aiCount: 0,
      roundOneSeconds: 300,
      roundSeconds: 180,
      voteSeconds: 60,
    });

    roomStore.joinRoom(room.code);
    roomStore.saveRoom({
      ...roomStore.getRoom(room.code)!,
      phase: "voting",
      round: 1,
      phaseEndsAt: Date.now() + 60_000,
      votes: {
        "seat-1": "seat-2",
        "seat-2": "seat-3",
      },
    });
    cookieStoreFor(room.code, "seat-2");

    const response = await getSnapshot(
      new Request(`http://localhost/api/rooms/${room.code}/snapshot`),
      {
        params: Promise.resolve({
          code: room.code,
        }),
      },
    );

    const payload = await response.json();

    expect(payload.selfVoteTargetId).toBe("seat-3");
    expect(payload).not.toHaveProperty("votes");
  });
});
