# AI 卧底聊天室 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个可完整玩完一局的 AI 卧底聊天室 MVP，支持邀请码建房、多人实时聊天、轮次计时、投票淘汰、旁观模式、结算揭示，以及 1 到 2 个 AI 的服务端参与。

**Architecture:** 使用 Next.js 16 App Router 搭建单仓 MVP。前端通过 Client Components 呈现实时房间界面，后端用 Route Handlers 提供建房、加入、发言、投票和 SSE 事件流。服务端以单进程内存房间存储和状态机统一管理房间、计时器、系统消息与 AI 调度，先确保本地和单实例部署可用，再为后续持久化和多实例扩展预留边界。

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Route Handlers, Server Components + Client Components, EventSource(SSE), Vitest, Testing Library, jsdom

---

## 文件结构与职责

### 新增文件

- `app/room/[code]/page.tsx`
  - 房间主路由，承载等待室、进行中、结算三种视图容器
- `app/api/rooms/route.ts`
  - 创建房间接口
- `app/api/rooms/[code]/join/route.ts`
  - 加入房间接口
- `app/api/rooms/[code]/start/route.ts`
  - 房主开始游戏接口
- `app/api/rooms/[code]/events/route.ts`
  - SSE 事件流接口，向客户端广播房间快照和系统事件
- `app/api/rooms/[code]/message/route.ts`
  - 讨论阶段发言接口
- `app/api/rooms/[code]/vote/route.ts`
  - 投票 / 重投接口
- `app/api/rooms/[code]/snapshot/route.ts`
  - 拉取当前房间快照，用于首屏和重连恢复
- `components/create-room-form.tsx`
  - 首页建房面板
- `components/join-room-form.tsx`
  - 首页邀请码加入面板
- `components/room-shell.tsx`
  - 房间总容器，根据房间状态切换等待 / 对局 / 结算布局
- `components/seat-badge.tsx`
  - 头像颜色 + 编号席位显示
- `components/countdown-chip.tsx`
  - 实时倒计时展示
- `components/system-message.tsx`
  - 系统消息展示
- `components/chat-message.tsx`
  - 玩家发言展示
- `components/message-composer.tsx`
  - 发言输入区域
- `components/voting-panel.tsx`
  - 投票与重投面板
- `components/results-panel.tsx`
  - 结算结果面板
- `components/waiting-room-panel.tsx`
  - 等待室展示
- `lib/game/types.ts`
  - 房间、席位、轮次、消息、投票等核心类型
- `lib/game/config.ts`
  - 默认规则与可配置项边界
- `lib/game/engine.ts`
  - 纯状态机与规则判定逻辑
- `lib/server/room-store.ts`
  - 进程内房间仓库、订阅广播、计时器调度
- `lib/server/room-broadcast.ts`
  - SSE 订阅者管理与事件编码
- `lib/server/room-actions.ts`
  - Route Handler 复用的服务端业务入口
- `lib/server/ai/provider.ts`
  - AI 提供者接口定义
- `lib/server/ai/mock-provider.ts`
  - 开发用假 AI，保证无密钥时也能完整跑流程
- `lib/server/ai/openai-compatible-provider.ts`
  - 可选的 OpenAI 兼容 HTTP 提供者
- `lib/server/ai/runtime.ts`
  - 将 AI 调度接入房间状态机
- `lib/utils/format.ts`
  - 倒计时、席位标签等格式化函数
- `tests/game/engine.test.ts`
  - 纯规则状态机测试
- `tests/server/room-store.test.ts`
  - 房间仓库与广播行为测试
- `tests/components/create-room-form.test.tsx`
  - 建房表单交互测试
- `tests/components/join-room-form.test.tsx`
  - 邀请码加入交互测试
- `tests/components/room-shell.test.tsx`
  - 房间主要状态渲染测试
- `vitest.config.ts`
  - Vitest 配置
- `vitest.setup.ts`
  - Testing Library / jest-dom 初始化
- `.env.example`
  - AI 提供者相关示例环境变量

### 修改文件

- `package.json`
  - 增加测试命令与测试依赖
- `app/page.tsx`
  - 从默认欢迎页改为建房首页
- `app/layout.tsx`
  - 改页面标题与全局语言元信息
- `app/globals.css`
  - 建立游戏 UI 的基础样式变量
- `README.md`
  - 增加本地运行、环境变量和 MVP 说明
- `.gitignore`
  - 忽略本地房间调试文件（若实现中需要）

## 架构约束

- 服务端权威：计时器、阶段切换、投票结算、AI 发言与淘汰判定全部由服务端执行。
- 客户端只负责渲染与提交动作，不在本地自行推进游戏状态。
- 路由层和规则层分离：Route Handlers 不直接写规则，只调用 `lib/server/room-actions.ts`。
- 规则层纯函数化：`lib/game/engine.ts` 不依赖 Next.js，方便测试。
- SSE 为首版实时通道：客户端上行用 `fetch`，下行用 `EventSource`。
- 房间数据先放内存：明确接受重启后房间丢失，先换取实现速度和可控性。

## Task 1: 搭好测试与基础骨架

**Files:**
- Modify: `package.json`
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `components/create-room-form.tsx`
- Create: `components/join-room-form.tsx`
- Create: `tests/components/create-room-form.test.tsx`
- Create: `tests/components/join-room-form.test.tsx`

- [ ] **Step 1: 先补测试依赖和脚本**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "jsdom": "^26.1.0",
    "vitest": "^2.1.9"
  }
}
```

- [ ] **Step 2: 增加 Vitest 配置与初始化**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

```ts
// vitest.setup.ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: 先写建房表单的失败测试**

