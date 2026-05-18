import type { SeatColor } from "@/lib/game/types";

const SEAT_ACCENTS: Record<
  SeatColor,
  {
    ring: string;
    badge: string;
    glow: string;
    text: string;
  }
> = {
  red: {
    ring: "border-red-500/80",
    badge: "bg-red-500/20 text-red-200",
    glow: "shadow-[0_0_24px_rgba(239,68,68,0.35)]",
    text: "text-red-300",
  },
  blue: {
    ring: "border-blue-500/80",
    badge: "bg-blue-500/20 text-blue-200",
    glow: "shadow-[0_0_24px_rgba(59,130,246,0.32)]",
    text: "text-blue-300",
  },
  green: {
    ring: "border-green-500/80",
    badge: "bg-green-500/20 text-green-200",
    glow: "shadow-[0_0_24px_rgba(34,197,94,0.32)]",
    text: "text-green-300",
  },
  yellow: {
    ring: "border-yellow-400/80",
    badge: "bg-yellow-400/20 text-yellow-100",
    glow: "shadow-[0_0_24px_rgba(250,204,21,0.28)]",
    text: "text-yellow-200",
  },
  purple: {
    ring: "border-purple-500/80",
    badge: "bg-purple-500/20 text-purple-200",
    glow: "shadow-[0_0_24px_rgba(168,85,247,0.32)]",
    text: "text-purple-300",
  },
  cyan: {
    ring: "border-cyan-400/80",
    badge: "bg-cyan-400/20 text-cyan-100",
    glow: "shadow-[0_0_24px_rgba(34,211,238,0.28)]",
    text: "text-cyan-200",
  },
  orange: {
    ring: "border-orange-400/80",
    badge: "bg-orange-400/20 text-orange-100",
    glow: "shadow-[0_0_24px_rgba(251,146,60,0.3)]",
    text: "text-orange-200",
  },
  pink: {
    ring: "border-pink-400/80",
    badge: "bg-pink-400/20 text-pink-100",
    glow: "shadow-[0_0_24px_rgba(244,114,182,0.3)]",
    text: "text-pink-200",
  },
};

export function getSeatAccent(color?: SeatColor) {
  if (!color) {
    return {
      ring: "border-white/15",
      badge: "bg-white/10 text-white/80",
      glow: "",
      text: "text-white/80",
    };
  }

  return SEAT_ACCENTS[color];
}
