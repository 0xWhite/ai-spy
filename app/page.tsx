import { CreateRoomForm } from "@/components/create-room-form";
import { JoinRoomForm } from "@/components/join-room-form";

type HomePageProps = {
  searchParams?: Promise<{
    code?: string;
    error?: string;
  }>;
};

function getHomePageJoinErrorMessage(error: string | undefined) {
  if (error === "seat-required") {
    return "请先通过首页的邀请码加入房间，再进入游戏。";
  }
  if (error === "room-closed") {
    return "房间已被房主解散。";
  }

  return undefined;
}

function BrandBadgeIcon() {
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(180deg,#92d8ff_0%,#3f86ff_100%)] text-[#041325] shadow-[0_8px_20px_rgba(63,134,255,0.4)]">
      <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
        <path
          d="M9 4.5V3m6 1.5V3M8 9.5h.01M16 9.5h.01M9.5 14h5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.8"
        />
        <rect
          x="5"
          y="6"
          width="14"
          height="11"
          rx="3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
    </span>
  );
}

function FeatureIcon({
  children,
  glowClassName,
}: {
  children: React.ReactNode;
  glowClassName: string;
}) {
  return (
    <div className="grid justify-items-center gap-4">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <div className={`absolute inset-x-5 bottom-1 h-10 rounded-[50%] blur-xl ${glowClassName}`} />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-[1.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,30,55,0.96)_0%,rgba(10,16,30,0.98)_100%)] shadow-[0_18px_30px_rgba(5,10,20,0.45)]">
          {children}
        </div>
      </div>
    </div>
  );
}

