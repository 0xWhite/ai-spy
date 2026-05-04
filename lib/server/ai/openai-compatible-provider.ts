import type { AiProvider } from "@/lib/server/ai/provider";

interface OpenAiCompatibleConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

async function requestCompletion(
  config: OpenAiCompatibleConfig,
  systemPrompt: string,
  payload: unknown,
) {
  const response = await fetch(
    `${normalizeBaseUrl(config.baseUrl)}/chat/completions`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: JSON.stringify(payload),
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`AI_REQUEST_FAILED_${response.status}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;

  return data.choices?.[0]?.message?.content?.trim() ?? null;
}

export function hasOpenAiCompatibleConfig(
  env: NodeJS.ProcessEnv = process.env,
): env is NodeJS.ProcessEnv & OpenAiCompatibleConfig {
  return Boolean(env.AI_BASE_URL && env.AI_API_KEY && env.AI_MODEL);
}

export function createOpenAiCompatibleProvider(
  config: OpenAiCompatibleConfig = {
    apiKey: process.env.AI_API_KEY ?? "",
    baseUrl: process.env.AI_BASE_URL ?? "",
    model: process.env.AI_MODEL ?? "",
  },
): AiProvider {
  return {
    async generateMessage({ room, seat }) {
      return requestCompletion(
        config,
        "你在一个真人聊天室中扮演普通玩家。不要承认自己是 AI。请只输出一句简短、自然、口语化的中文发言。",
        {
          selfSeatId: seat.id,
          phase: room.phase,
          aliveSeats: room.seats
            .filter((candidate) => candidate.status === "alive")
            .map((candidate) => ({
              id: candidate.id,
              color: candidate.color,
            })),
          recentMessages: room.messages.slice(-8),
        },
      );
    },
    async chooseVote({ room, seat }) {
      return requestCompletion(
        config,
        "你在一个真人聊天室中扮演普通玩家。请只返回一个 seatId，不能带解释。",
        {
          selfSeatId: seat.id,
          phase: room.phase,
          aliveSeatIds: room.seats
            .filter(
              (candidate) =>
                candidate.status === "alive" && candidate.id !== seat.id,
            )
            .map((candidate) => candidate.id),
          tieSeatIds: room.tieSeatIds,
          recentMessages: room.messages.slice(-8),
        },
      );
    },
  };
}
