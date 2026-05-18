"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type JoinRoomPayload = {
  code: string;
};

type JoinRoomFormProps = {
  defaultCode?: string;
  errorMessage?: string;
  onJoin?: (payload: JoinRoomPayload) => Promise<void> | void;
};

const INVITE_CODE_PATTERN = /^[A-Z0-9]{6}$/;

function getJoinErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "加入房间失败，请稍后重试。";
  }

  if (error.message === "REQUEST_FAILED_404") {
    return "邀请码不存在，请检查后再试。";
  }

  if (error.message === "REQUEST_FAILED_409") {
    return "这个房间现在不能加入，可能已经满员或已经开始。";
  }

  return "加入房间失败，请稍后重试。";
}

export function JoinRoomForm({ defaultCode, errorMessage, onJoin }: JoinRoomFormProps) {
  const [code, setCode] = useState(defaultCode ?? "");
  const [isPending, setIsPending] = useState(false);
  const [submitError, setSubmitError] = useState(errorMessage ?? "");
  const router = useRouter();
  const displayedError =
    submitError || (code === (defaultCode ?? "") ? errorMessage ?? "" : "");

  async function handleJoin(payload: JoinRoomPayload) {
    if (onJoin) {
      await onJoin(payload);
      return;
    }

    const response = await fetch(`/api/rooms/${payload.code}/join`, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`REQUEST_FAILED_${response.status}`);
    }

    const room = (await response.json()) as {
      code: string;
    };

    router.push(`/room/${room.code}`);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedCode = code.replace(/\s+/g, "").toUpperCase();

    if (!INVITE_CODE_PATTERN.test(normalizedCode)) {
      setSubmitError("请输入 6 位字母或数字的邀请码。");
      return;
    }

    setIsPending(true);
    setSubmitError("");

    try {
      await handleJoin({ code: normalizedCode });
    } catch (error) {
      setSubmitError(getJoinErrorMessage(error));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form action="#" className="grid gap-4" onSubmit={handleSubmit}>
      <label className="grid gap-3">
        <span className="text-base font-semibold text-white">邀请码</span>
        <input
          aria-label="邀请码"
          autoComplete="off"
          className="h-14 rounded-2xl border border-white/10 bg-[#0d1524] px-4 text-lg uppercase tracking-[0.12em] text-white outline-none transition placeholder:text-slate-500 focus:border-[#4c86ff] focus:bg-[#101a2d]"
          maxLength={12}
          name="code"
          onChange={(event) => {
            setCode(event.currentTarget.value);
            if (submitError) {
              setSubmitError("");
            }
          }}
          placeholder="请输入 6 位邀请码"
          type="text"
          value={code}
        />
      </label>

      {displayedError ? (
        <p className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200" role="alert">
          {displayedError}
        </p>
      ) : null}

      <button
        className="inline-flex h-14 items-center justify-center rounded-2xl border border-[#2f66f5] bg-transparent px-5 text-xl font-semibold text-[#6fa1ff] transition hover:bg-[#142748] disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "加入中..." : "加入房间"}
      </button>
    </form>
  );
}
