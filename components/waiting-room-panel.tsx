import type { ReactNode } from "react";
import { getMinConnectedToStart } from "@/lib/game/config";
import type { WaitingClientSeatState } from "@/lib/room-snapshot";
import { toast } from "sonner";

type WaitingRoomPanelProps = {
  code: string;
  seats: WaitingClientSeatState[];
  aiCount: number;
  totalSeats: number;
  selfSeatId: string | null;
  onStart?: () => Promise<void> | void;
  onClose?: () => Promise<void> | void;
  onLeave?: () => Promise<void> | void;
  errorMessage?: string | null;
  isStarting?: boolean;
  isClosing?: boolean;
  isLeaving?: boolean;
};

const WAITING_RULES: Array<{
  icon: ReactNode;
  text: string;
}> = [
  {
    icon: (
      <path
        d="M7 17.5V14a5 5 0 0 1 5-5h3a4 4 0 0 1 4 4v1.5a4 4 0 0 1-4 4H11l-4 2.5Z M11 13h.01M14 13h.01M17 13h.01"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    ),
    text: "讨论结束后自动进入投票。",
  },
  {
    icon: (
      <path
        d="M7 18a4.5 4.5 0 0 1 8 0M16.5 17.5a3.5 3.5 0 0 1 5 0M10 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    ),
    text: "被淘汰席位会转入旁观。",
  },
  {
    icon: (
      <path
        d="m12 4 6 2.7v4.4c0 3.4-2.2 6.4-6 8.9-3.8-2.5-6-5.5-6-8.9V6.7L12 4Zm-2.3 7.1 1.6 1.6 3.2-3.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    ),
    text: "所有 AI 出局则人类获胜。",
  },
  {
    icon: (
      <path
        d="M8 6.5V5m8 1.5V5M6 8h12v1.5A4.5 4.5 0 0 1 13.5 14H10.5A4.5 4.5 0 0 1 6 9.5V8Zm1.5 0H5.8a1.8 1.8 0 0 0 0 3.6H7m9.5-3.6h1.7a1.8 1.8 0 0 1 0 3.6H17M10 17h4M9 20h6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    ),
    text: "仅剩 3 名存活者且 AI 仍在场则 AI 获胜。",
  },
];

function ClockIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path
        d="M12 7.5v5l3 1.8M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function SeatPanelIcon() {
  return (
    <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24">
      <path
        d="M8 5h8v7a4 4 0 0 1-4 4 4 4 0 0 1-4-4V5Zm1 11v3m6-3v3M6 20h12"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function PulseIcon() {
  return (
    <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24">
      <path
        d="M3 12h4l2.2-5 3.6 10 2.2-5H21"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path
        d="M9 9.5h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 17 20.5H9A1.5 1.5 0 0 1 7.5 19v-8A1.5 1.5 0 0 1 9 9.5Zm-3-6h8A1.5 1.5 0 0 1 15.5 5v1.5H9A3.5 3.5 0 0 0 5.5 10v6.5H5A1.5 1.5 0 0 1 3.5 15V5A1.5 1.5 0 0 1 5 3.5Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path
        d="M8 10V8a4 4 0 1 1 8 0v2m-9 0h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path
        d="m8 6 10 6-10 6V6Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function CrownIcon({ highlighted }: { highlighted: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-6 w-6 ${highlighted ? "text-[#ff4b78]" : "text-[#ff4b78]"}`}
      viewBox="0 0 24 24"
    >
      <path
        d="m5 18 1.4-8 4.1 3.3L12 7l1.5 6.3 4.1-3.3L19 18H5Zm1.2 0h11.6M8.5 20h7"
        fill="currentColor"
      />
    </svg>
  );
}

function WaitingSeatCard({
  seat,
  isSelf,
}: {
  seat: WaitingClientSeatState;
  isSelf: boolean;
}) {
  const isEmpty = !seat.connected;
  const title = isEmpty ? "空位" : seat.isHost ? "房主已加入" : "玩家已加入";
  const subtitle = isEmpty
    ? "等待玩家加入"
    : seat.isHost
      ? "等待开始后随机分配正式席位"
      : "开局时会随机获得颜色和号码";

  return (
    <article
      className={`grid gap-3 rounded-[1.65rem] border px-6 py-5 shadow-[0_18px_40px_rgba(31,60,128,0.08)] transition ${
        isEmpty
          ? "border-dashed border-[#dbe6fb] bg-[linear-gradient(180deg,#ffffff_0%,#f9fbff_100%)] text-[#0d2248]"
          : isSelf
            ? "border-[#9fd0ad] bg-[linear-gradient(180deg,#f5fff7_0%,#eefbf2_100%)] text-[#0d2248] shadow-[0_22px_42px_rgba(76,136,96,0.18)]"
            : "border-[#cfe9d7] bg-[linear-gradient(180deg,#f5fff7_0%,#eefbf2_100%)] text-[#0d2248]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <span
            className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border text-sm font-semibold ${
              isEmpty
                ? "border-[#d8e6ff] bg-[#f7faff] text-[#8aa0c6]"
                : "border-[#d8e6ff] bg-[#f4f7ff] text-[#4c6793]"
            }`}
          >
            {seat.isHost ? "房主" : isEmpty ? "--" : "占位"}
          </span>
          <div className="grid gap-1">
            <span className="text-[2rem] font-semibold leading-none tracking-[0.01em]">
              {title}
            </span>
            <span
              className={`text-sm font-medium ${
                isSelf ? "text-[#466684]" : "text-[#5e7397]"
              }`}
            >
              {subtitle}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isSelf ? (
            <span
              className={`inline-flex h-8 items-center justify-center rounded-full px-3 text-xs font-semibold tracking-[0.08em] ${
                isEmpty
                  ? "border border-[#d8e6ff] bg-[#f7faff] text-[#8aa0c6]"
                  : "bg-[#d9f0df] text-[#2d6b3e]"
              }`}
            >
              你
            </span>
          ) : null}
          {!isEmpty && seat.isHost ? <CrownIcon highlighted={isSelf} /> : null}
        </div>
      </div>
    </article>
  );
}

function WaitingRuleCard({
  icon,
  text,
}: {
  icon: ReactNode;
  text: string;
}) {
  return (
    <li className="flex items-center gap-4 rounded-[1.5rem] border border-[#e7eefb] bg-white px-5 py-5 shadow-[0_18px_40px_rgba(31,60,128,0.06)]">
      <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#eff5ff_0%,#f8fbff_100%)] text-[#1f6feb]">
        <svg aria-hidden="true" className="h-7 w-7" viewBox="0 0 24 24">
          {icon}
        </svg>
      </span>
      <span className="text-xl leading-9 text-[#17315f]">{text}</span>
    </li>
  );
}

export function WaitingRoomPanel({
  code,
  seats,
  aiCount,
  totalSeats,
  selfSeatId,
  onStart,
  onClose,
  onLeave,
  errorMessage = null,
  isStarting = false,
  isClosing = false,
  isLeaving = false,
}: WaitingRoomPanelProps) {
  const connectedCount = seats.filter((seat) => seat.connected).length;
  const selfSeat = seats.find((seat) => seat.id === selfSeatId);
  const canStart = selfSeat?.isHost && connectedCount >= getMinConnectedToStart();
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("邀请码已复制");
    } catch {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = code;
        textArea.setAttribute("readonly", "true");
        textArea.style.position = "absolute";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        toast.success("邀请码已复制");
      } catch {
        toast.error("复制失败，请手动复制邀请码");
      }
    }
  };

  return (
    <section className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(157,186,255,0.26),transparent_28%),linear-gradient(180deg,#f4f7ff_0%,#eef3ff_100%)] px-5 py-5 text-[#0b2147] lg:px-6 lg:py-6">
      <div className="mx-auto grid h-full w-full max-w-[1700px] gap-5">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#d9e5fb] bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(244,248,255,0.96)_55%,rgba(237,244,255,0.98)_100%)] px-8 py-7 shadow-[0_24px_50px_rgba(90,122,188,0.12)] lg:px-10 lg:py-8">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-[38%] bg-[radial-gradient(circle_at_70%_32%,rgba(210,223,255,0.75),transparent_44%),radial-gradient(circle_at_48%_56%,rgba(230,238,255,0.78),transparent_28%)]" />
          <div className="pointer-events-none absolute right-[18%] top-[24%] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(223,233,255,0.72),transparent_68%)] blur-2xl" />
          <div className="relative grid gap-8">
            <div className="flex items-center gap-4 text-[#1f6feb]">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#eff5ff]">
                <ClockIcon />
              </span>
              <p className="text-2xl font-semibold tracking-[0.01em] text-[#112853]">等待开局</p>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="grid gap-5">
                <div className="flex flex-wrap items-center gap-4">
                  <h1 className="text-[4.25rem] font-semibold leading-none tracking-[0.02em] text-[#081b45] lg:text-[4.8rem]">
                    {code}
                  </h1>
                  <button
                    aria-label="复制邀请码"
                    className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d8e6ff] bg-[linear-gradient(180deg,#ffffff_0%,#f5f8ff_100%)] text-[#4b628b] shadow-[0_12px_28px_rgba(60,98,164,0.08)] transition hover:border-[#bfd2f6] hover:bg-[#f8fbff] hover:text-[#1f6feb]"
                    onClick={() => void handleCopyCode()}
                    title="复制邀请码"
                    type="button"
                  >
                    <CopyIcon />
                  </button>
                </div>
                <p className="flex items-center gap-3 text-[1.5rem] text-[#4b628b] lg:text-[1.65rem]">
                  <svg aria-hidden="true" className="h-7 w-7 text-[#5875a4]" viewBox="0 0 24 24">
                    <path
                      d="M7 18a4.5 4.5 0 0 1 8 0M16.5 17.5a3.5 3.5 0 0 1 5 0M10 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="1.9"
                    />
                  </svg>
                  <span>{connectedCount} / {seats.length} 已连接</span>
                </p>
                <p className="text-base font-medium text-[#5e7397] lg:text-lg">
                  本局共 {totalSeats} 个正式席位，其中会混入 {aiCount} 个 AI
                </p>
                {errorMessage ? (
                  <p className="rounded-2xl border border-[#ffd7db] bg-[#fff5f6] px-4 py-3 text-base font-medium text-[#c93f5f] shadow-[0_10px_24px_rgba(201,63,95,0.08)]">
                    {errorMessage}
                  </p>
                ) : null}
              </div>

              {selfSeat?.isHost ? (
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl border border-[#f3c0cb] bg-[linear-gradient(180deg,#fff3f5_0%,#ffeff2_100%)] px-6 text-[1.35rem] font-semibold text-[#f04e6f] shadow-[0_12px_28px_rgba(240,78,111,0.12)] transition hover:border-[#ef9fb2] hover:bg-[#fff0f3] disabled:cursor-not-allowed disabled:opacity-55"
                    disabled={isClosing}
                    onClick={() => void onClose?.()}
                    type="button"
                  >
                    <LockIcon />
                    {isClosing ? "解散中..." : "解散房间"}
                  </button>
                  <button
                    className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl border border-[#c9ddff] bg-[linear-gradient(180deg,#edf4ff_0%,#dceaff_100%)] px-6 text-[1.35rem] font-semibold text-[#1f6feb] shadow-[0_12px_28px_rgba(59,120,239,0.12)] transition hover:border-[#a8cbff] hover:bg-[#e9f2ff] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!canStart || isStarting || isClosing}
                    onClick={() => void onStart?.()}
                    type="button"
                  >
                    <PlayIcon />
                    {isStarting ? "开局中..." : "开始游戏"}
                  </button>
                </div>
              ) : selfSeat ? (
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl border border-[#d8e3f8] bg-[linear-gradient(180deg,#ffffff_0%,#f5f8ff_100%)] px-6 text-[1.35rem] font-semibold text-[#385784] shadow-[0_12px_28px_rgba(60,98,164,0.08)] transition hover:border-[#bfd2f6] hover:bg-[#f8fbff] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isLeaving}
                    onClick={() => void onLeave?.()}
                    type="button"
                  >
                    {isLeaving ? "退出中..." : "退出房间"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <div className="grid min-h-0 gap-5 lg:grid-cols-[1.35fr_0.85fr]">
          <section className="grid min-h-0 gap-5 rounded-[2rem] border border-[#d9e5fb] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,255,0.98)_100%)] p-6 shadow-[0_22px_50px_rgba(90,122,188,0.1)]">
            <div className="flex items-center gap-4 text-[#1f6feb]">
              <SeatPanelIcon />
              <h2 className="text-[1.7rem] font-semibold text-[#112853]">席位状态</h2>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {seats.map((seat) => (
                <WaitingSeatCard
                  key={seat.id}
                  isSelf={seat.id === selfSeatId}
                  seat={seat}
                />
              ))}
            </div>
          </section>

          <section className="grid min-h-0 gap-5 rounded-[2rem] border border-[#d9e5fb] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,255,0.98)_100%)] p-6 shadow-[0_22px_50px_rgba(90,122,188,0.1)]">
            <div className="flex items-center gap-4 text-[#1f6feb]">
              <PulseIcon />
              <h2 className="text-[1.7rem] font-semibold text-[#112853]">本局节奏</h2>
            </div>

            <ul className="grid gap-3">
              {WAITING_RULES.map((rule) => (
                <WaitingRuleCard
                  key={rule.text}
                  icon={rule.icon}
                  text={rule.text}
                />
              ))}
            </ul>
          </section>
        </div>
      </div>
    </section>
  );
}
