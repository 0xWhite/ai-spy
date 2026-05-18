"use client";

import { useState } from "react";
import type { ClientSeatState } from "@/lib/room-snapshot";
import { formatSeatLabel } from "@/lib/utils/format";
import { getSeatAccent } from "@/lib/utils/seat-style";

type VotingPanelProps = {
  seats: ClientSeatState[];
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
  const hasLockedVote = Boolean(selectedSeatId);

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
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-blue-400/20 pb-4">
        <div className="grid gap-1">
          <h3 className="text-xl font-semibold text-white">投票对象</h3>
          <p className="text-sm text-slate-400">请选择你认为最可疑的在场席位。</p>
        </div>
        <div className="rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-sm font-medium text-blue-200">
          只能投给当前仍存活的其他席位
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {selectableSeats.map((seat) => {
          const isSelected = selectedSeatId === seat.id;
          const isPending = pendingSeatId === seat.id;
          const displayedSeat =
            "color" in seat && "number" in seat ? seat : null;
          const seatLabel = displayedSeat ? formatSeatLabel(displayedSeat) : seat.id;
          const accent = getSeatAccent(displayedSeat?.color);
          const seatNumber = displayedSeat?.number ?? "?";

          return (
            <div
              key={seat.id}
              className={`grid gap-4 rounded-[24px] border px-4 py-4 text-left transition ${
                isSelected
                  ? `${accent.ring} bg-[#1a2332] text-white shadow-[0_18px_40px_rgba(15,23,42,0.24)]`
                  : "border-white/10 bg-[#171f2c] text-white hover:border-white/20 hover:bg-[#1b2535]"
              }`}
            >
              <div className="grid justify-items-center gap-3">
                <div className="text-xl font-semibold text-white">{seatNumber}号</div>
                <span
                  aria-hidden="true"
                  className={`inline-flex h-16 w-16 items-center justify-center rounded-full border bg-slate-900 text-sm font-semibold text-white ${accent.ring} ${accent.glow}`}
                >
                  {seatNumber}
                </span>
                <div className={`text-sm font-medium ${accent.text}`}>{seatLabel}</div>
              </div>
              <button
                className={`inline-flex h-11 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition ${
                  isSelected
                    ? "border-amber-300/50 bg-gradient-to-r from-amber-300 to-orange-400 text-slate-950"
                    : "border-orange-300/40 bg-gradient-to-r from-[#ffcc73] to-[#ff7b5f] text-slate-950 hover:brightness-105"
                } disabled:cursor-not-allowed disabled:opacity-60`}
                disabled={disabled || isPending || hasLockedVote}
                onClick={() => void handleVote(seat.id)}
                type="button"
              >
                {isPending ? "提交中..." : isSelected ? "已投" : "投票"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
