import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildLeaderboard,
  getCurrentQuestion,
  sanitizeGame,
} from "@/lib/game-utils";
import type { Game, Question } from "@/lib/types";

export async function getGameById(gameId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single<Game>();

  if (error || !data) return null;
  return data;
}

export async function getGameByCode(code: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("code", code.toUpperCase())
    .single<Game>();

  if (error || !data) return null;
  return data;
}

export async function getQuestionsForGame(gameId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("game_id", gameId)
    .order("order_index", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Question[];
}

export async function verifyAdminSecret(gameId: string, adminSecret?: string) {
  if (!adminSecret) return null;
  const game = await getGameById(gameId);
  if (!game || game.admin_secret !== adminSecret) return null;
  return game;
}

export async function buildPublicGameState(game: Game) {
  const supabase = createAdminClient();
  const questions = await getQuestionsForGame(game.id);

  const { data: participants } = await supabase
    .from("participants")
    .select("*")
    .eq("game_id", game.id)
    .order("score", { ascending: false });

  const currentQuestion = getCurrentQuestion(
    questions,
    game.current_question_index
  );

  let answersForCurrentQuestion = [];

  if (currentQuestion) {
    const { data: answers } = await supabase
      .from("answers")
      .select("*")
      .eq("question_id", currentQuestion.id);
    answersForCurrentQuestion = answers ?? [];
  }

  return {
    game: sanitizeGame(game),
    questions,
    participants: participants ?? [],
    currentQuestion,
    leaderboard: buildLeaderboard(participants ?? []),
    answersForCurrentQuestion,
  };
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
