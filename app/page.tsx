import { CreateRoomForm } from "@/components/create-room-form";
import { JoinRoomForm } from "@/components/join-room-form";

export default function HomePage() {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[1.3fr_0.9fr] lg:px-8 lg:py-16">
      <section className="grid content-center gap-6">
        <p className="text-sm font-medium uppercase tracking-[0.12em] text-slate-500">
          AI 卧底聊天室
        </p>
        <div className="grid gap-4">
          <h1 className="max-w-2xl text-4xl font-semibold text-slate-950 lg:text-5xl">
            建一局真人和 AI 混聊的推理房。
          </h1>
          <p className="max-w-xl text-lg leading-8 text-slate-600">
            朋友通过邀请码进房，系统暗中混入 1 到 2 个 AI。聊、投、淘汰、结算，一局完整跑通。
          </p>
        </div>
        <dl className="grid gap-4 text-sm text-slate-600 sm:grid-cols-3">
          <div className="grid gap-1">
            <dt className="font-medium text-slate-900">默认 7 人</dt>
            <dd>开局配置已经备好，适合直接拉朋友进房。</dd>
          </div>
          <div className="grid gap-1">
            <dt className="font-medium text-slate-900">实时轮次</dt>
            <dd>讨论、投票、淘汰和结算都会按阶段推进。</dd>
          </div>
          <div className="grid gap-1">
            <dt className="font-medium text-slate-900">AI 混入</dt>
            <dd>每局可混入 1 到 2 个 AI，身份在结算前保密。</dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-6 self-center rounded-lg border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="grid gap-2">
          <h2 className="text-xl font-semibold text-slate-950">开始新房间</h2>
          <p className="text-sm leading-6 text-slate-600">
            用默认配置直接开局，或者先调整本局人数和 AI 数量。
          </p>
        </div>
        <CreateRoomForm />
        <div className="h-px bg-slate-200" />
        <div className="grid gap-2">
          <h2 className="text-xl font-semibold text-slate-950">加入已有房间</h2>
          <p className="text-sm leading-6 text-slate-600">
            输入 6 位邀请码，系统会自动整理空格和大小写。
          </p>
        </div>
        <JoinRoomForm />
      </section>
    </main>
  );
}
