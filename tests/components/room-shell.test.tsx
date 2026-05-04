import { render, screen } from "@testing-library/react";
import { startGame, buildInitialRoomState } from "@/lib/game/engine";
import { RoomShell } from "@/components/room-shell";
import {
  toClientRoomSnapshot,
  type ClientRoomSnapshot,
  type RoomSnapshot,
} from "@/lib/server/room-store";

function buildWaitingRoom(
  overrides: Partial<RoomSnapshot> = {},
): ClientRoomSnapshot {
  return toClientRoomSnapshot({
    code: "ABCDEF",
    ...buildInitialRoomState({
      hostSeatId: "seat-1",
    }),
    phase: "waiting",
    ...overrides,
  });
}

function buildDiscussionRoom(): ClientRoomSnapshot {
  const now = 1_700_000_000_000;

  return toClientRoomSnapshot({
    code: "ABCDEF",
    ...startGame(
      buildInitialRoomState({
        hostSeatId: "seat-1",
      }),
      now,
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
  it("renders the waiting room panel with invite code and connected seats", () => {
    render(<RoomShell room={buildWaitingRoom()} selfSeatId="seat-1" />);

    expect(screen.getByText("等待开局")).toBeInTheDocument();
    expect(screen.getByText("ABCDEF")).toBeInTheDocument();
    expect(screen.getByText("1 / 7 已连接")).toBeInTheDocument();
    expect(screen.getByText("红色 1 号")).toBeInTheDocument();
  });

  it("renders the in-game layout with status, timeline, and action area", () => {
    render(<RoomShell room={buildDiscussionRoom()} selfSeatId="seat-2" />);

    expect(screen.getByText("第 1 轮")).toBeInTheDocument();
    expect(screen.getAllByText("讨论阶段")).toHaveLength(2);
    expect(screen.getByText("7 人存活")).toBeInTheDocument();
    expect(screen.getByText("第 1 轮讨论开始")).toBeInTheDocument();
    expect(screen.getAllByText("蓝色 2 号").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("textbox", { name: "发送消息" }),
    ).toBeInTheDocument();
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
});
