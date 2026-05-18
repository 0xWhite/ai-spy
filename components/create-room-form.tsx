"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type CreateRoomPayload = {
  totalSeats: number;
  aiCount: number;
  roundOneSeconds: number;
  roundSeconds: number;
};

type CreateRoomFormProps = {
  onCreate?: (payload: CreateRoomPayload) => Promise<void> | void;
};

const TOTAL_SEAT_RANGE = {
  min: 5,
  max: 8,
} as const;

const AI_COUNT_RANGE = {
  min: 1,
  max: 2,
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

type StepperFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (nextValue: number) => void;
};

function StepperField({
  label,
  value,
  min,
  max,
  onChange,
}: StepperFieldProps) {
  const canDecrease = value > min;
  const canIncrease = value < max;

  return (
    <div className="grid gap-3">
      <span className="text-base font-semibold text-white">{label}</span>
      <div className="grid grid-cols-[82px_1fr_82px] overflow-hidden rounded-2xl border border-white/10 bg-[#101827] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex h-14 items-center justify-center border-r border-white/8">
          <button
            aria-label={`${label}减少`}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-3xl font-light leading-none text-[#8fb7ff] transition hover:bg-white/8 disabled:cursor-not-allowed disabled:text-slate-600"
            disabled={!canDecrease}
            onClick={() => onChange(clamp(value - 1, min, max))}
            type="button"
          >
            -
          </button>
        </div>
        <div className="flex h-14 items-center justify-center text-[2rem] font-semibold text-white">
          {value}
        </div>
        <div className="flex h-14 items-center justify-center border-l border-white/8">
          <button
            aria-label={`${label}增加`}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-3xl font-light leading-none text-[#8fb7ff] transition hover:bg-white/8 disabled:cursor-not-allowed disabled:text-slate-600"
            disabled={!canIncrease}
            onClick={() => onChange(clamp(value + 1, min, max))}
            type="button"
          >
            +
          </button>
        </div>
      </div>
      <span className="text-sm text-slate-400">
        {label}范围：{min} - {max} {label === "总人数" ? "人" : "个"}
      </span>
    </div>
  );
}

export function CreateRoomForm({ onCreate }: CreateRoomFormProps) {
  const [isPending, setIsPending] = useState(false);
  const [totalSeats, setTotalSeats] = useState(7);
  const [aiCount, setAiCount] = useState(1);
  const router = useRouter();

  async function handleCreate(payload: CreateRoomPayload) {
    if (onCreate) {
      await onCreate(payload);
      return;
    }

    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
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
    setIsPending(true);

    try {
      await handleCreate({
        totalSeats,
        aiCount,
        roundOneSeconds: 300,
        roundSeconds: 180,
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form action="#" className="grid gap-6" onSubmit={handleSubmit}>
      <StepperField
        label="总人数"
        max={TOTAL_SEAT_RANGE.max}
        min={TOTAL_SEAT_RANGE.min}
        onChange={setTotalSeats}
        value={totalSeats}
      />
      <StepperField
        label="AI 数量"
        max={AI_COUNT_RANGE.max}
        min={AI_COUNT_RANGE.min}
        onChange={setAiCount}
        value={aiCount}
      />

      <input name="totalSeats" type="hidden" value={totalSeats} />
      <input name="aiCount" type="hidden" value={aiCount} />
      <input name="roundOneSeconds" type="hidden" value={300} />
      <input name="roundSeconds" type="hidden" value={180} />

      <button
        className="inline-flex h-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#2f66f5_0%,#4c86ff_100%)] px-5 text-xl font-semibold text-white shadow-[0_12px_30px_rgba(47,102,245,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "创建中..." : "创建房间"}
      </button>
    </form>
  );
}