function PeopleIcon() {
  return (
    <svg aria-hidden="true" className="h-9 w-9 text-[#73b8ff]" viewBox="0 0 24 24">
      <path
        d="M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8 1.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 20a5 5 0 0 1 9 0M14 20a4 4 0 0 1 6.5-3.1"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg aria-hidden="true" className="h-9 w-9 text-[#6ef4d0]" viewBox="0 0 24 24">
      <path
        d="M6 18.5V15a6 6 0 0 1 6-6h4a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4H10l-4 2.5Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M10 13h.01M14 13h.01M18 13h.01"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

function BotIcon() {
  return (
    <svg aria-hidden="true" className="h-9 w-9 text-[#9a84ff]" viewBox="0 0 24 24">
      <path
        d="M12 4V2.75m-4 7.25h.01m7.98 0H16M8 17.25h8M7.5 6.5h9A2.5 2.5 0 0 1 19 9v6a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V9a2.5 2.5 0 0 1 2.5-2.5Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function SectionIcon({
  path,
}: {
  path: React.ReactNode;
}) {
  return (
    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#2d5ccf] bg-[linear-gradient(180deg,rgba(26,57,131,0.72)_0%,rgba(10,21,45,0.96)_100%)] text-[#79a8ff] shadow-[0_10px_24px_rgba(39,90,210,0.28)]">
      <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
        {path}
      </svg>
    </span>
  );
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialCode = resolvedSearchParams?.code?.toUpperCase();
  const joinErrorMessage = getHomePageJoinErrorMessage(resolvedSearchParams?.error);

  return (
    <main className="relative h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(18,44,96,0.38),transparent_33%),linear-gradient(180deg,#040b18_0%,#020711_100%)] px-5 py-5 text-white md:px-8 md:py-6">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute left-[11%] top-[16%] h-1 w-1 rounded-full bg-[#2f66f5]" />
        <div className="absolute left-[36%] top-[28%] h-1.5 w-1.5 rounded-full bg-[#2f66f5]" />
        <div className="absolute left-[29%] top-[44%] h-1 w-1 rounded-full bg-[#7fb8ff]" />
        <div className="absolute left-[45%] top-[13%] h-1 w-1 rounded-full bg-[#4edac8]" />
        <div className="absolute left-[18%] top-[64%] h-[22rem] w-[32rem] rounded-[50%] border border-[#103a8f]/70" />
        <div className="absolute left-[10%] top-[57%] h-[28rem] w-[40rem] rounded-[50%] border border-[#0a2358]/70" />
      </div>

      <div className="relative mx-auto grid h-full w-full max-w-[1700px] items-center gap-8 lg:grid-cols-[1.06fr_0.94fr]">
          <section className="grid gap-8 self-center lg:pr-6">
            <div className="grid gap-6">
              <div className="inline-flex w-fit items-center gap-3 rounded-full border border-[#2457c8] bg-[rgba(10,20,39,0.78)] px-5 py-3 shadow-[0_12px_28px_rgba(24,64,156,0.24)]">
                <BrandBadgeIcon />
                <span className="text-xl font-semibold tracking-[0.02em] text-white">
                  AI 卧底聊天室
                </span>
              </div>

              <div className="grid gap-5">
                <h1 className="max-w-4xl text-4xl font-semibold leading-[1] tracking-[0.01em] text-white sm:text-5xl lg:text-[4.9rem]">
                  建一局真人和
                  <br />
                  <span className="bg-[linear-gradient(180deg,#86d9ff_0%,#2f66f5_76%)] bg-clip-text text-transparent">
                    AI 混聊
                  </span>
                  的推理房
                </h1>
                <p className="max-w-2xl text-xl leading-9 text-[#9fb0cc]">
                  朋友通过邀请码进房，系统暗中混入 1 到 2 个 AI。
                  <br />
                  聊、投、淘汰、结算，一局完整畅通。
                </p>
              </div>
            </div>

            <div className="grid gap-6 pt-2 sm:grid-cols-3">
              <div className="grid gap-4">
                <FeatureIcon glowClassName="bg-[rgba(57,136,255,0.42)]">
                  <PeopleIcon />
                </FeatureIcon>
                <div className="grid gap-2">
                  <h2 className="text-2xl font-semibold text-white">默认 7 人</h2>
                  <p className="max-w-xs text-base leading-7 text-[#9aa7bf]">
                    开局配置已经备好，适合直接拉朋友进房。
                  </p>
                </div>
              </div>
              <div className="grid gap-4">
                <FeatureIcon glowClassName="bg-[rgba(57,232,196,0.38)]">
                  <ChatIcon />
                </FeatureIcon>
                <div className="grid gap-2">
                  <h2 className="text-2xl font-semibold text-white">实时轮次</h2>
                  <p className="max-w-xs text-base leading-7 text-[#9aa7bf]">
                    讨论、投票、淘汰和结算都会按阶段推进。
                  </p>
                </div>
              </div>
              <div className="grid gap-4">
                <FeatureIcon glowClassName="bg-[rgba(128,92,255,0.4)]">
                  <BotIcon />
                </FeatureIcon>
                <div className="grid gap-2">
                  <h2 className="text-2xl font-semibold text-white">AI 混入</h2>
                  <p className="max-w-xs text-base leading-7 text-[#9aa7bf]">
                    每局可混入 1 到 2 个 AI，身份在结算前保密。
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 self-center rounded-[1.75rem] border border-white/12 bg-[linear-gradient(180deg,rgba(19,28,46,0.97)_0%,rgba(11,17,30,0.98)_100%)] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.35)] md:p-7">
            <div className="grid gap-3">
              <div className="flex items-start gap-4">
                <SectionIcon
                  path={(
                    <path
                      d="M12 5v14M5 12h14"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="2.2"
                    />
                  )}
                />
                <div className="grid gap-2">
                  <h2 className="text-[2rem] font-semibold leading-tight text-white">
                    创建新房间
                  </h2>
                  <p className="text-base leading-7 text-[#95a3bc]">
                    用默认配置直接开局，或者自定义调整本局人数和 AI 数量。
                  </p>
                </div>
              </div>
              <CreateRoomForm />
            </div>

            <div className="h-px bg-white/10" />

            <div className="grid gap-3">
              <div className="flex items-start gap-4">
                <SectionIcon
                  path={(
                    <path
                      d="M5 12h14M13 6l6 6-6 6"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.2"
                    />
                  )}
                />
                <div className="grid gap-2">
                  <h2 className="text-[2rem] font-semibold leading-tight text-white">
                    加入已有房间
                  </h2>
                  <p className="text-base leading-7 text-[#95a3bc]">
                    输入 6 位邀请码
                  </p>
                </div>
              </div>
              <JoinRoomForm defaultCode={initialCode} errorMessage={joinErrorMessage} />
            </div>
          </section>
      </div>
    </main>
  );
}
