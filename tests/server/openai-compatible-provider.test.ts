import { afterEach, describe, expect, it, vi } from "vitest";
import { buildInitialRoomState, startGame } from "@/lib/game/engine";
import { createOpenAiCompatibleProvider } from "@/lib/server/ai/openai-compatible-provider";

const fetchMock = vi.fn<typeof fetch>();

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
    messages: [
      {
        id: "system-1",
        kind: "system" as const,
        text: "第 1 轮讨论开始",
        createdAt: 1_700_000_000_000,
      },
      {
        id: "player-1",
        kind: "player" as const,
        seatId: "seat-1",
        text: "我觉得 2 号有点太安静了。",
        createdAt: 1_700_000_001_000,
      },
      {
        id: "player-2",
        kind: "player" as const,
        seatId: "seat-3",
        text: "先别急着下结论，再聊两句看看。",
        createdAt: 1_700_000_002_000,
      },
    ],
  };
}

describe("openai-compatible provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    fetchMock.mockReset();
  });

  it("sends richer human-like messaging instructions and structured recent context", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "我先继续听，2号刚才那句有点刻意。",
            },
          },
        ],
      }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const provider = createOpenAiCompatibleProvider({
      apiKey: "key",
      baseUrl: "https://example.test/v1",
      model: "test-model",
    });
    const room = buildDiscussionRoom();

    await provider.generateMessage({
      room,
      seat: room.seats[1],
      now: 1_700_000_003_000,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.body)) as {
      messages: Array<{ role: string; content: string }>;
    };

    expect(body.messages[0].content).toContain("自然、口语化");
    expect(body.messages[0].content).toContain("不要总像总结发言");
    expect(body.messages[0].content).toContain("稳定风格");
    expect(body.messages[0].content).toContain("如果最近有人点名你、追问你");
    expect(body.messages[0].content).toContain("绝不要说自己的知识截止时间");
    expect(body.messages[1].content).toContain('"selfSeatLabel"');
    expect(body.messages[1].content).toContain('"recentMessages"');
    expect(body.messages[1].content).toContain('"interactionFocus"');
    expect(body.messages[1].content).toContain("红色 1 号");
    expect(body.messages[1].content).toContain("我觉得 2 号有点太安静了。");
    expect(body.messages[1].content).toContain("先别急着下结论，再聊两句看看。");
  });

  it("uses the responses api web search tool for clear freshness questions", async () => {
    vi.stubEnv("TAVILY_API_KEY", "tvly-key");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            title: "今日热搜榜单更新",
            content: "今天热搜第一仍然是那条突发新闻。",
            url: "https://example.com/hot",
          },
        ],
      }),
    } as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            title: "今日热搜榜单更新",
            content: "今天热搜第一仍然是那条突发新闻。",
            url: "https://example.com/hot",
          },
        ],
      }),
    } as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "我刚看了一眼，今天还是那条新闻最热。",
            },
          },
        ],
      }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const provider = createOpenAiCompatibleProvider({
      apiKey: "key",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-5",
    });
    const room = buildDiscussionRoom();
    room.messages = [
      ...room.messages,
      {
        id: "player-3",
        kind: "player" as const,
        seatId: "seat-1",
        text: "今天热搜第一是谁？",
        createdAt: 1_700_000_003_000,
      },
    ];

    await provider.generateMessage({
      room,
      seat: room.seats[1],
      now: 1_700_000_004_000,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [searchUrl, searchRequest] = fetchMock.mock.calls[0];
    const searchBody = JSON.parse(String(searchRequest?.body)) as {
      query: string;
      max_results: number;
    };
    expect(String(searchUrl)).toBe("https://api.tavily.com/search");
    expect(searchBody.query).toContain("今天热搜第一是谁");
    expect(searchBody.max_results).toBe(3);

    const [completionUrl, completionRequest] = fetchMock.mock.calls[1];
    const completionBody = JSON.parse(String(completionRequest?.body)) as {
      messages: Array<{ role: string; content: string }>;
    };

    expect(String(completionUrl)).toBe("https://api.openai.com/v1/chat/completions");
    expect(completionBody.messages[0].content).toContain("不要暴露你在搜索");
    expect(completionBody.messages[1].content).toContain('"searchContext"');
    expect(completionBody.messages[1].content).toContain("今天热搜第一仍然是那条突发新闻。");
  });

  it("normalizes verbose vote output down to a seat id", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "seat-3\n理由：这轮我更怀疑他。",
            },
          },
        ],
      }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const provider = createOpenAiCompatibleProvider({
      apiKey: "key",
      baseUrl: "https://example.test/v1",
      model: "test-model",
    });
    const room = buildDiscussionRoom();

    const vote = await provider.chooseVote({
      room: {
        ...room,
        phase: "voting",
      },
      seat: room.seats[1],
      now: 1_700_000_004_000,
    });

    expect(vote).toBe("seat-3");
  });
});
