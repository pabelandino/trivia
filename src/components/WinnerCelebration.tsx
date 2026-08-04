"use client";

import confetti from "canvas-confetti";
import { useEffect, useRef } from "react";
import type { LeaderboardEntry } from "@/lib/types";
import { formatWinnerNames } from "@/lib/winner-utils";

interface WinnerCelebrationProps {
  winners: LeaderboardEntry[];
  active: boolean;
}

const CONFETTI_COLORS = ["#FFD54F", "#FF4081", "#7C4DFF", "#00E5FF", "#FFFFFF"];

function fireConfettiBurst() {
  confetti({
    particleCount: 35,
    spread: 65,
    startVelocity: 35,
    origin: { y: 0.65 },
    colors: CONFETTI_COLORS,
    disableForReducedMotion: true,
  });
}

export function WinnerCelebration({ winners, active }: WinnerCelebrationProps) {
  const hasFiredRef = useRef(false);

  useEffect(() => {
    if (!active || winners.length === 0 || hasFiredRef.current) return;

    hasFiredRef.current = true;

    fireConfettiBurst();
    const secondBurst = window.setTimeout(fireConfettiBurst, 700);

    return () => window.clearTimeout(secondBurst);
  }, [active, winners]);

  if (!active || winners.length === 0) return null;

  const winnerLabel = formatWinnerNames(winners);

  return (
    <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-yellow-300 via-amber-300 to-orange-400 p-8 text-center shadow-2xl">
      <div className="text-6xl">🏆</div>
      <p className="mt-3 text-sm font-bold uppercase tracking-[0.25em] text-indigo-900/70">
        {winners.length > 1 ? "¡Empate! Ganadores" : "¡Ganador!"}
      </p>
      <h2 className="mt-2 text-3xl font-black leading-tight text-indigo-950">
        {winnerLabel}
      </h2>
      <p className="mt-3 text-lg font-extrabold text-indigo-900">
        {winners[0].score} {winners[0].score === 1 ? "punto" : "puntos"}
      </p>
    </div>
  );
}
