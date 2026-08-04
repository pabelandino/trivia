import type { ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
  variant?: "blue" | "light";
}

export function AppShell({ children, variant = "blue" }: AppShellProps) {
  const background =
    variant === "blue"
      ? "bg-gradient-to-b from-[#1B44E8] via-[#4B39D8] to-[#7B2CBF] min-h-dvh text-white"
      : "bg-gradient-to-b from-slate-50 to-white min-h-dvh text-slate-900";

  return (
    <div className={`${background} px-4 py-6 sm:px-6`}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">{children}</div>
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[2rem] bg-white/10 p-6 shadow-xl backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`w-full rounded-full bg-gradient-to-r from-pink-500 to-orange-400 px-6 py-4 text-lg font-extrabold text-white shadow-lg transition hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`w-full rounded-full border-2 border-white/30 bg-white/10 px-6 py-4 text-lg font-bold text-white transition hover:bg-white/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function LogoTitle({ subtitle }: { subtitle?: string }) {
  return (
    <div className="text-center">
      <div className="inline-block rounded-[2rem] bg-white/10 px-6 py-3 shadow-lg">
        <h1 className="text-3xl font-black tracking-tight text-white drop-shadow">
          TRIVIA GAME
        </h1>
      </div>
      {subtitle ? (
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
