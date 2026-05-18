import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { startGame, buildInitialRoomState } from "@/lib/game/engine";
import { RoomShell } from "@/components/room-shell";
import {
  toClientRoomSnapshot,
  type ClientRoomSnapshot,
  type RoomSnapshot,
} from "@/lib/room-snapshot";

function buildWaitingRoom(
  overrides: Partial<RoomSnapshot> = {},
): ClientRoomSnapshot {
  const initialRoom = buildInitialRoomState({
    hostSeatId: "seat-1",
  });

  return toClientRoomSnapshot({
    code: "ABCDEF",
    ...initialRoom,
    seats: initialRoom.seats.map((seat) => {
      if (seat.id === "seat-1") {
        return {
          ...seat,
          role: "human" as const,
        };
      }

      if (seat.id === "seat-2") {
        return {
          ...seat,
          role: "ai" as const,
        };
      }

      return seat;
    }),
    phase: "waiting",
    ...overrides,
  });
}

function buildDiscussionRoom(): ClientRoomSnapshot {
  const now = 1_700_000_000_000;
  const initialRoom = buildInitialRoomState({
    hostSeatId: "seat-1",
  });

  return toClientRoomSnapshot({
    code: "ABCDEF",
    ...startGame(
      {
        ...initialRoom,
        seats: initialRoom.seats.map((seat) => {
          if (seat.id === "seat-1") {
            return {
              ...seat,
              role: "human" as const,
            };
          }

          if (seat.id === "seat-2") {
            return {
              ...seat,
              role: "ai" as const,
            };
          }

          if (seat.id === "seat-3") {
            return {
              ...seat,
              connected: true,
            };
          }

          return seat;
        }),
      },
      now,
      () => 0,
    ),
    messages: [
      {
        id: "system-1",
        kind: "system",
        text: "第 1 轮讨论开始",
        createdAt: now,
      },
      {
        id: "player-1",
        kind: "player",
        seatId: "seat-2",
        text: "我先观察一下。",
        createdAt: now + 1_000,
      },
    ],
  });
}

function buildVotingRoom(): ClientRoomSnapshot {
  const room = buildDiscussionRoom();

  return {
    ...room,
    phase: "voting",
    selfVoteTargetId: "seat-3",
    seats: room.seats.map((seat) =>
      seat.id === "seat-1" ? { ...seat, status: "spectator" } : seat,
    ),
  };
}

function buildFinishedRoom(
  overrides: Partial<RoomSnapshot> = {},
): ClientRoomSnapshot {
  return toClientRoomSnapshot({
    code: "ABCDEF",
    ...buildInitialRoomState({
      hostSeatId: "seat-1",
    }),
    phase: "finished",
    result: { winner: "human" },
    ...overrides,
  });
}

