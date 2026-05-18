import { beforeEach, describe, expect, it, vi } from "vitest";
import RoomPage from "@/app/room/[code]/page";
import type { RoomSnapshot } from "@/lib/room-snapshot";
import { createRoomSeatCookieValue } from "@/lib/server/room-seat-cookie";

const {
  cookiesMock,
  notFoundMock,
  redirectMock,
  getRoomMock,
} = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  notFoundMock: vi.fn(),
  redirectMock: vi.fn(),
  getRoomMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));

vi.mock("@/lib/server/room-store", () => ({
  roomStore: {
    getRoom: getRoomMock,
  },
}));

vi.mock("@/lib/room-snapshot", () => ({
  toClientRoomSnapshot: (room: RoomSnapshot) => ({
    ...room,
    seats:
      room.phase === "waiting"
        ? room.seats.map((seat) => ({
            id: seat.id,
            status: seat.status,
            connected: seat.connected,
            isHost: seat.isHost,
          }))
        : room.phase === "finished" && room.result
        ? room.seats
        : room.seats.map((seat) => ({
            id: seat.id,
            status: seat.status,
            number: seat.number,
            color: seat.color,
            connected: seat.connected,
            isHost: seat.isHost,
          })),
  }),
}));

vi.mock("@/components/room-client", () => ({
  RoomClient: (props: unknown) => <div data-room-client-props={JSON.stringify(props)} />,
}));

describe("RoomPage", () => {
  beforeEach(() => {
    cookiesMock.mockReset();
    notFoundMock.mockReset();
    redirectMock.mockReset();
    getRoomMock.mockReset();
  });

  it("reads selfSeatId from the route-param cookie key and passes a client-safe snapshot", async () => {
    const room = {
      code: "ABCDEF",
      phase: "waiting",
      ...({
        round: 0,
        hostSeatId: "seat-1",
        seats: [
          {
            id: "seat-1",
            role: "human",
            status: "alive",
            number: 1,
            color: "red",
            connected: true,
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
      } satisfies Omit<RoomSnapshot, "code" | "phase">),
    } satisfies RoomSnapshot;

    getRoomMock.mockReturnValue(room);
    cookiesMock.mockResolvedValue({
      get: (name: string) =>
        name === "room-ABCDEF-seat"
          ? { value: createRoomSeatCookieValue("ABCDEF", "seat-1") }
          : undefined,
    });

    const result = await RoomPage({
      params: Promise.resolve({
        code: "abcdef",
      }),
    });

    expect(result.props).toEqual(
      expect.objectContaining({
        initialRoom: expect.objectContaining({
          ...room,
          seats: [
            expect.not.objectContaining({
              role: expect.anything(),
            }),
          ],
        }),
        selfSeatId: "seat-1",
      }),
    );
  });

  it("leaves selfSeatId unbound when the seat cookie is missing", async () => {
    const room = {
      code: "ABCDEF",
      phase: "waiting",
      ...({
        round: 0,
        hostSeatId: "seat-1",
        seats: [],
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
      } satisfies Omit<RoomSnapshot, "code" | "phase">),
    } satisfies RoomSnapshot;

    getRoomMock.mockReturnValue(room);
    cookiesMock.mockResolvedValue({
      get: () => undefined,
    });

    await RoomPage({
      params: Promise.resolve({
        code: "ABCDEF",
      }),
    });

    expect(redirectMock).toHaveBeenCalledWith("/?code=ABCDEF&error=seat-required");
  });

  it("leaves selfSeatId unbound when the seat cookie signature was tampered with", async () => {
    const room = {
      code: "ABCDEF",
      phase: "waiting",
      ...({
        round: 0,
        hostSeatId: "seat-1",
        seats: [
          {
            id: "seat-1",
            role: "human",
            status: "alive",
            number: 1,
            color: "red",
            connected: true,
            isHost: true,
          },
          {
            id: "seat-2",
            role: "human",
            status: "alive",
            number: 2,
            color: "blue",
            connected: true,
            isHost: false,
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
      } satisfies Omit<RoomSnapshot, "code" | "phase">),
    } satisfies RoomSnapshot;

    const [version, , signature] = createRoomSeatCookieValue("ABCDEF", "seat-2").split(".");

    getRoomMock.mockReturnValue(room);
    cookiesMock.mockResolvedValue({
      get: (name: string) =>
        name === "room-ABCDEF-seat"
          ? { value: `${version}.seat-1.${signature}` }
          : undefined,
    });

    await RoomPage({
      params: Promise.resolve({
        code: "ABCDEF",
      }),
    });

    expect(redirectMock).toHaveBeenCalledWith("/?code=ABCDEF&error=seat-required");
  });
});
