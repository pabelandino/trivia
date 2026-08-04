import { customAlphabet } from "nanoid";
import type {
  Answer,
  Game,
  LeaderboardEntry,
  Participant,
  Question,
} from "@/lib/types";

const generateCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const generateSecret = customAlphabet(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  32
);

export function createGameCode() {
  return generateCode();
}

export function createAdminSecret() {
  return generateSecret();
}

export function createSessionToken() {
  return generateSecret();
}

export function buildLeaderboard(participants: Participant[]): LeaderboardEntry[] {
  return [...participants]
    .sort((a, b) => b.score - a.score || a.display_name.localeCompare(b.display_name))
    .map((participant, index) => ({
      id: participant.id,
      display_name: participant.display_name,
      score: participant.score,
      rank: index + 1,
    }));
}

export function sanitizeGame(game: Game): Omit<Game, "admin_secret"> {
  const { admin_secret, ...publicGame } = game;
  void admin_secret;
  return publicGame;
}

export function getCurrentQuestion(
  questions: Question[],
  index: number
): Question | null {
  if (index < 0) return null;
  return questions.find((question) => question.order_index === index) ?? null;
}

export function getQuestionTimerSeconds(
  question: Question | null,
  game: Game
): number {
  return question?.timer_seconds ?? game.default_timer_seconds;
}

export function getRemainingSeconds(
  startedAt: string | null,
  durationSeconds: number
): number {
  if (!startedAt) return durationSeconds;
  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  return Math.max(0, durationSeconds - elapsed);
}

export function isParticipantOnline(participant: Participant): boolean {
  const lastSeen = new Date(participant.last_seen_at).getTime();
  return Date.now() - lastSeen < 20_000;
}

export function countCorrectAnswers(answers: Answer[]): number {
  return answers.filter((answer) => answer.is_correct).length;
}
