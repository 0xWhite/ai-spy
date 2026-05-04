# AI Spy MVP

一个基于 Next.js 16 App Router 的 AI 卧底聊天室 MVP。房主建房后，玩家可以通过邀请码加入，同一房间内的 AI 会在服务端参与讨论和投票。

## Run Locally

1. Install dependencies:

```bash
pnpm install
```

2. Optional: configure an OpenAI-compatible model provider:

```bash
cp .env.example .env.local
```

Available variables:

- `AI_BASE_URL`: OpenAI-compatible API base URL
- `AI_API_KEY`: API key for the model gateway
- `AI_MODEL`: model name used for room AI turns

If these variables are missing, the app automatically falls back to the built-in mock AI provider so the full MVP loop still runs locally.

3. Start the development server:

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
