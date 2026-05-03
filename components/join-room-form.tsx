"use client";

import type { FormEvent } from "react";
import { useState } from "react";

export type JoinRoomPayload = {
  code: string;
};

type JoinRoomFormProps = {
  onJoin?: (payload: JoinRoomPayload) => Promise<void> | void;
};

const defaultJoinHandler = async () => {};

export function JoinRoomForm({ onJoin = defaultJoinHandler }: JoinRoomFormProps) {
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const rawCode = String(formData.get("code") ?? "");
    const code = rawCode.replace(/\s+/g, "").toUpperCase();

    if (!code) {
      return;
    }

    setIsPending(true);

    try {
      await onJoin({ code });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-700">邀请码</span>
        <input
          autoComplete="off"
          className="h-11 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm uppercase text-slate-950 outline-none transition focus:border-slate-500 focus:bg-white"
          name="code"
          type="text"
        />
      </label>

      <button
        className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-slate-100 px-4 text-sm font-medium text-slate-950 transition hover:border-slate-400 hover:bg-slate-200 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "加入中..." : "加入房间"}
      </button>
    </form>
  );
}
