import { describe, expect, it, vi } from "vitest";
import { buildInitialRoomState, startGame } from "@/lib/game/engine";
import {
  createRuntimeAiProvider,
  type AiDiagnosticReporter,
} from "@/lib/server/ai/runtime";
import type { AiProvider } from "@/lib/server/ai/provider";

function buildDiscussionRoom() {
  return {
    code: "ABCDEF",
    ...startGame(
      buildInitialRoomState({
        hostSeatId: "seat-1",
      }),
      1_700_000_000_000,
    ),
  };
}

describe("AI runtime provider", () => {
  it("reports partial AI env config and falls back to mock AI", async () => {
    const reportIssue = vi.fn<AiDiagnosticReporter>();
    const provider = createRuntimeAiProvider({
      env: {
        AI_BASE_URL: "https://example.test/v1",
      } as unknown as NodeJS.ProcessEnv,
      reportIssue,
    });
    const room = buildDiscussionRoom();

    const text = await provider.generateMessage({
      room,
      seat: room.seats[1],
      now: 1_700_000_000_001,
    });

    expect(text).toContain("我先继续听");
    expect(reportIssue).toHaveBeenCalledWith(
      expect.stringContaining("partially configured"),
      expect.objectContaining({
        missing: ["AI_API_KEY", "AI_MODEL"],
      }),
    );
  });

  it("falls back to mock AI when the configured provider throws", async () => {
    const reportIssue = vi.fn<AiDiagnosticReporter>();
    const primaryProvider: AiProvider = {
      generateMessage: async () => {
        throw new Error("upstream down");
      },
      chooseVote: async () => {
        throw new Error("upstream down");
      },
    };
    const fallbackProvider: AiProvider = {
      generateMessage: async () => "fallback message",
      chooseVote: async () => "seat-1",
    };
    const provider = createRuntimeAiProvider({
      env: {
        AI_BASE_URL: "https://example.test/v1",
        AI_API_KEY: "key",
        AI_MODEL: "model",
      } as unknown as NodeJS.ProcessEnv,
      primaryProvider,
      fallbackProvider,
      reportIssue,
    });
    const room = buildDiscussionRoom();

    const text = await provider.generateMessage({
      room,
      seat: room.seats[1],
      now: 1_700_000_000_001,
    });
    const vote = await provider.chooseVote({
      room: {
        ...room,
        phase: "voting",
      },
      seat: room.seats[1],
      now: 1_700_000_000_002,
    });

    expect(text).toBe("fallback message");
    expect(vote).toBe("seat-1");
    expect(reportIssue).toHaveBeenCalledTimes(2);
    expect(reportIssue).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("generateMessage failed"),
      expect.any(Error),
    );
    expect(reportIssue).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("chooseVote failed"),
      expect.any(Error),
    );
  });
});
