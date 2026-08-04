export type GamePhase = "setup" | "lobby" | "question" | "reveal" | "finished";

export interface Game {
  id: string;
  code: string;
  admin_secret: string;
  title: string;
  phase: GamePhase;
  current_question_index: number;
  question_started_at: string | null;
  reveal_started_at: string | null;
  default_timer_seconds: number;
  created_at: string;
}

export interface Question {
  id: string;
  game_id: string;
  order_index: number;
  question_text: string;
  options: string[];
  correct_index: number;
  timer_seconds: number | null;
}

export interface Participant {
  id: string;
  game_id: string;
  display_name: string;
  session_token: string;
  score: number;
  joined_at: string;
  last_seen_at: string;
}

export interface Answer {
  id: string;
  question_id: string;
  participant_id: string;
  selected_index: number;
  is_correct: boolean;
  answered_at: string;
}

export interface LeaderboardEntry {
  id: string;
  display_name: string;
  score: number;
  rank: number;
}

export interface PublicGameState {
  game: Omit<Game, "admin_secret">;
  questions: Question[];
  participants: Participant[];
  currentQuestion: Question | null;
  leaderboard: LeaderboardEntry[];
  answersForCurrentQuestion: Answer[];
}

export interface CreateQuestionInput {
  question_text: string;
  options: string[];
  correct_index: number;
  timer_seconds?: number;
}

export interface ApiError {
  error: string;
}
