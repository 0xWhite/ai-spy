import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResultsPanel } from "@/components/results-panel";
import type { RevealedClientSeatState } from "@/lib/room-snapshot";

const seats: RevealedClientSeatState[] = [
  {
    id: "seat-1",
    role: "human",
    status: "alive",
    number: 1,
    color: "red",
    connected: true,
  },
  {
    id: "seat-2",
    role: "ai",
    status: "spectator",
    number: 2,
    color: "blue",
    connected: false,
  },
  {
    id: "seat-3",
    role: "human",
    status: "alive",
    number: 3,
    color: "green",
    connected: true,
  },
];

describe("ResultsPanel", () => {
  it("renders the reveal-first summary layout without changing result data", () => {
    render(
      <ResultsPanel
        canRematch
        eliminatedSeatIds={["seat-2"]}
        result={{ winner: "human" }}
        seats={seats}
      />,
    );

    expect(screen.getByText("对局结算")).toBeInTheDocument();
    expect(screen.getByText("人类阵营获胜")).toBeInTheDocument();
    expect(screen.getByText("AI 身份揭晓")).toBeInTheDocument();
    expect(screen.getAllByText("蓝色 2 号").length).toBeGreaterThan(0);
    expect(screen.getByText("最终在场")).toBeInTheDocument();
    expect(screen.getByText("淘汰顺序")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再来一局" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回首页" })).toBeInTheDocument();
  });

  it("shows the waiting-for-host hint for non-host players", () => {
    render(
      <ResultsPanel
        eliminatedSeatIds={["seat-2"]}
        result={{ winner: "human" }}
        seats={seats}
      />,
    );

    expect(screen.queryByRole("button", { name: "再来一局" })).not.toBeInTheDocument();
    expect(screen.getByText("可以等待房主重开游戏")).toBeInTheDocument();
  });
});
