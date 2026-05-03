"use client";

import { useState } from "react";
import type { SeatState } from "@/lib/game/types";
import { formatSeatLabel } from "@/lib/utils/format";

type VotingPanelProps = {
  seats: SeatState[];
  selfSeatId: string;
  selectedSeatId?: string;
  tieSeatIds?: string[];
  disabled?: boolean;
  onVote?: (targetSeatId: string) => Promise<void> | void;
};

export function VotingPanel({
  seats,
  selfSeatId,
  selectedSeatId,
  tieSeatIds = [],
  disabled = false,
  onVote,
}: VotingPanelProps) {
  const [pendingSeatId, setPendingSeatId] = useState<string | null>(null);
  const allowedSeatIds =
    tieSeatIds.length > 0 ? new Set(tieSeatIds) : undefined;

  const selectableSeats = seats.filter((seat) => {
    if (seat.status !== "alive" || seat.id === selfSeatId) {
      return false;
    }

    return allowedSeatIds ? allowedSeatIds.has(seat.id) : true;
  });

  async function handleVote(targetSeatId: string) {
    if (!onVote) {
      return;
    }

    setPendingSeatId(targetSeatId);

    try {
      await onVote(targetSeatId);
    } finally {
      setPendingSeatId(null);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <h3 className="text-base font-semibold text-slate-950">投票对象</h3>
        <p className="text-sm text-slate-600">只能投给当前仍存活的其他席位。</p>
      </div>
      <div className="grid gap-2">
        {selectableSeats.map((seat) => {
          const isSelected = selectedSeatId === seat.id;
          const isPending = pendingSeatId === seat.id;

          return (
            <button
              key={seat.id}
              className={`flex items-center justify-between rounded-lg border px-3 py-3 text-sm transition ${
                isSelected
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-900 hover:border-slate-400"
              }`}
              disabled={disabled || isPending}
              onClick={() => void handleVote(seat.id)}
              type="button"
            >
              <span>{formatSeatLabel(seat)}</span>
              <span className={isSelected ? "text-slate-200" : "text-slate-500"}>
                {isPending ? "提交中..." : isSelected ? "已投" : "投票"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
