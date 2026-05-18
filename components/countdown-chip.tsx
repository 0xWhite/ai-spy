"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/utils/format";

type CountdownChipProps = {
  phaseEndsAt: number | null;
  className?: string;
  variant?: "light" | "dark";
};

export function CountdownChip({
  phaseEndsAt,
  className = "",
  variant = "light",
}: CountdownChipProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (phaseEndsAt === null) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [phaseEndsAt]);

  return (
    <div
      className={`inline-flex min-w-20 items-center justify-center px-3 py-1 text-sm font-semibold ${
        variant === "dark"
          ? "bg-transparent text-white"
          : "rounded-full border border-slate-200 bg-white text-slate-950"
      } ${className}`}
    >
      {formatCountdown(phaseEndsAt, now)}
    </div>
  );
}