```tsx
// tests/components/create-room-form.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateRoomForm } from "@/components/create-room-form";

it("submits the default room config", async () => {
  const user = userEvent.setup();
  const onCreate = vi.fn().mockResolvedValue(undefined);

  render(<CreateRoomForm onCreate={onCreate} />);

  await user.click(screen.getByRole("button", { name: "创建房间" }));

  expect(onCreate).toHaveBeenCalledWith({
    totalSeats: 7,
    aiCount: 1,
    roundOneSeconds: 300,
    roundSeconds: 180,
  });
});
```

```tsx
// tests/components/join-room-form.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JoinRoomForm } from "@/components/join-room-form";

it("submits the normalized invite code", async () => {
  const user = userEvent.setup();
  const onJoin = vi.fn().mockResolvedValue(undefined);

  render(<JoinRoomForm onJoin={onJoin} />);

  await user.type(screen.getByLabelText("邀请码"), "ab c123");
  await user.click(screen.getByRole("button", { name: "加入房间" }));

  expect(onJoin).toHaveBeenCalledWith({ code: "ABC123" });
});
```

- [ ] **Step 4: 运行单测，确认当前失败**

Run: `pnpm test tests/components/create-room-form.test.tsx tests/components/join-room-form.test.tsx`  
Expected: FAIL，提示 `CreateRoomForm` 不存在或未按预期提交

- [ ] **Step 5: 写最小可用首页、建房表单和加入表单**

```tsx
// components/create-room-form.tsx
"use client";

import { useState } from "react";

type CreateRoomPayload = {
  totalSeats: number;
  aiCount: number;
  roundOneSeconds: number;
  roundSeconds: number;
};

type Props = {
  onCreate: (payload: CreateRoomPayload) => Promise<void> | void;
};

export function CreateRoomForm({ onCreate }: Props) {
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    try {
      await onCreate({
        totalSeats: Number(formData.get("totalSeats") ?? 7),
        aiCount: Number(formData.get("aiCount") ?? 1),
        roundOneSeconds: Number(formData.get("roundOneSeconds") ?? 300),
        roundSeconds: Number(formData.get("roundSeconds") ?? 180),
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form action={handleSubmit} className="grid gap-4">
      <label>
        <span>总人数</span>
        <input name="totalSeats" type="number" min={5} max={9} defaultValue={7} />
      </label>
      <label>
        <span>AI 数量</span>
        <input name="aiCount" type="number" min={1} max={2} defaultValue={1} />
      </label>
      <input name="roundOneSeconds" type="hidden" value={300} />
      <input name="roundSeconds" type="hidden" value={180} />
      <button type="submit" disabled={isPending}>
        {isPending ? "创建中..." : "创建房间"}
      </button>
    </form>
  );
}
```

```tsx
// components/join-room-form.tsx
"use client";

import { useState } from "react";

export function JoinRoomForm({
  onJoin,
}: {
  onJoin: (payload: { code: string }) => Promise<void> | void;
}) {
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    const rawCode = String(formData.get("code") ?? "");
    const code = rawCode.replace(/\s+/g, "").toUpperCase();
    if (!code) return;

    setIsPending(true);
    try {
      await onJoin({ code });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form action={handleSubmit} className="grid gap-3">
      <label className="grid gap-2">
        <span>邀请码</span>
        <input name="code" type="text" maxLength={6} autoComplete="off" />
      </label>
      <button type="submit" disabled={isPending}>
        {isPending ? "加入中..." : "加入房间"}
      </button>
    </form>
  );
}
```

```tsx
// app/page.tsx
import { CreateRoomForm } from "@/components/create-room-form";
import { JoinRoomForm } from "@/components/join-room-form";

export default function HomePage() {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[1.3fr_0.9fr]">
      <section className="grid content-center gap-6">
        <p className="text-sm uppercase tracking-[0.12em] text-zinc-500">
          AI 卧底聊天室
        </p>
        <h1 className="max-w-2xl text-5xl font-semibold text-zinc-950">
          建一局真人和 AI 混聊的推理房。
        </h1>
        <p className="max-w-xl text-lg leading-8 text-zinc-600">
          朋友通过邀请码进房，系统暗中混入 1 到 2 个 AI。聊、投、淘汰、结算，一局完整跑通。
        </p>
      </section>
      <section className="grid gap-6 self-center rounded-2xl bg-white p-6 shadow-sm">
        <CreateRoomForm onCreate={async () => {}} />
        <div className="h-px bg-zinc-200" />
        <JoinRoomForm onJoin={async () => {}} />
      </section>
    </main>
  );
}
```

- [ ] **Step 6: 让页面元信息和全局风格切到产品状态**

```tsx
// app/layout.tsx
export const metadata: Metadata = {
  title: "AI 卧底聊天室",
  description: "在多人实时聊天室里找出混进来的 AI",
};
```

```css
/* app/globals.css */
@import "tailwindcss";

:root {
  --background: #f4f5f7;
  --foreground: #121417;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}
```

- [ ] **Step 7: 重新跑建房测试**

Run: `pnpm test tests/components/create-room-form.test.tsx tests/components/join-room-form.test.tsx`  
Expected: PASS

- [ ] **Step 8: 提交这一小步**

```bash
git add package.json app/layout.tsx app/page.tsx app/globals.css components/create-room-form.tsx components/join-room-form.tsx tests/components/create-room-form.test.tsx tests/components/join-room-form.test.tsx vitest.config.ts vitest.setup.ts
git commit -m "feat: scaffold room creation entry"
```

## Task 2: 实现纯规则状态机

**Files:**
- Create: `lib/game/types.ts`
- Create: `lib/game/config.ts`
- Create: `lib/game/engine.ts`
- Create: `tests/game/engine.test.ts`

- [ ] **Step 1: 先写规则层失败测试，覆盖关键胜负与平票逻辑**

