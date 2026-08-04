import { createClient } from "@/lib/supabase/client";
import {
  buildLeaderboard,
  getCurrentQuestion,
  sanitizeGame,
} from "@/lib/game-utils";
import { requireSiteAdminCode } from "@/lib/site-admin-storage";
import type {
  CreateQuestionInput,
  Game,
  PublicGameState,
  Question,
} from "@/lib/types";

function getSupabase() {
  return createClient();
}

export async function fetchGameStateByCode(code: string): Promise<PublicGameState> {
  const supabase = getSupabase();
  const { data: game, error } = await supabase
    .from("games")
    .select("*")
    .eq("code", code.toUpperCase())
    .single<Game>();

  if (error || !game) {
    throw new Error("Game not found");
  }

  return buildPublicGameStateFromGame(game);
}

export async function fetchGameStateById(gameId: string): Promise<PublicGameState> {
  const supabase = getSupabase();
  const { data: game, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single<Game>();

  if (error || !game) {
    throw new Error("Game not found");
  }

  return buildPublicGameStateFromGame(game);
}

async function buildPublicGameStateFromGame(game: Game): Promise<PublicGameState> {
  const supabase = getSupabase();

  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("*")
    .eq("game_id", game.id)
    .order("order_index", { ascending: true });

  if (questionsError) {
    throw new Error(questionsError.message);
  }

  const { data: participants } = await supabase
    .from("participants")
    .select("*")
    .eq("game_id", game.id)
    .order("score", { ascending: false });

  const currentQuestion = getCurrentQuestion(
    (questions ?? []) as Question[],
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
    questions: (questions ?? []) as Question[],
    participants: participants ?? [],
    currentQuestion,
    leaderboard: buildLeaderboard(participants ?? []),
    answersForCurrentQuestion,
  };
}

export async function verifySiteAdmin(code: string) {
  const supabase = getSupabase();
  const { error } = await supabase.rpc("verify_site_admin", {
    p_site_code: code.trim(),
  });

  if (error) throw new Error(error.message);
}

export async function changeSiteAdminCode(currentCode: string, newCode: string) {
  const supabase = getSupabase();
  const { error } = await supabase.rpc("change_site_admin_code", {
    p_current_code: currentCode.trim(),
    p_new_code: newCode.trim(),
  });

  if (error) throw new Error(error.message);
}

export async function createGame(title: string, defaultTimerSeconds: number) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("create_game", {
    p_site_code: requireSiteAdminCode(),
    p_title: title,
    p_default_timer: defaultTimerSeconds,
  });

  if (error) throw new Error(error.message);
  return data as {
    game: Game;
    adminSecret: string;
    shareUrl: string;
  };
}

export async function joinParticipant(gameId: string, displayName: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("join_participant", {
    p_game_id: gameId,
    p_display_name: displayName,
  });

  if (error) throw new Error(error.message);
  return data as {
    participant: { id: string; display_name: string };
    sessionToken: string;
  };
}

export async function participantHeartbeat(
  gameId: string,
  participantId: string,
  sessionToken: string
) {
  const supabase = getSupabase();
  await supabase.rpc("participant_heartbeat", {
    p_game_id: gameId,
    p_participant_id: participantId,
    p_session_token: sessionToken,
  });
}

export async function submitAnswer(
  gameId: string,
  participantId: string,
  sessionToken: string,
  selectedIndex: number
) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("submit_answer", {
    p_game_id: gameId,
    p_participant_id: participantId,
    p_session_token: sessionToken,
    p_selected_index: selectedIndex,
  });

  if (error) throw new Error(error.message);
  return data as { answer: { id: string; is_correct: boolean; selected_index: number } };
}

export async function gameControl(
  gameId: string,
  adminSecret: string,
  action: string
) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("game_control", {
    p_site_code: requireSiteAdminCode(),
    p_game_id: gameId,
    p_admin_secret: adminSecret,
    p_action: action,
  });

  if (error) throw new Error(error.message);
  return data as { game: Game; finished?: boolean };
}

export async function addQuestion(
  gameId: string,
  adminSecret: string,
  question: CreateQuestionInput
) {
  const supabase = getSupabase();
  const options = question.options.map((o) => o.trim()).filter(Boolean);
  const { data, error } = await supabase.rpc("add_question", {
    p_site_code: requireSiteAdminCode(),
    p_game_id: gameId,
    p_admin_secret: adminSecret,
    p_question_text: question.question_text,
    p_options: options,
    p_correct_index: question.correct_index,
    p_timer_seconds: question.timer_seconds ?? null,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function updateQuestion(
  gameId: string,
  questionId: string,
  adminSecret: string,
  question: CreateQuestionInput
) {
  const supabase = getSupabase();
  const options = question.options.map((o) => o.trim()).filter(Boolean);
  const { data, error } = await supabase.rpc("update_question", {
    p_site_code: requireSiteAdminCode(),
    p_game_id: gameId,
    p_question_id: questionId,
    p_admin_secret: adminSecret,
    p_question_text: question.question_text,
    p_options: options,
    p_correct_index: question.correct_index,
    p_timer_seconds: question.timer_seconds ?? null,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteQuestion(
  gameId: string,
  questionId: string,
  adminSecret: string
) {
  const supabase = getSupabase();
  const { error } = await supabase.rpc("delete_question", {
    p_site_code: requireSiteAdminCode(),
    p_game_id: gameId,
    p_question_id: questionId,
    p_admin_secret: adminSecret,
  });

  if (error) throw new Error(error.message);
}

export async function updateGameSettings(
  gameId: string,
  adminSecret: string,
  title: string,
  defaultTimerSeconds: number
) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("update_game_settings", {
    p_site_code: requireSiteAdminCode(),
    p_game_id: gameId,
    p_admin_secret: adminSecret,
    p_title: title,
    p_default_timer: defaultTimerSeconds,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteGame(gameId: string, adminSecret: string) {
  const supabase = getSupabase();
  const { error } = await supabase.rpc("delete_game", {
    p_site_code: requireSiteAdminCode(),
    p_game_id: gameId,
    p_admin_secret: adminSecret,
  });

  if (error) throw new Error(error.message);
}

export async function fetchDashboardGames(
  items: Array<{ gameId: string; adminSecret: string }>
) {
  const results = [];

  for (const item of items.slice(0, 20)) {
    try {
      const supabase = getSupabase();
      const { data: game } = await supabase
        .from("games")
        .select("admin_secret, id, code, title, phase, default_timer_seconds, created_at")
        .eq("id", item.gameId)
        .single();

      if (!game || game.admin_secret !== item.adminSecret) continue;

      const state = await fetchGameStateById(item.gameId);

      results.push({
        id: state.game.id,
        code: state.game.code,
        title: state.game.title,
        phase: state.game.phase,
        questionCount: state.questions.length,
        participantCount: state.participants.length,
        default_timer_seconds: state.game.default_timer_seconds,
        created_at: state.game.created_at,
      });
    } catch {
      continue;
    }
  }

  return results;
}

export function getSharePath(code: string) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${basePath}/play?code=${code}`;
}

export function getShareUrl(code: string) {
  if (typeof window === "undefined") return getSharePath(code);
  return `${window.location.origin}${getSharePath(code)}`;
}
