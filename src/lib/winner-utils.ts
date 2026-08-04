import type { LeaderboardEntry } from "@/lib/types";

export function getWinners(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  if (entries.length === 0) return [];
  const topScore = entries[0].score;
  if (topScore === 0) return [];
  return entries.filter((entry) => entry.score === topScore);
}

export function formatWinnerNames(winners: LeaderboardEntry[]): string {
  if (winners.length === 0) return "";
  if (winners.length === 1) return winners[0].display_name;
  if (winners.length === 2) {
    return `${winners[0].display_name} y ${winners[1].display_name}`;
  }

  const rest = winners.slice(0, -1).map((winner) => winner.display_name).join(", ");
  return `${rest} y ${winners.at(-1)?.display_name}`;
}