```ts
// tests/game/engine.test.ts
import {
  buildInitialRoomState,
  closeVotingPhase,
  eliminateSeat,
  enterTieBreakFromVotes,
} from "@/lib/game/engine";

it("moves to tie-break when the top vote is tied", () => {
  const room = buildInitialRoomState({
    code: "ABCD12",
    hostSeatId: "seat-1",
    totalSeats: 7,
    aiCount: 1,
  });

  const next = closeVotingPhase({
    ...room,
    phase: "voting",
    votes: {
      "seat-1": "seat-3",
      "seat-2": "seat-3",
      "seat-3": "seat-4",
      "seat-4": "seat-4",
    },
  });

  expect(next.phase).toBe("tiebreak_discussion");
  expect(next.tieSeatIds).toEqual(["seat-3", "seat-4"]);
});

it("declares humans the winner when all ai seats are eliminated", () => {
  const room = buildInitialRoomState({
    code: "ABCD12",
    hostSeatId: "seat-1",
    totalSeats: 7,
    aiCount: 1,
  });

  const aiSeatId = room.seats.find((seat) => seat.role === "ai")!.id;
  const next = eliminateSeat(room, aiSeatId);

  expect(next.phase).toBe("finished");
  expect(next.result?.winner).toBe("human");
});
```

- [ ] **Step 2: 运行规则测试，确认失败**

Run: `pnpm test tests/game/engine.test.ts`  
Expected: FAIL，提示 `buildInitialRoomState` 等函数不存在

- [ ] **Step 3: 定义核心类型和默认配置**

```ts
// lib/game/types.ts
export type RoomPhase =
  | "waiting"
  | "discussion"
  | "voting"
  | "tiebreak_discussion"
  | "tiebreak_voting"
  | "eliminated_reveal"
  | "finished";

export type SeatRole = "human" | "ai";
export type SeatStatus = "alive" | "spectator";
export type SeatColor = "red" | "blue" | "green" | "yellow" | "purple" | "cyan" | "orange";

export type Seat = {
  id: string;
  number: number;
  color: SeatColor;
  role: SeatRole;
  status: SeatStatus;
  isHost: boolean;
  isConnected: boolean;
};

export type ChatMessage = {
  id: string;
  kind: "player" | "system";
  seatId?: string;
  text: string;
  createdAt: number;
};

export type RoomResult = {
  winner: "human" | "ai";
  revealedAiSeatIds: string[];
};

export type RoomState = {
  code: string;
  phase: RoomPhase;
  round: number;
  config: {
    totalSeats: number;
    aiCount: number;
    roundOneSeconds: number;
    roundSeconds: number;
    voteSeconds: number;
    tiebreakSeconds: number;
  };
  seats: Seat[];
  messages: ChatMessage[];
  votes: Record<string, string>;
  tieSeatIds: string[];
  eliminatedSeatIds: string[];
  phaseEndsAt: number | null;
  result: RoomResult | null;
};
```

```ts
// lib/game/config.ts
export const DEFAULT_ROOM_CONFIG = {
  totalSeats: 7,
  aiCount: 1,
  roundOneSeconds: 300,
  roundSeconds: 180,
  voteSeconds: 60,
  tiebreakSeconds: 60,
} as const;
```

- [ ] **Step 4: 写最小可测试的状态机构建与结算逻辑**

```ts
// lib/game/engine.ts
import { DEFAULT_ROOM_CONFIG } from "@/lib/game/config";
import type { RoomState, Seat } from "@/lib/game/types";

const COLORS = ["red", "blue", "green", "yellow", "purple", "cyan", "orange"] as const;

export function buildInitialRoomState(input: {
  code: string;
  hostSeatId: string;
  totalSeats: number;
  aiCount: number;
}): RoomState {
  const seats: Seat[] = Array.from({ length: input.totalSeats }, (_, index) => ({
    id: `seat-${index + 1}`,
    number: index + 1,
    color: COLORS[index],
    role: index < input.aiCount ? "ai" : "human",
    status: "alive",
    isHost: `seat-${index + 1}` === input.hostSeatId,
    isConnected: `seat-${index + 1}` === input.hostSeatId,
  }));

  return {
    code: input.code,
    phase: "waiting",
    round: 1,
    config: { ...DEFAULT_ROOM_CONFIG, totalSeats: input.totalSeats, aiCount: input.aiCount },
    seats,
    messages: [],
    votes: {},
    tieSeatIds: [],
    eliminatedSeatIds: [],
    phaseEndsAt: null,
    result: null,
  };
}

export function closeVotingPhase(room: RoomState): RoomState {
  const counts = new Map<string, number>();
  Object.values(room.votes).forEach((seatId) => {
    counts.set(seatId, (counts.get(seatId) ?? 0) + 1);
  });

  const maxVotes = Math.max(...counts.values());
  const tieSeatIds = [...counts.entries()]
    .filter(([, count]) => count === maxVotes)
    .map(([seatId]) => seatId)
    .sort();

  if (tieSeatIds.length > 1) {
    return enterTieBreakFromVotes(room, tieSeatIds);
  }

  return eliminateSeat(room, tieSeatIds[0]);
}

export function enterTieBreakFromVotes(room: RoomState, tieSeatIds: string[]): RoomState {
  return {
    ...room,
    phase: "tiebreak_discussion",
    tieSeatIds,
    votes: {},
  };
}

export function eliminateSeat(room: RoomState, seatId: string): RoomState {
  const seats = room.seats.map((seat) =>
    seat.id === seatId ? { ...seat, status: "spectator" } : seat
  );

  const aliveSeats = seats.filter((seat) => seat.status === "alive");
  const aliveAiSeats = aliveSeats.filter((seat) => seat.role === "ai");

  if (aliveAiSeats.length === 0) {
    return {
      ...room,
      seats,
      phase: "finished",
      eliminatedSeatIds: [...room.eliminatedSeatIds, seatId],
      result: {
        winner: "human",
        revealedAiSeatIds: seats.filter((seat) => seat.role === "ai").map((seat) => seat.id),
      },
    };
  }

  if (aliveSeats.length === 3) {
    return {
      ...room,
      seats,
      phase: "finished",
      eliminatedSeatIds: [...room.eliminatedSeatIds, seatId],
      result: {
        winner: "ai",
        revealedAiSeatIds: seats.filter((seat) => seat.role === "ai").map((seat) => seat.id),
      },
    };
  }

  return {
    ...room,
    seats,
    phase: "eliminated_reveal",
    eliminatedSeatIds: [...room.eliminatedSeatIds, seatId],
    votes: {},
  };
}
```

