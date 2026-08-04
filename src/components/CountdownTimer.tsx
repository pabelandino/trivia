"use client";

import { useEffect, useRef, useState } from "react";

interface CountdownTimerProps {
  startedAt: string | null;
  durationSeconds: number;
  onExpire?: () => void;
  size?: "sm" | "lg";
  label?: string;
}

export function CountdownTimer({
  startedAt,
  durationSeconds,
  onExpire,
  size = "lg",
  label,
}: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const onExpireRef = useRef(onExpire);
  const hasExpiredRef = useRef(false);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    hasExpiredRef.current = false;

    const tick = () => {
      if (!startedAt) {
        setRemaining(durationSeconds);
        return;
      }

      const elapsed = Math.floor(
        (Date.now() - new Date(startedAt).getTime()) / 1000
      );
      const next = Math.max(0, durationSeconds - elapsed);
      setRemaining(next);

      if (next === 0 && !hasExpiredRef.current) {
        hasExpiredRef.current = true;
        onExpireRef.current?.();
      }
    };

    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [startedAt, durationSeconds]);

  const progress =
    durationSeconds > 0 ? (remaining / durationSeconds) * 100 : 0;
  const sizeClasses = size === "lg" ? "h-20 w-20 text-2xl" : "h-14 w-14 text-lg";

  return (
    <div className="flex flex-col items-center gap-1">
      {label ? (
        <span className="text-xs font-semibold uppercase tracking-wide text-white/70">
          {label}
        </span>
      ) : null}
      <div
        className={`relative flex items-center justify-center rounded-full bg-white/10 ${sizeClasses}`}
      >
        <svg className="absolute inset-0 h-full w-full -rotate-90">
          <circle
            cx="50%"
            cy="50%"
            r="45%"
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="4"
          />
          <circle
            cx="50%"
            cy="50%"
            r="45%"
            fill="none"
            stroke="#FFD54F"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${progress * 2.83} 283`}
          />
        </svg>
        <span className="relative font-bold text-white">
          {String(remaining).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}
