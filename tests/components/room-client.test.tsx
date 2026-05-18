import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoomClient } from "@/components/room-client";

const {
  pushMock,
  replaceMock,
  useRouterMock,
  eventSourceInstances,
} = vi.hoisted(() => {
  const pushMock = vi.fn();
  const replaceMock = vi.fn();
  const eventSourceInstances: Array<{
    close: ReturnType<typeof vi.fn>;
    onmessage: ((event: MessageEvent<string>) => void) | null;
    url: string;
  }> = [];

  return {
    pushMock,
    replaceMock,
    useRouterMock: vi.fn(),
    eventSourceInstances,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: useRouterMock,
}));

function buildWaitingSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    code: "ABCDEF",
    phase: "waiting",
    round: 0,
    hostSeatId: "seat-1",
    seats: [
      {
        id: "seat-1",
        status: "alive",
        connected: true,
        isHost: true,
      },
      {
        id: "seat-3",
        status: "alive",
        connected: true,
        isHost: false,
      },
      {
        id: "seat-4",
        status: "alive",
        connected: false,
        isHost: false,
      },
      {
        id: "seat-5",
        status: "alive",
        connected: false,
        isHost: false,
      },
      {
        id: "seat-6",
        status: "alive",
        connected: false,
        isHost: false,
      },
      {
        id: "seat-7",
        status: "alive",
        connected: false,
        isHost: false,
      },
    ],
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
    selfVoteTargetId: null,
    ...overrides,
  };
}

describe("RoomClient", () => {
  function stubEventSource() {
    class MockEventSource {
      onmessage: ((event: MessageEvent<string>) => void) | null = null;
      close = vi.fn();
      url: string;

      constructor(url: string) {
        this.url = url;
        eventSourceInstances.push(this);
      }
    }

    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);
  }

  afterEach(() => {
    pushMock.mockReset();
    replaceMock.mockReset();
    useRouterMock.mockReset();
    eventSourceInstances.length = 0;
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_MIN_CONNECTED_TO_START;
  });

  it("transitions from waiting to discussion after the host starts the game", async () => {
    process.env.NEXT_PUBLIC_MIN_CONNECTED_TO_START = "2";
    stubEventSource();
    useRouterMock.mockReturnValue({
      push: pushMock,
      replace: replaceMock,
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: "ABCDEF",
        phase: "discussion",
        round: 1,
        hostSeatId: "seat-1",
        seats: [
          {
            id: "seat-1",
            status: "alive",
            color: "red",
            number: 1,
            connected: true,
          },
          {
            id: "seat-3",
            status: "alive",
            color: "blue",
            number: 2,
            connected: true,
          },
          {
            id: "seat-2",
            status: "alive",
            color: "green",
            number: 3,
            connected: true,
          },
        ],
        tieSeatIds: [],
        eliminatedSeatIds: [],
        messages: [
          {
            id: "system-1",
            kind: "system",
            text: "第 1 轮讨论开始",
            createdAt: 1_700_000_000_000,
          },
        ],
        result: null,
        phaseEndsAt: 1_700_000_300_000,
        config: {
          totalSeats: 7,
          aiCount: 1,
          endgameAliveSeatCount: 3,
          roundOneSeconds: 300,
          roundSeconds: 180,
          voteSeconds: 60,
          tiebreakSeconds: 60,
        },
        selfVoteTargetId: null,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <RoomClient
        initialRoom={buildWaitingSnapshot()}
        selfSeatId="seat-1"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "开始游戏" }));

    await waitFor(() => {
      expect(screen.getByText("第 1 轮")).toBeInTheDocument();
      expect(screen.getByText("第 1 轮讨论开始")).toBeInTheDocument();
    });
  });

  it("redirects to the home page with seat-required when start fails because the seat binding is missing", async () => {
    process.env.NEXT_PUBLIC_MIN_CONNECTED_TO_START = "2";
    stubEventSource();
    useRouterMock.mockReturnValue({
      push: pushMock,
      replace: replaceMock,
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: "SEAT_NOT_BOUND",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <RoomClient
        initialRoom={buildWaitingSnapshot()}
        selfSeatId="seat-1"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "开始游戏" }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/?code=ABCDEF&error=seat-required");
    });
  });

  it("redirects everyone to the home page when a closed room snapshot arrives", async () => {
    stubEventSource();
    useRouterMock.mockReturnValue({
      push: pushMock,
      replace: replaceMock,
    });

    render(
      <RoomClient
        initialRoom={buildWaitingSnapshot({
          seats: [
            {
              id: "seat-1",
              status: "alive",
              color: "red",
              connected: true,
              isHost: true,
            },
          ],
        })}
        selfSeatId="seat-1"
      />,
    );

    await act(async () => {
      eventSourceInstances[0].onmessage?.({
        data: JSON.stringify({
          code: "ABCDEF",
          phase: "closed",
          round: 0,
          hostSeatId: "seat-1",
          seats: [
            {
              id: "seat-1",
              status: "alive",
              color: "red",
              connected: true,
              isHost: true,
            },
          ],
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
          selfVoteTargetId: null,
        }),
      } as MessageEvent<string>);
    });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/?error=room-closed");
    });
  });

  it("opens a custom confirmation dialog before leaving and exits after confirm", async () => {
    stubEventSource();
    useRouterMock.mockReturnValue({
      push: pushMock,
      replace: replaceMock,
      refresh: vi.fn(),
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => buildWaitingSnapshot(),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <RoomClient
        initialRoom={buildWaitingSnapshot({
          seats: buildWaitingSnapshot().seats.map((seat) =>
            seat.id === "seat-3" ? { ...seat, connected: true } : seat,
          ),
        })}
        selfSeatId="seat-3"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "退出房间" }));

    expect(screen.getByRole("dialog", { name: "确认退出房间" })).toBeInTheDocument();
    expect(screen.getByText("确认退出房间吗？你会返回首页。")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "确认退出" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/rooms/ABCDEF/leave", expect.any(Object));
      expect(replaceMock).toHaveBeenCalledWith("/");
    });
  });

  it("opens a custom confirmation dialog before closing and does nothing after cancel", async () => {
    stubEventSource();
    useRouterMock.mockReturnValue({
      push: pushMock,
      replace: replaceMock,
      refresh: vi.fn(),
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <RoomClient
        initialRoom={buildWaitingSnapshot()}
        selfSeatId="seat-1"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "解散房间" }));

    expect(screen.getByRole("dialog", { name: "确认解散房间" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "取消" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "确认解散房间" })).not.toBeInTheDocument();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
