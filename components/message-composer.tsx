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
        <span className="text-sm font-medium text-slate-700">发送消息</span>
        <textarea
          aria-label="发送消息"
          className="min-h-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-slate-500 disabled:cursor-not-allowed disabled:bg-slate-100"
          disabled={disabled || isPending}
          onChange={(event) => setText(event.target.value)}
          value={text}
        />
      </label>
      <button
        className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-slate-100 px-4 text-sm font-medium text-slate-950 transition hover:border-slate-400 hover:bg-slate-200 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
        disabled={disabled || isPending || text.trim().length === 0}
        type="submit"
      >
        {isPending ? "发送中..." : "发送"}
      </button>
    </form>
  );
}
