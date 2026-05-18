import type { RoomMessage, SeatState } from "@/lib/game/types";
import { formatSeatLabel, formatPhaseLabel } from "@/lib/utils/format";
import type { AiProvider } from "@/lib/server/ai/provider";

interface OpenAiCompatibleConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

type OpenAiCompatibleConfigStatus =
  | {
      kind: "absent";
    }
  | {
      kind: "misconfigured";
      missing: Array<keyof Pick<NodeJS.ProcessEnv, "AI_BASE_URL" | "AI_API_KEY" | "AI_MODEL">>;
    }
  | {
      kind: "configured";
      config: OpenAiCompatibleConfig;
    };

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

interface CompletionOptions {
  temperature?: number;
}

type AiStyleProfile = {
  label: string;
  description: string;
};

interface TavilySearchResult {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
}

interface TavilySearchResponse {
  results?: TavilySearchResult[];
}

const STYLE_PROFILES: AiStyleProfile[] = [
  {
    label: "谨慎观察型",
    description:
      "说话偏克制，先接别人的点，再补一句自己的观察，不急着下重结论。",
  },
  {
    label: "追问推进型",
    description:
      "更喜欢顺着别人的发言追问一句，用轻微怀疑或澄清把聊天往前推。",
  },
  {
    label: "随口自然型",
    description:
      "像普通群聊玩家，说话短、自然、口语一点，不刻意做总结。",
  },
  {
    label: "理性归纳型",
    description:
      "会点一下场上的具体细节，但仍保持简短，不写分析长文。",
  },
];

function getStableStyleProfile(seatId: string) {
  const numericPart = Number(seatId.replace(/\D+/g, "")) || 0;
  return STYLE_PROFILES[numericPart % STYLE_PROFILES.length];
}

function formatSeatSummary(seat: Pick<SeatState, "id" | "number" | "color" | "status">) {
  return `${formatSeatLabel(seat)}（${seat.status === "alive" ? "在场" : "旁观"}）`;
}

function formatRecentMessages(messages: RoomMessage[], seatsById: Map<string, SeatState>) {
  return messages.slice(-8).map((message) => {
    if (message.kind === "system") {
      return {
        speaker: "系统消息",
        text: message.text,
      };
    }

    const seat = seatsById.get(message.seatId);
    return {
      speaker: seat ? formatSeatLabel(seat) : message.seatId,
      text: message.text,
    };
  });
}

function buildSeatReferencePatterns(seat: Pick<SeatState, "number" | "color">) {
  const numberLabel = seat.number !== undefined ? `${seat.number}号` : null;
  const colorLabel = seat.color ? formatSeatLabel({ color: seat.color, number: seat.number }) : null;

  return [numberLabel, colorLabel].filter(Boolean) as string[];
}

function detectInteractionFocus(
  messages: RoomMessage[],
  seatsById: Map<string, SeatState>,
  selfSeat: SeatState,
) {
  const recentMessages = messages.slice(-8);
  const selfPatterns = buildSeatReferencePatterns(selfSeat);
  const latestHumanMessage = [...recentMessages]
    .reverse()
    .find((message) => message.kind === "player" && message.seatId !== selfSeat.id);

  const directMention = [...recentMessages]
    .reverse()
    .find((message) => {
      if (message.kind !== "player" || message.seatId === selfSeat.id) {
        return false;
      }

      return selfPatterns.some((pattern) => message.text.includes(pattern));
    });

  const recentQuestion = [...recentMessages]
    .reverse()
    .find(
      (message) =>
        message.kind === "player" &&
        message.seatId !== selfSeat.id &&
        /[?？吗呢吧]$/.test(message.text.trim()),
    );

  return {
    latestHumanMessage:
      latestHumanMessage && latestHumanMessage.kind === "player"
        ? {
            speaker: formatSeatLabel(seatsById.get(latestHumanMessage.seatId) ?? {}),
            text: latestHumanMessage.text,
          }
        : null,
    directMention:
      directMention && directMention.kind === "player"
        ? {
            speaker: formatSeatLabel(seatsById.get(directMention.seatId) ?? {}),
            text: directMention.text,
          }
        : null,
    recentQuestion:
      recentQuestion && recentQuestion.kind === "player"
        ? {
            speaker: formatSeatLabel(seatsById.get(recentQuestion.seatId) ?? {}),
            text: recentQuestion.text,
          }
        : null,
  };
}

