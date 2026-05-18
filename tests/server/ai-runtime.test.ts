import { describe, expect, it, vi } from "vitest";
import { AiRuntime } from "@/lib/server/ai/runtime";
import { buildInitialRoomState, startGame } from "@/lib/game/engine";
import {
  createRuntimeAiProvider,
  type AiDiagnosticReporter,
} from "@/lib/server/ai/runtime";
import type { AiProvider } from "@/lib/server/ai/provider";

function buildDiscussionRoom() {
  const initialRoom = buildInitialRoomState({
    hostSeatId: "seat-1",
  });

  return {
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
      1_700_000_000_000,
      () => 0,
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

  it("lets AI respond again when a new human message arrives in the same discussion phase", async () => {
    const provider: AiProvider = {
      generateMessage: vi
        .fn()
        .mockResolvedValueOnce("先听听大家怎么说。")
        .mockResolvedValueOnce("我先回你这句，3号说得再具体点？"),
      chooseVote: vi.fn().mockResolvedValue(null),
    };
    const runtime = new AiRuntime(provider, {
      random: () => 0.1,
    });
    const room = buildDiscussionRoom();

    const firstRun = await runtime.run(room);
    expect(provider.generateMessage).toHaveBeenCalledTimes(1);
    expect(
      firstRun.room.messages.some(
        (message) =>
          message.kind === "player" &&
          message.seatId === "seat-2" &&
          message.text === "先听听大家怎么说。",
      ),
    ).toBe(true);

    const withHumanReply = {
      ...firstRun.room,
      messages: [
        ...firstRun.room.messages,
        {
          id: "player-seat-1-follow-up",
          kind: "player" as const,
          seatId: "seat-1",
          text: "3号具体哪里不对？",
          createdAt: 1_700_000_000_999,
        },
      ],
    };

    const secondRun = await runtime.run(withHumanReply, firstRun.phaseState);

    expect(provider.generateMessage).toHaveBeenCalledTimes(2);
    expect(
      secondRun.room.messages.some(
        (message) =>
          message.kind === "player" &&
          message.seatId === "seat-2" &&
          message.text === "我先回你这句，3号说得再具体点？",
      ),
    ).toBe(true);
  });

  it("does not make AI loop forever when no new human message appears", async () => {
    const provider: AiProvider = {
      generateMessage: vi.fn().mockResolvedValue("先听听大家怎么说。"),
      chooseVote: vi.fn().mockResolvedValue(null),
    };
    const runtime = new AiRuntime(provider, {
      random: () => 0.1,
    });
    const room = buildDiscussionRoom();

    const firstRun = await runtime.run(room);
    const secondRun = await runtime.run(firstRun.room, firstRun.phaseState);

    expect(provider.generateMessage).toHaveBeenCalledTimes(1);
    expect(secondRun.room.messages).toHaveLength(firstRun.room.messages.length);
  });

  it("does not always force an opening message when nobody speaks first", async () => {
    const provider: AiProvider = {
      generateMessage: vi.fn().mockResolvedValue("我先说两句"),
      chooseVote: vi.fn().mockResolvedValue(null),
    };
    const runtime = new AiRuntime(provider, {
      random: () => 0.95,
    });
    const room = buildDiscussionRoom();
    room.messages = room.messages.filter((message) => message.kind === "system");

    const firstRun = await runtime.run(room);

    expect(provider.generateMessage).not.toHaveBeenCalled();
    expect(firstRun.room.messages).toHaveLength(room.messages.length);
  });

  it("does not reply to every generic human message", async () => {
    const provider: AiProvider = {
      generateMessage: vi.fn().mockResolvedValue("我随口接一句"),
      chooseVote: vi.fn().mockResolvedValue(null),
    };
    const runtime = new AiRuntime(provider, {
      random: () => 0.95,
    });
    const room = buildDiscussionRoom();
    room.messages = [
      ...room.messages,
      {
        id: "player-generic",
        kind: "player" as const,
        seatId: "seat-1",
        text: "我感觉大家都挺安静的",
        createdAt: 1_700_000_003_000,
      },
    ];

    const run = await runtime.run(room);

    expect(provider.generateMessage).not.toHaveBeenCalled();
    expect(run.room.messages).toHaveLength(room.messages.length);
  });

  it("still tends to respond when directly mentioned", async () => {
    const provider: AiProvider = {
      generateMessage: vi.fn().mockResolvedValue("你刚才问我学校是吧"),
      chooseVote: vi.fn().mockResolvedValue(null),
    };
    const runtime = new AiRuntime(provider, {
      random: () => 0.2,
    });
    const room = buildDiscussionRoom();
    const aiSeat = room.seats.find((seat) => seat.id === "seat-2")!;
    room.messages = [
      ...room.messages,
      {
        id: "player-direct-mention",
        kind: "player" as const,
        seatId: "seat-1",
        text: `${aiSeat.number}号你呢`,
        createdAt: 1_700_000_003_000,
      },
    ];

    const run = await runtime.run(room);

    expect(provider.generateMessage).toHaveBeenCalledTimes(1);
    expect(
      run.room.messages.some(
        (message) =>
          message.kind === "player" &&
          message.seatId === "seat-2" &&
          message.text === "你刚才问我学校是吧",
      ),
    ).toBe(true);
  });
});
