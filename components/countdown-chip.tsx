"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/utils/format";

type CountdownChipProps = {
  phaseEndsAt: number | null;
};

export function CountdownChip({ phaseEndsAt }: CountdownChipProps) {
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
    <div className="inline-flex min-w-20 items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-950">
      {formatCountdown(phaseEndsAt, now)}
    </div>
  );
}