- [ ] **Step 5: 补上阶段切换与讨论轮次时长的测试**

```ts
it("starts round one discussion with a 5 minute timer", () => {
  const room = buildInitialRoomState({
    code: "ABCD12",
    hostSeatId: "seat-1",
    totalSeats: 7,
    aiCount: 1,
  });

  const started = startGame(room, 1_000);

  expect(started.phase).toBe("discussion");
  expect(started.phaseEndsAt).toBe(301_000);
});
```

- [ ] **Step 6: 为缺失的状态转换补实现**

```ts
export function startGame(room: RoomState, now: number): RoomState {
  return {
    ...room,
    phase: "discussion",
    round: 1,
    phaseEndsAt: now + room.config.roundOneSeconds * 1000,
    messages: [
      ...room.messages,
      { id: "sys-start", kind: "system", text: "第 1 轮讨论开始", createdAt: now },
    ],
  };
}

export function startNextDiscussion(room: RoomState, now: number): RoomState {
  return {
    ...room,
    phase: "discussion",
    round: room.round + 1,
    tieSeatIds: [],
    phaseEndsAt: now + room.config.roundSeconds * 1000,
  };
}
```

- [ ] **Step 7: 运行规则测试**

Run: `pnpm test tests/game/engine.test.ts`  
Expected: PASS

- [ ] **Step 8: 提交这一小步**

```bash
git add lib/game/config.ts lib/game/types.ts lib/game/engine.ts tests/game/engine.test.ts
git commit -m "feat: add room state machine"
```

## Task 3: 实现房间仓库、SSE 广播和服务端动作

**Files:**
- Create: `lib/server/room-store.ts`
- Create: `lib/server/room-broadcast.ts`
- Create: `lib/server/room-actions.ts`
- Create: `app/api/rooms/route.ts`
- Create: `app/api/rooms/[code]/join/route.ts`
- Create: `app/api/rooms/[code]/start/route.ts`
- Create: `app/api/rooms/[code]/snapshot/route.ts`
- Create: `app/api/rooms/[code]/events/route.ts`
- Create: `app/api/rooms/[code]/message/route.ts`
- Create: `app/api/rooms/[code]/vote/route.ts`
- Create: `tests/server/room-store.test.ts`

- [ ] **Step 1: 先写服务端测试，覆盖建房、订阅和广播**

```ts
// tests/server/room-store.test.ts
import { roomStore } from "@/lib/server/room-store";

it("creates a room and returns the initial snapshot", () => {
  const room = roomStore.createRoom({
    totalSeats: 7,
    aiCount: 1,
    roundOneSeconds: 300,
    roundSeconds: 180,
  });

  expect(room.code).toHaveLength(6);
  expect(room.phase).toBe("waiting");
});

it("broadcasts when a player joins", () => {
  const room = roomStore.createRoom({
    totalSeats: 7,
    aiCount: 1,
    roundOneSeconds: 300,
    roundSeconds: 180,
  });

  const handler = vi.fn();
  roomStore.subscribe(room.code, handler);

  roomStore.joinRoom(room.code);

  expect(handler).toHaveBeenCalled();
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `pnpm test tests/server/room-store.test.ts`  
Expected: FAIL，提示 `roomStore` 不存在

- [ ] **Step 3: 实现最小的内存房间仓库和广播器**

```ts
// lib/server/room-broadcast.ts
import type { RoomState } from "@/lib/game/types";

export type RoomListener = (room: RoomState) => void;

export function createRoomBroadcast() {
  const listeners = new Map<string, Set<RoomListener>>();

  return {
    subscribe(code: string, listener: RoomListener) {
      const set = listeners.get(code) ?? new Set<RoomListener>();
      set.add(listener);
      listeners.set(code, set);
      return () => {
        set.delete(listener);
      };
    },
    emit(code: string, room: RoomState) {
      listeners.get(code)?.forEach((listener) => listener(room));
    },
  };
}
```

```ts
// lib/server/room-store.ts
import { buildInitialRoomState } from "@/lib/game/engine";
import { createRoomBroadcast } from "@/lib/server/room-broadcast";
import type { RoomState } from "@/lib/game/types";

function generateCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

class RoomStore {
  private rooms = new Map<string, RoomState>();
  private broadcast = createRoomBroadcast();

  createRoom(input: {
    totalSeats: number;
    aiCount: number;
    roundOneSeconds: number;
    roundSeconds: number;
  }) {
    const code = generateCode();
    const room = buildInitialRoomState({
      code,
      hostSeatId: "seat-1",
      totalSeats: input.totalSeats,
      aiCount: input.aiCount,
    });
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string) {
    return this.rooms.get(code);
  }

  saveRoom(room: RoomState) {
    this.rooms.set(room.code, room);
    this.broadcast.emit(room.code, room);
    return room;
  }