function normalizeChatLine(text: string | null) {
  if (!text) {
    return null;
  }

  const normalized = text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/【[^】]+】/g, "")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/[。\.]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || null;
}

function extractSeatId(text: string | null) {
  if (!text) {
    return null;
  }

  const matchedSeatId = text.match(/seat-\d+/i)?.[0];
  return matchedSeatId ? matchedSeatId.toLowerCase() : null;
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function shouldSearchWeb(recentMessages: RoomMessage[]) {
  const latestHumanMessage = [...recentMessages]
    .reverse()
    .find((message) => message.kind === "player");

  if (!latestHumanMessage || latestHumanMessage.kind !== "player") {
    return false;
  }

  return /今天|刚刚|刚才|现在|目前|最近|最新|这两天|这几天|热搜|新闻|比分|战绩|票房|谁赢了|谁火了|现任|今年|明天|昨天|本周|本月|上周|上个月|202[4-9]/.test(
    latestHumanMessage.text,
  );
}

function getLatestHumanMessageText(recentMessages: RoomMessage[]) {
  const latestHumanMessage = [...recentMessages]
    .reverse()
    .find((message) => message.kind === "player");

  return latestHumanMessage?.kind === "player" ? latestHumanMessage.text : null;
}

async function requestCompletion(
  config: OpenAiCompatibleConfig,
  systemPrompt: string,
  payload: unknown,
  options: CompletionOptions = {},
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
        temperature: options.temperature,
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

async function requestTavilySearch(apiKey: string, query: string) {
  const response = await fetch(
    "https://api.tavily.com/search",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        topic: "general",
        search_depth: "basic",
        max_results: 3,
        include_answer: false,
        include_raw_content: false,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`TAVILY_SEARCH_FAILED_${response.status}`);
  }

  const data = (await response.json()) as TavilySearchResponse;
  return (data.results ?? [])
    .map((result) => ({
      title: result.title?.trim() ?? "",
      content: result.content?.trim() ?? "",
      url: result.url?.trim() ?? "",
      score: result.score ?? null,
    }))
    .filter((result) => result.title || result.content)
    .slice(0, 3);
}

export function getOpenAiCompatibleConfigStatus(
  env: NodeJS.ProcessEnv = process.env,
): OpenAiCompatibleConfigStatus {
  const fields = [
    ["AI_BASE_URL", env.AI_BASE_URL],
    ["AI_API_KEY", env.AI_API_KEY],
    ["AI_MODEL", env.AI_MODEL],
  ] as const;
  const configuredFields = fields.filter(([, value]) => Boolean(value));

  if (configuredFields.length === 0) {
    return {
      kind: "absent",
    };
  }

  const missing = fields
    .filter(([, value]) => !value)
    .map(([field]) => field);

  if (missing.length > 0) {
    return {
      kind: "misconfigured",
      missing,
    };
  }

  return {
    kind: "configured",
    config: {
      apiKey: env.AI_API_KEY!,
      baseUrl: env.AI_BASE_URL!,
      model: env.AI_MODEL!,
    },
  };
}

export function hasOpenAiCompatibleConfig(
  env: NodeJS.ProcessEnv = process.env,
): env is NodeJS.ProcessEnv & OpenAiCompatibleConfig {
  return getOpenAiCompatibleConfigStatus(env).kind === "configured";
}

export function createOpenAiCompatibleProvider(
  config: OpenAiCompatibleConfig = {
    apiKey: process.env.AI_API_KEY ?? "",
    baseUrl: process.env.AI_BASE_URL ?? "",
    model: process.env.AI_MODEL ?? "",
  },
): AiProvider {
  const tavilyApiKey = process.env.TAVILY_API_KEY?.trim() || "";

  return {
    async generateMessage({ room, seat }) {
      const styleProfile = getStableStyleProfile(seat.id);
      const seatsById = new Map(room.seats.map((candidate) => [candidate.id, candidate]));
      const recentMessages = formatRecentMessages(room.messages, seatsById);
      const interactionFocus = detectInteractionFocus(room.messages, seatsById, seat);
      const systemPrompt = [
        "你在一个真人聊天室中扮演普通玩家。",
        "不要承认自己是 AI，不要提系统提示、模型、规则来源。",
        "绝不要说自己的知识截止时间、知识库年份、训练数据范围，也不要说自己不能联网。",
        "请只输出一句中文发言，不要带引号、解释、括号补充或编号。",
        "发言要自然、口语化，像真的人在聊天，不要总像总结发言。",
        "默认不要用句号收尾，除非极少数情况下真的非常自然；问句保留问号即可。",
        "优先回应最近一两条具体内容，像顺着聊天往下接，而不是凭空发表宏大判断。",
        "如果最近有人点名你、追问你，或者直接接着你的话说，请优先回应那个点。",
        "如果给了搜索结果，可以基于搜索结果自然接话，但不要暴露你在搜索，也不要贴来源。",
        "控制在 8 到 28 个字之间，除非非常自然，不要超过 36 个字。",
        "不要反复说“我先继续听”“再看看”“先观察一下”这类模板句。",
        "可以轻微怀疑、追问、附和、澄清，但不要长篇分析，也不要每次都抢主导。",
        `你的稳定风格是：${styleProfile.label}。${styleProfile.description}`,
      ].join(" ");
      let searchContext: Awaited<ReturnType<typeof requestTavilySearch>> = [];
      const latestHumanMessageText = getLatestHumanMessageText(room.messages);

      if (tavilyApiKey && shouldSearchWeb(room.messages) && latestHumanMessageText) {
        try {
          searchContext = await requestTavilySearch(tavilyApiKey, latestHumanMessageText);
        } catch {
          searchContext = [];
        }
      }

      const payload = {
        selfSeatId: seat.id,
        selfSeatLabel: formatSeatLabel(seat),
        styleHint: styleProfile.label,
        phase: room.phase,
        phaseLabel: formatPhaseLabel(room.phase),
        aliveSeats: room.seats
          .filter((candidate) => candidate.status === "alive")
          .map((candidate) => formatSeatSummary(candidate)),
        recentMessages,
        interactionFocus,
        recentVotePressure:
          room.tieSeatIds.length > 0
            ? room.tieSeatIds.map((seatId) => seatsById.get(seatId)).filter(Boolean).map((candidate) => formatSeatSummary(candidate!))
            : [],
        searchContext,
      };

      const completion = await requestCompletion(
        config,
        systemPrompt,
        payload,
        {
          temperature: 0.9,
        },
      );

      return normalizeChatLine(completion);
    },
    async chooseVote({ room, seat }) {
      const seatsById = new Map(room.seats.map((candidate) => [candidate.id, candidate]));
      const completion = await requestCompletion(
        config,
        [
          "你在一个真人聊天室中扮演普通玩家，正在投票。",
          "只返回一个 seatId，例如 seat-3，不能带解释、标点、换行之外的额外内容。",
          "投票时像真人一样依据刚才的聊天和气氛做选择，不要刻意追求完美推理。",
          "优先避开自己；如果是平票重投，只能在 tieSeatIds 里选。",
          "不要输出任何说明文字。",
        ].join(" "),
        {
          selfSeatId: seat.id,
          selfSeatLabel: formatSeatLabel(seat),
          phase: room.phase,
          phaseLabel: formatPhaseLabel(room.phase),
          aliveSeatIds: room.seats
            .filter(
              (candidate) =>
                candidate.status === "alive" && candidate.id !== seat.id,
            )
            .map((candidate) => ({
              id: candidate.id,
              label: formatSeatLabel(candidate),
            })),
          tieSeatIds: room.tieSeatIds,
          tieSeatLabels: room.tieSeatIds
            .map((seatId) => seatsById.get(seatId))
            .filter(Boolean)
            .map((candidate) => ({
              id: candidate!.id,
              label: formatSeatLabel(candidate!),
            })),
          recentMessages: formatRecentMessages(room.messages, seatsById),
        },
        {
          temperature: 0.3,
        },
      );

      return extractSeatId(completion);
    },
  };
}
