import { beforeEach, describe, expect, it, vi } from "vitest";
const { getRoomMock, subscribeMock } = vi.hoisted(() => ({
  getRoomMock: vi.fn(),
  subscribeMock: vi.fn(),
}));

vi.mock("@/lib/server/room-store", () => ({
  roomStore: {
    getRoom: getRoomMock,
    subscribe: subscribeMock,
  },
  toClientRoomSnapshot: (room: {
    seats: Array<Record<string, unknown>>;
    phase: string;
    result: unknown;
  }) => ({
    ...room,
    seats:
      room.phase === "finished" && room.result
        ? room.seats
        : room.seats.map((seat) => ({
            id: seat.id,
            status: seat.status,
            color: seat.color,
            connected: seat.connected,
            isHost: seat.isHost,
          })),
  }),
}));

import { GET } from "@/app/api/rooms/[code]/events/route";

function buildRoom(connected: boolean) {
  return {
    code: "ABCDEF",
    phase: "discussion",
    round: 1,
    hostSeatId: "seat-1",
    seats: [
      {
        id: "seat-1",
        role: "human",
        status: "alive",
        color: "red",
        connected,
        isHost: true,
      },
    ],
    votes: {},
    tieSeatIds: [],
    eliminatedSeatIds: [],
    messages: [],
    result: null,
    phaseEndsAt: null,
    config: {
      totalSeats: 7,
      aiCount: 1,
      endgameAliveSeatCount: 3,
      roundOneSeconds: 300,
      roundSeconds: 180,
      voteSeconds: 60,
      tiebreakSeconds: 60,
    },
  };
}

describe("room events route", () => {
  beforeEach(() => {
    getRoomMock.mockReset();
    subscribeMock.mockReset();
  });

  it("streams the latest client-safe snapshot on connect", async () => {
    const staleRoom = buildRoom(false);
    const freshRoom = buildRoom(true);

    getRoomMock.mockReturnValueOnce(staleRoom).mockReturnValueOnce(freshRoom);
    subscribeMock.mockReturnValue(() => {});

    const response = await GET(new Request("http://localhost/api/rooms/ABCDEF/events"), {
      params: Promise.resolve({
        code: "ABCDEF",
      }),
    });

    const reader = response.body?.getReader();
    const firstChunk = await reader?.read();
    const payload = JSON.parse(
      new TextDecoder().decode(firstChunk?.value).replace(/^data:\s*/, "").trim(),
    );

    expect(payload.seats[0]).toEqual(
      expect.objectContaining({
        connected: true,
      }),
    );
    expect(payload.seats[0]).not.toHaveProperty("role");
    expect(getRoomMock).toHaveBeenCalledTimes(2);
    expect(subscribeMock).toHaveBeenCalledTimes(1);
  });
});