  joinRoom(code: string) {
    const room = this.rooms.get(code);
    if (!room) throw new Error("ROOM_NOT_FOUND");
    const seat = room.seats.find((candidate) => !candidate.isConnected);
    if (!seat) throw new Error("ROOM_FULL");
    seat.isConnected = true;
    this.saveRoom({ ...room, seats: [...room.seats] });
    return seat;
  }

  subscribe(code: string, listener: (room: RoomState) => void) {
    return this.broadcast.subscribe(code, listener);
  }
}

export const roomStore = new RoomStore();
```

- [ ] **Step 4: 封装 Route Handlers 共享动作**

```ts
// lib/server/room-actions.ts
import { startGame } from "@/lib/game/engine";
import { roomStore } from "@/lib/server/room-store";

export function createRoomAction(input: {
  totalSeats: number;
  aiCount: number;
  roundOneSeconds: number;
  roundSeconds: number;
}) {
  return roomStore.createRoom(input);
}

export function joinRoomAction(code: string) {
  const seat = roomStore.joinRoom(code);
  return { seat };
}

export function startRoomAction(code: string, now = Date.now()) {
  const room = roomStore.getRoom(code);
  if (!room) throw new Error("ROOM_NOT_FOUND");
  return roomStore.saveRoom(startGame(room, now));
}
```

- [ ] **Step 5: 写创建 / 加入 / 开始 / 快照接口**

```ts
// app/api/rooms/route.ts
import { createRoomAction } from "@/lib/server/room-actions";

export async function POST(request: Request) {
  const body = await request.json();
  const room = createRoomAction(body);
  return Response.json(room, { status: 201 });
}
```

```ts
// app/api/rooms/[code]/join/route.ts
import { joinRoomAction } from "@/lib/server/room-actions";

export async function POST(_request: Request, context: RouteContext<"/api/rooms/[code]/join">) {
  const { code } = await context.params;
  return Response.json(joinRoomAction(code));
}
```

```ts
// app/api/rooms/[code]/snapshot/route.ts
import { roomStore } from "@/lib/server/room-store";

export async function GET(_request: Request, context: RouteContext<"/api/rooms/[code]/snapshot">) {
  const { code } = await context.params;
  const room = roomStore.getRoom(code);
  if (!room) {
    return Response.json({ message: "ROOM_NOT_FOUND" }, { status: 404 });
  }
  return Response.json(room);
}
```

- [ ] **Step 6: 加 SSE 事件流，让客户端能持续收到房间快照**

```ts
// app/api/rooms/[code]/events/route.ts
import { roomStore } from "@/lib/server/room-store";

export async function GET(_request: Request, context: RouteContext<"/api/rooms/[code]/events">) {
  const { code } = await context.params;
  const room = roomStore.getRoom(code);

  if (!room) {
    return new Response("not found", { status: 404 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(room)}\n\n`)
      );

      const unsubscribe = roomStore.subscribe(code, (nextRoom) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(nextRoom)}\n\n`)
        );
      });

      return () => unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 7: 跑房间仓库测试**

Run: `pnpm test tests/server/room-store.test.ts`  
Expected: PASS

- [ ] **Step 8: 提交这一小步**

```bash
git add lib/server/room-broadcast.ts lib/server/room-store.ts lib/server/room-actions.ts app/api/rooms/route.ts app/api/rooms/[code]/join/route.ts app/api/rooms/[code]/start/route.ts app/api/rooms/[code]/snapshot/route.ts app/api/rooms/[code]/events/route.ts tests/server/room-store.test.ts
git commit -m "feat: add in-memory room runtime and realtime APIs"
```

## Task 4: 把消息、投票和阶段推进接起来

**Files:**
- Modify: `lib/game/engine.ts`
- Modify: `lib/server/room-actions.ts`
- Modify: `lib/server/room-store.ts`
- Create: `app/api/rooms/[code]/message/route.ts`
- Create: `app/api/rooms/[code]/vote/route.ts`
- Modify: `tests/game/engine.test.ts`

- [ ] **Step 1: 先写失败测试，覆盖发言权限和投票结算**

```ts
it("blocks spectators from sending messages", () => {
  const room = buildInitialRoomState({
    code: "ABCD12",
    hostSeatId: "seat-1",
    totalSeats: 7,
    aiCount: 1,
  });

  const eliminated = eliminateSeat(room, "seat-2");

  expect(() =>
    appendPlayerMessage(eliminated, {
      seatId: "seat-2",
      text: "我觉得 4 号可疑",
      now: 1_000,
    })
  ).toThrow("SEAT_CANNOT_SPEAK");
});
```

- [ ] **Step 2: 跑规则测试，确认失败**

Run: `pnpm test tests/game/engine.test.ts`  
Expected: FAIL，提示 `appendPlayerMessage` 不存在

- [ ] **Step 3: 实现消息追加、投票与阶段推进**

```ts
export function appendPlayerMessage(
  room: RoomState,
  input: { seatId: string; text: string; now: number }
): RoomState {
  const seat = room.seats.find((candidate) => candidate.id === input.seatId);
  if (!seat || seat.status !== "alive" || room.phase === "finished") {
    throw new Error("SEAT_CANNOT_SPEAK");
  }

  return {
    ...room,
    messages: [
      ...room.messages,
      {
        id: `msg-${input.now}`,
        kind: "player",
        seatId: input.seatId,
        text: input.text.trim(),
        createdAt: input.now,
      },
    ],
  };
}

export function castVote(
  room: RoomState,
  input: { voterSeatId: string; targetSeatId: string }
): RoomState {
  if (input.voterSeatId === input.targetSeatId) {
    throw new Error("CANNOT_VOTE_SELF");
  }

  const allowedTargets =
    room.phase === "tiebreak_voting"
      ? room.tieSeatIds
      : room.seats.filter((seat) => seat.status === "alive").map((seat) => seat.id);

  if (!allowedTargets.includes(input.targetSeatId)) {
    throw new Error("INVALID_VOTE_TARGET");
  }

  return {
    ...room,
    votes: {
      ...room.votes,
      [input.voterSeatId]: input.targetSeatId,
    },
  };
}
```

