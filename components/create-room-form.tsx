"use client";

import type { FormEvent } from "react";
import { useState } from "react";

export type CreateRoomPayload = {
  totalSeats: number;
  aiCount: number;
  roundOneSeconds: number;
  roundSeconds: number;
};

type CreateRoomFormProps = {
  onCreate?: (payload: CreateRoomPayload) => Promise<void> | void;
};

const defaultCreateHandler = async () => {};

function readConfiguredNumber(
  formData: FormData,
  fieldName: string,
  fallback: number,
  range: { min: number; max: number },
) {
  const rawValue = String(formData.get(fieldName) ?? "").trim();

  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < range.min || value > range.max) {
    return null;
  }

  return value;
}

export function CreateRoomForm({
  onCreate = defaultCreateHandler,
}: CreateRoomFormProps) {
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const totalSeats = readConfiguredNumber(formData, "totalSeats", 7, {
      min: 5,
      max: 9,
    });
    const aiCount = readConfiguredNumber(formData, "aiCount", 1, {
      min: 1,
      max: 2,
    });

    if (totalSeats === null || aiCount === null) {
      return;
    }

    setIsPending(true);

    try {
      await onCreate({
        totalSeats,
        aiCount,
        roundOneSeconds: Number(formData.get("roundOneSeconds") ?? 300),
        roundSeconds: Number(formData.get("roundSeconds") ?? 180),
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-700">总人数</span>
        <input
          className="h-11 rounded-lg border border-slate-300 bg-slate-50 px-3 text-slate-950 outline-none transition focus:border-slate-500 focus:bg-white"
          defaultValue={7}
          max={9}
          min={5}
          name="totalSeats"
          type="number"
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-700">AI 数量</span>
        <input
          className="h-11 rounded-lg border border-slate-300 bg-slate-50 px-3 text-slate-950 outline-none transition focus:border-slate-500 focus:bg-white"
          defaultValue={1}
          max={2}
          min={1}
          name="aiCount"
          type="number"
        />
      </label>

      <input name="roundOneSeconds" type="hidden" value={300} />
      <input name="roundSeconds" type="hidden" value={180} />

      <button
        className="inline-flex h-11 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "创建中..." : "创建房间"}
      </button>
    </form>
  );
}
