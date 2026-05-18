"use client";

import type { FormEvent } from "react";
import { useState } from "react";

type MessageComposerProps = {
  disabled?: boolean;
  onSend?: (text: string) => Promise<void> | void;
};

export function MessageComposer({
  disabled = false,
  onSend,
}: MessageComposerProps) {
  const [text, setText] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextText = text.trim();

    if (!nextText || !onSend) {
      return;
    }

    setIsPending(true);

    try {
      await onSend(nextText);
      setText("");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="grid gap-3" onSubmit={handleSubmit}>
      <label className="grid gap-2">
        <span className="sr-only">发送消息</span>
        <textarea
          aria-label="发送消息"
          className="min-h-24 rounded-2xl border border-white/10 bg-[#141c2a] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/60 focus:bg-[#171f30] disabled:cursor-not-allowed disabled:bg-[#111826] disabled:text-slate-500"
          disabled={disabled || isPending}
          onChange={(event) => setText(event.target.value)}
          placeholder="请输入消息..."
          value={text}
        />
      </label>
      <div className="flex justify-end">
        <button
          className="inline-flex h-12 min-w-28 items-center justify-center rounded-2xl border border-blue-400/40 bg-gradient-to-br from-blue-500 to-blue-600 px-5 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(37,99,235,0.28)] transition hover:from-blue-400 hover:to-blue-500 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none"
          disabled={disabled || isPending || text.trim().length === 0}
          type="submit"
        >
          {isPending ? "发送中..." : "发送"}
        </button>
      </div>
    </form>
  );
}