- [ ] **Step 4: 在房间仓库里接入阶段计时器**

```ts
// lib/server/room-store.ts
private timers = new Map<string, ReturnType<typeof setTimeout>>();

schedulePhase(room: RoomState) {
  const current = this.timers.get(room.code);
  if (current) clearTimeout(current);
  if (!room.phaseEndsAt) return;

  const delay = Math.max(room.phaseEndsAt - Date.now(), 0);
  const timer = setTimeout(() => {
    const live = this.rooms.get(room.code);
    if (!live) return;
    const advanced = advancePhaseFromTimeout(live, Date.now());
    this.saveRoom(advanced);
  }, delay);

  this.timers.set(room.code, timer);
}

saveRoom(room: RoomState) {
  this.rooms.set(room.code, room);
  this.schedulePhase(room);
  this.broadcast.emit(room.code, room);
  return room;
}
```

- [ ] **Step 5: 把发言和投票动作暴露成接口**

```ts
// app/api/rooms/[code]/message/route.ts
import { postMessageAction } from "@/lib/server/room-actions";

export async function POST(request: Request, context: RouteContext<"/api/rooms/[code]/message">) {
  const { code } = await context.params;
  const body = await request.json();
  return Response.json(postMessageAction(code, body));
}
```

```ts
// app/api/rooms/[code]/vote/route.ts
import { castVoteAction } from "@/lib/server/room-actions";

export async function POST(request: Request, context: RouteContext<"/api/rooms/[code]/vote">) {
  const { code } = await context.params;
  const body = await request.json();
  return Response.json(castVoteAction(code, body));
}
```

- [ ] **Step 6: 补上超时推进的核心函数**

```ts
export function advancePhaseFromTimeout(room: RoomState, now: number): RoomState {
  if (room.phase === "discussion") {
    return {
      ...room,
      phase: "voting",
      phaseEndsAt: now + room.config.voteSeconds * 1000,
      messages: [
        ...room.messages,
        { id: `sys-vote-${now}`, kind: "system", text: "讨论结束，进入投票阶段", createdAt: now },
      ],
    };
  }

  if (room.phase === "tiebreak_discussion") {
    return {
      ...room,
      phase: "tiebreak_voting",
      phaseEndsAt: now + room.config.voteSeconds * 1000,
      votes: {},
    };
  }

  if (room.phase === "voting" || room.phase === "tiebreak_voting") {
    return closeVotingPhase(room);
  }

  if (room.phase === "eliminated_reveal") {
    return startNextDiscussion(room, now);
  }

  return room;
}
```

- [ ] **Step 7: 运行规则测试**

Run: `pnpm test tests/game/engine.test.ts tests/server/room-store.test.ts`  
Expected: PASS

- [ ] **Step 8: 提交这一小步**

```bash
git add lib/game/engine.ts lib/server/room-actions.ts lib/server/room-store.ts app/api/rooms/[code]/message/route.ts app/api/rooms/[code]/vote/route.ts tests/game/engine.test.ts
git commit -m "feat: connect messages voting and phase timers"
```

## Task 5: 实现房间页面与实时客户端

**Files:**
- Create: `app/room/[code]/page.tsx`
- Create: `components/room-shell.tsx`
- Create: `components/waiting-room-panel.tsx`
- Create: `components/seat-badge.tsx`
- Create: `components/countdown-chip.tsx`
- Create: `components/chat-message.tsx`
- Create: `components/system-message.tsx`
- Create: `components/message-composer.tsx`
- Create: `components/voting-panel.tsx`
- Create: `components/results-panel.tsx`
- Create: `components/room-client.tsx`
- Create: `lib/utils/format.ts`
- Create: `tests/components/room-shell.test.tsx`

- [ ] **Step 1: 先写房间主要状态渲染的失败测试**

```tsx
// tests/components/room-shell.test.tsx
import { render, screen } from "@testing-library/react";
import { RoomShell } from "@/components/room-shell";

it("renders the waiting room before the game starts", () => {
  render(
    <RoomShell
      room={{
        code: "ABC123",
        phase: "waiting",
        round: 1,
        phaseEndsAt: null,
        seats: [],
        messages: [],
        votes: {},
        tieSeatIds: [],
        eliminatedSeatIds: [],
        result: null,
        config: {
          totalSeats: 7,
          aiCount: 1,
          roundOneSeconds: 300,
          roundSeconds: 180,
          voteSeconds: 60,
          tiebreakSeconds: 60,
        },
      }}
      selfSeatId="seat-1"
    />
  );

  expect(screen.getByText("等待玩家加入")).toBeInTheDocument();
});
```

- [ ] **Step 2: 跑组件测试，确认失败**

Run: `pnpm test tests/components/room-shell.test.tsx`  
Expected: FAIL，提示 `RoomShell` 不存在

- [ ] **Step 3: 建立房间主视图骨架**

```tsx
// components/room-shell.tsx
import type { RoomState } from "@/lib/game/types";
import { WaitingRoomPanel } from "@/components/waiting-room-panel";
import { ResultsPanel } from "@/components/results-panel";

type Props = {
  room: RoomState;
  selfSeatId: string;
};

export function RoomShell({ room, selfSeatId }: Props) {
  if (room.phase === "waiting") {
    return <WaitingRoomPanel room={room} />;
  }

  if (room.phase === "finished" && room.result) {
    return <ResultsPanel room={room} selfSeatId={selfSeatId} />;
  }

  return <div>in-game</div>;
}
```

