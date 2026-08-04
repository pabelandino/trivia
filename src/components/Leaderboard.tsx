import type { LeaderboardEntry } from "@/lib/types";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  highlightId?: string;
  compact?: boolean;
}

export function Leaderboard({
  entries,
  highlightId,
  compact = false,
}: LeaderboardProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-3xl bg-white/10 p-6 text-center text-white/70">
        Todavía no hay puntajes
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const isHighlighted = entry.id === highlightId;
        const medal =
          entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : null;

        return (
          <div
            key={entry.id}
            className={`flex items-center justify-between rounded-2xl px-4 py-3 ${
              isHighlighted
                ? "bg-yellow-300 text-indigo-950 shadow-lg"
                : "bg-white/10 text-white"
            } ${compact ? "py-2" : ""}`}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/10 text-sm font-bold">
                {medal ?? entry.rank}
              </span>
              <span className={`font-bold ${compact ? "text-sm" : "text-base"}`}>
                {entry.display_name}
              </span>
            </div>
            <span className="text-lg font-extrabold">{entry.score}</span>
          </div>
        );
      })}
    </div>
  );
}
