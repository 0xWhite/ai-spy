# AI Spy MVP

一个基于 Next.js 16 App Router 的 AI 卧底聊天室 MVP。房主建房后，玩家可以通过邀请码加入，同一房间内的 AI 会在服务端参与讨论和投票。

## Run Locally

1. Install dependencies:

```bash
pnpm install
```

2. Create a local env file:

```bash
cp .env.example .env.local
```

Available variables:

- `REDIS_URL`: Redis connection string used for shared room state and multiplayer sync
- `ROOM_SEAT_COOKIE_SECRET`: stable HMAC secret for signed seat cookies
- `ROOM_SEAT_COOKIE_SECURE`: set to `true` only when the app is served over HTTPS
- `AI_BASE_URL`: OpenAI-compatible API base URL
- `AI_API_KEY`: API key for the model gateway
- `AI_MODEL`: model name used for room AI turns
- `TAVILY_API_KEY`: optional Tavily API key used for on-demand web search when recent chat messages are clearly time-sensitive

For local multiplayer testing, Redis should be running through Docker on `127.0.0.1:6379`. If the AI variables are missing, the app automatically falls back to the built-in mock AI provider so the full MVP loop still runs locally. If `TAVILY_API_KEY` is present, the room AI will only search the web for clearly time-sensitive prompts such as “今天谁赢了”“最近谁最火”“现在热搜是什么”.

3. Start Redis with Docker:

```bash
docker compose up -d redis
```

4. Start the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification

Core verification commands for this MVP:

```bash
pnpm test
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```