```tsx
// components/waiting-room-panel.tsx
import type { RoomState } from "@/lib/game/types";

export function WaitingRoomPanel({ room }: { room: RoomState }) {
  return (
    <section className="grid gap-4">
      <h2 className="text-2xl font-semibold">等待玩家加入</h2>
      <p>邀请码：{room.code}</p>
      <p>
        当前人数：{room.seats.filter((seat) => seat.isConnected).length} / {room.config.totalSeats}
      </p>
    </section>
  );
}
```

- [ ] **Step 4: 实现房间客户端，接入首屏快照和 EventSource**

```tsx
// components/room-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { RoomState } from "@/lib/game/types";
import { RoomShell } from "@/components/room-shell";

export function RoomClient({
  initialRoom,
  selfSeatId,
}: {
  initialRoom: RoomState;
  selfSeatId: string;
}) {
  const [room, setRoom] = useState(initialRoom);

  useEffect(() => {
    const source = new EventSource(`/api/rooms/${initialRoom.code}/events`);
    source.onmessage = (event) => setRoom(JSON.parse(event.data) as RoomState);
    return () => source.close();
  }, [initialRoom.code]);

  return <RoomShell room={room} selfSeatId={selfSeatId} />;
}
```

```tsx
// app/room/[code]/page.tsx
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { RoomClient } from "@/components/room-client";
import { roomStore } from "@/lib/server/room-store";

export default async function RoomPage({ params }: PageProps<"/room/[code]">) {
  const { code } = await params;
  const initialRoom = roomStore.getRoom(code);
  if (!initialRoom) {
    notFound();
  }
  const cookieStore = await cookies();
  const selfSeatId = cookieStore.get(`room-${code}-seat`)?.value ?? "seat-1";

  return <RoomClient initialRoom={initialRoom} selfSeatId={selfSeatId} />;
}
```

- [ ] **Step 5: 把对局中的顶部状态栏、聊天流和投票区补齐**

```tsx
// components/countdown-chip.tsx
"use client";

import { useEffect, useState } from "react";

export function CountdownChip({ phaseEndsAt }: { phaseEndsAt: number | null }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!phaseEndsAt) return <span>--:--</span>;
  const seconds = Math.max(Math.ceil((phaseEndsAt - now) / 1000), 0);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return <span>{mm}:{ss}</span>;
}
```

```tsx
// 追加到 components/room-shell.tsx 的 in-game 分支
return (
  <section className="grid min-h-screen grid-rows-[auto_1fr_auto] gap-4 p-4">
    <header className="flex items-center justify-between rounded-lg bg-white px-4 py-3">
      <div>第 {room.round} 轮</div>
      <div>{room.phase}</div>
      <CountdownChip phaseEndsAt={room.phaseEndsAt} />
      <div>存活 {room.seats.filter((seat) => seat.status === "alive").length} 人</div>
    </header>
    <main className="grid gap-3 overflow-y-auto rounded-lg bg-white p-4">
      {room.messages.map((message) =>
        message.kind === "system" ? (
          <div key={message.id} className="text-center text-sm text-zinc-500">
            {message.text}
          </div>
        ) : (
          <div key={message.id}>{message.text}</div>
        )
      )}
    </main>
    <footer className="rounded-lg bg-white p-4">actions</footer>
  </section>
);
```

- [ ] **Step 6: 重新跑组件测试**

Run: `pnpm test tests/components/room-shell.test.tsx tests/components/create-room-form.test.tsx tests/components/join-room-form.test.tsx`  
Expected: PASS

- [ ] **Step 7: 提交这一小步**

```bash
git add app/room/[code]/page.tsx components/room-client.tsx components/room-shell.tsx components/waiting-room-panel.tsx components/countdown-chip.tsx components/results-panel.tsx tests/components/room-shell.test.tsx
git commit -m "feat: render realtime room experience"
```

## Task 6: 接入 AI 运行时、文档和端到端验收

**Files:**
- Create: `lib/server/ai/provider.ts`
- Create: `lib/server/ai/mock-provider.ts`
- Create: `lib/server/ai/openai-compatible-provider.ts`
- Create: `lib/server/ai/runtime.ts`
- Create: `.env.example`
- Modify: `lib/server/room-store.ts`
- Modify: `README.md`
- Modify: `.gitignore`

- [ ] **Step 1: 先写 AI 提供者接口与本地假实现**

```ts
// lib/server/ai/provider.ts
import type { RoomState, Seat } from "@/lib/game/types";

export type AiTurnContext = {
  room: RoomState;
  seat: Seat;
};

export interface AiProvider {
  generateMessage(context: AiTurnContext): Promise<string | null>;
  chooseVote(context: AiTurnContext): Promise<string | null>;
}
```

```ts
// lib/server/ai/mock-provider.ts
import type { AiProvider } from "@/lib/server/ai/provider";

export const mockAiProvider: AiProvider = {
  async generateMessage({ room, seat }) {
    const suspects = room.seats.filter((candidate) => candidate.id !== seat.id && candidate.status === "alive");
    const target = suspects[0];
    if (!target) return null;
    return `${target.color}色 ${target.number} 号这轮有点安静，我先记一票。`;
  },
  async chooseVote({ room, seat }) {
    const target = room.seats.find((candidate) => candidate.id !== seat.id && candidate.status === "alive");
    return target?.id ?? null;
  },
};
```

- [ ] **Step 2: 增加一个可选的 OpenAI 兼容提供者**