describe("RoomShell", () => {
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;

  beforeAll(() => {
    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    window.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_MIN_CONNECTED_TO_START;
    vi.clearAllMocks();
  });

  afterAll(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it("renders the waiting room panel with invite code and connected seats", () => {
    render(<RoomShell room={buildWaitingRoom()} selfSeatId="seat-1" />);

    expect(screen.getByText("等待开局")).toBeInTheDocument();
    expect(screen.getByText("ABCDEF")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "复制邀请码" })).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("1 / 6 已连接"))).toBeInTheDocument();
    expect(screen.getByText("本局共 7 个正式席位，其中会混入 1 个 AI")).toBeInTheDocument();
    expect(screen.getByText("房主已加入")).toBeInTheDocument();
    expect(screen.getAllByText("空位").length).toBeGreaterThan(0);
    expect(screen.queryByText("红色 1 号")).not.toBeInTheDocument();
    expect(screen.queryByText("橙色")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "解散房间" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "开始游戏" }),
    ).toBeDisabled();
    expect(screen.getByText("本局节奏")).toBeInTheDocument();
  });

  it("allows the host to start with two connected players when the local override is set", () => {
    process.env.NEXT_PUBLIC_MIN_CONNECTED_TO_START = "2";
    const room = buildWaitingRoom();
    room.seats = room.seats.map((seat) =>
      seat.id === "seat-3" ? { ...seat, connected: true } : seat,
    );

    render(
      <RoomShell
        room={room}
        selfSeatId="seat-1"
      />,
    );

    expect(
      screen.getByRole("button", { name: "开始游戏" }),
    ).toBeEnabled();
  });

  it("shows a leave-room action for a joined player while waiting", () => {
    const room = buildWaitingRoom({
      seats: buildInitialRoomState({
        hostSeatId: "seat-1",
      }).seats.map((seat) => {
        if (seat.id === "seat-1") {
          return {
            ...seat,
            role: "human" as const,
            connected: true,
          };
        }

        if (seat.id === "seat-2") {
          return {
            ...seat,
            role: "ai" as const,
          };
        }

        if (seat.id === "seat-3") {
          return {
            ...seat,
            role: "human" as const,
            connected: true,
          };
        }

        return seat;
      }),
    });

    render(<RoomShell room={room} selfSeatId="seat-3" />);

    expect(
      screen.getByRole("button", { name: "退出房间" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "解散房间" }),
    ).not.toBeInTheDocument();
  });

  it("renders the in-game layout with status, timeline, and action area", () => {
    render(<RoomShell onLeave={() => undefined} room={buildDiscussionRoom()} selfSeatId="seat-2" />);

    expect(screen.getByText("第 1 轮")).toBeInTheDocument();
    expect(screen.getByText("讨论阶段")).toBeInTheDocument();
    expect(screen.getByText("3 人在场")).toBeInTheDocument();
    expect(screen.getByText("第 1 轮讨论开始")).toBeInTheDocument();
    expect(screen.getAllByText("红色 1 号").length).toBeGreaterThan(0);
    expect(screen.getByText("当前席位")).toBeInTheDocument();
    expect(screen.getByText("席位面板")).toBeInTheDocument();
    expect(screen.getByText("在场 (3)")).toBeInTheDocument();
    expect(screen.getByText("旁观 (0)")).toBeInTheDocument();
    expect(screen.getByText("暂无旁观席位")).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "发送消息" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "退出房间" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "解散房间" })).not.toBeInTheDocument();
  });

  it("groups the seat panel and renders the voting board during voting", () => {
    render(<RoomShell onLeave={() => undefined} room={buildVotingRoom()} selfSeatId="seat-2" />);

    expect(screen.getByText("在场 (2)")).toBeInTheDocument();
    expect(screen.getByText("旁观 (1)")).toBeInTheDocument();
    expect(screen.getByText("投票对象")).toBeInTheDocument();
    expect(screen.getByText("请选择你认为最可疑的在场席位。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "退出房间" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "已投" })).toBeDisabled();
  });

  it("does not render the results panel when a finished room has no result yet", () => {
    render(
      <RoomShell
        room={buildFinishedRoom({
          result: null,
        })}
        selfSeatId="seat-1"
      />,
    );

    expect(screen.queryByText("对局结算")).not.toBeInTheDocument();
    expect(screen.getByText("聊天时间线")).toBeInTheDocument();
  });

  it("scrolls the timeline to the bottom when new messages arrive", () => {
    const room = buildDiscussionRoom();
    const { container, rerender } = render(
      <RoomShell onLeave={() => undefined} room={room} selfSeatId="seat-2" />,
    );
    const timeline = container.querySelector("ul.overflow-y-auto");
    expect(timeline).not.toBeNull();
    Object.defineProperty(timeline!, "scrollHeight", {
      configurable: true,
      value: 1200,
    });
    timeline!.scrollTop = 0;

    const nextRoom = {
      ...room,
      messages: [
        ...room.messages,
        {
          id: "player-2",
          kind: "player" as const,
          seatId: "seat-1",
          text: "新消息来了",
          createdAt: room.messages.at(-1)!.createdAt + 1_000,
        },
      ],
    };

    rerender(<RoomShell onLeave={() => undefined} room={nextRoom} selfSeatId="seat-2" />);

    expect(timeline!.scrollTop).toBe(1200);
  });

  it("does not crash when the room transitions from waiting to discussion in place", () => {
    const waitingRoom = buildWaitingRoom();
    const discussionRoom = buildDiscussionRoom();
    const { rerender } = render(
      <RoomShell room={waitingRoom} selfSeatId="seat-1" />,
    );

    expect(() => {
      rerender(
        <RoomShell
          onLeave={() => undefined}
          room={discussionRoom}
          selfSeatId="seat-2"
        />,
      );
    }).not.toThrow();

    expect(screen.getByText("第 1 轮")).toBeInTheDocument();
  });
});