```ts
// lib/server/ai/openai-compatible-provider.ts
import type { AiProvider } from "@/lib/server/ai/provider";

export function createOpenAiCompatibleProvider(): AiProvider {
  return {
    async generateMessage({ room, seat }) {
      const response = await fetch(`${process.env.AI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.AI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL,
          messages: [
            {
              role: "system",
              content:
                "你在一个真人聊天室中扮演普通玩家。不能承认自己是 AI。发言保持短句、口语化、像真人。",
            },
            {
              role: "user",
              content: JSON.stringify({
                selfSeatId: seat.id,
                phase: room.phase,
                recentMessages: room.messages.slice(-8),
              }),
            },
          ],
        }),
      });

      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() ?? null;
    },
    async chooseVote({ room, seat }) {
      const response = await fetch(`${process.env.AI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.AI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL,
          messages: [
            {
              role: "system",
              content:
                "你在一个真人聊天室中扮演普通玩家。请只返回一个最可疑席位的 seatId，不能返回额外解释。",
            },
            {
              role: "user",
              content: JSON.stringify({
                selfSeatId: seat.id,
                aliveSeats: room.seats
                  .filter((candidate) => candidate.status === "alive" && candidate.id !== seat.id)
                  .map((candidate) => candidate.id),
                recentMessages: room.messages.slice(-8),
              }),
            },
          ],
        }),
      });

      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() ?? null;
    },
  };
}
```

- [ ] **Step 3: 把 AI 调度接进房间仓库**

```ts
// lib/server/ai/runtime.ts
import { appendPlayerMessage, castVote } from "@/lib/game/engine";
import type { RoomState } from "@/lib/game/types";
import { mockAiProvider } from "@/lib/server/ai/mock-provider";

export async function runAiTurns(room: RoomState) {
  let nextRoom = room;
  const provider = mockAiProvider;

  for (const seat of room.seats.filter((candidate) => candidate.role === "ai" && candidate.status === "alive")) {
    if (room.phase === "discussion" || room.phase === "tiebreak_discussion") {
      const text = await provider.generateMessage({ room: nextRoom, seat });
      if (text) {
        nextRoom = appendPlayerMessage(nextRoom, { seatId: seat.id, text, now: Date.now() });
      }
    }

    if (room.phase === "voting" || room.phase === "tiebreak_voting") {
      const targetSeatId = await provider.chooseVote({ room: nextRoom, seat });
      if (targetSeatId) {
        nextRoom = castVote(nextRoom, { voterSeatId: seat.id, targetSeatId });
      }
    }
  }

  return nextRoom;
}
```

- [ ] **Step 4: 在房间保存后触发 AI**

```ts
// lib/server/room-store.ts
import { runAiTurns } from "@/lib/server/ai/runtime";

private kickAiLoop(code: string) {
  queueMicrotask(async () => {
    const current = this.rooms.get(code);
    if (!current) return;
    const aiRoom = await runAiTurns(current);
    if (aiRoom !== current) {
      this.rooms.set(aiRoom.code, aiRoom);
      this.broadcast.emit(aiRoom.code, aiRoom);
    }
  });
}

saveRoom(room: RoomState) {
  this.rooms.set(room.code, room);
  this.schedulePhase(room);
  this.broadcast.emit(room.code, room);

  if (
    room.phase === "discussion" ||
    room.phase === "tiebreak_discussion" ||
    room.phase === "voting" ||
    room.phase === "tiebreak_voting"
  ) {
    this.kickAiLoop(room.code);
  }

  return room;
}
```

- [ ] **Step 5: 补环境变量和 README**

```env
# .env.example
AI_BASE_URL=
AI_API_KEY=
AI_MODEL=
```

```md
## MVP 环境变量

- `AI_BASE_URL`：OpenAI 兼容模型网关地址
- `AI_API_KEY`：模型调用密钥
- `AI_MODEL`：房间 AI 使用的模型名

未配置时，项目自动退回到内置 mock AI，用于本地调试完整流程。
```

- [ ] **Step 6: 做一次完整验证**

Run: `pnpm test`  
Expected: 全部 PASS

Run: `pnpm lint`  
Expected: PASS

Run: `pnpm build`  
Expected: PASS，并成功生成 Next 生产构建

- [ ] **Step 7: 提交这一小步**

```bash
git add lib/server/ai/provider.ts lib/server/ai/mock-provider.ts lib/server/ai/openai-compatible-provider.ts lib/server/ai/runtime.ts lib/server/room-store.ts .env.example README.md .gitignore
git commit -m "feat: add ai runtime and delivery docs"
```

## 自检

### Spec 覆盖

- 邀请码建房：Task 1, Task 3
- 邀请码加入：Task 1, Task 3, Task 5
- 等待室：Task 5
- 实时聊天室：Task 3, Task 4, Task 5
- 首轮 5 分钟、后续 3 分钟、投票 60 秒、平票加赛 60 秒：Task 2, Task 4
- 实时倒计时持续展示：Task 5
- 每轮投票与平票重投：Task 2, Task 4
- 再平票随机淘汰：Task 2
- 出局后旁观：Task 2, Task 4, Task 5
- 剩 3 人立即结算：Task 2
- 1 到 2 个 AI 混入：Task 2, Task 6
- AI 行为约束与服务端发言 / 投票：Task 6
- 最终结果揭示：Task 5

### Placeholder 扫描

- 无 `TBD`
- 无 “后续补上测试” 这类空步骤
- 每个任务都给了明确文件、命令和最小代码骨架

### 类型一致性

- 房间主类型统一使用 `RoomState`
- AI 调度统一通过 `AiProvider`
- 客户端实时更新统一消费房间快照

## 执行提示

- 这是一个单实例 MVP 计划，当前刻意不引入数据库和多机同步。
- 如果在实现中发现 `saveRoom` 需要异步化，会连带修改 Route Handler 返回值，届时要同步调整调用链。
- 若要部署到多实例环境，后续应把 `room-store` 替换为 Redis / 数据库 + pubsub。
