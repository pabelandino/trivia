import { createAdminClient } from "@/lib/supabase/admin";
import { getQuestionsForGame } from "@/lib/api-helpers";

export async function revealCurrentQuestion(gameId: string) {
  const supabase = createAdminClient();
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single();

  if (gameError || !game) {
    throw new Error("Game not found");
  }

  if (game.phase !== "question") {
    throw new Error("Can only reveal during an active question");
  }

  const questions = await getQuestionsForGame(gameId);
  const currentQuestion = questions.find(
    (question) => question.order_index === game.current_question_index
  );

  if (!currentQuestion) {
    throw new Error("Current question not found");
  }

  const { data: pendingAnswers } = await supabase
    .from("answers")
    .select("id, participant_id, selected_index")
    .eq("question_id", currentQuestion.id);

  for (const answer of pendingAnswers ?? []) {
    const isCorrect = answer.selected_index === currentQuestion.correct_index;

    await supabase.from("answers").update({ is_correct: isCorrect }).eq("id", answer.id);

    if (isCorrect) {
      const { error: scoreError } = await supabase.rpc("increment_participant_score", {
        p_participant_id: answer.participant_id,
      });

      if (scoreError) {
        const { data: participant } = await supabase
          .from("participants")
          .select("score")
          .eq("id", answer.participant_id)
          .single();

        if (participant) {
          await supabase
            .from("participants")
            .update({ score: participant.score + 1 })
            .eq("id", answer.participant_id);
        }
      }
    }
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("games")
    .update({
      phase: "reveal",
      reveal_started_at: now,
      question_started_at: null,
    })
    .eq("id", gameId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not reveal answers");
  }

  return data;
}

export async function startNextQuestion(gameId: string) {
  const supabase = createAdminClient();
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single();

  if (gameError || !game) {
    throw new Error("Game not found");
  }

  if (!["lobby", "reveal"].includes(game.phase)) {
    throw new Error("Cannot start question from current phase");
  }

  const questions = await getQuestionsForGame(gameId);
  const nextIndex = game.phase === "lobby" ? 0 : game.current_question_index + 1;

  if (nextIndex >= questions.length) {
    const { data, error } = await supabase
      .from("games")
      .update({
        phase: "finished",
        reveal_started_at: null,
        question_started_at: null,
      })
      .eq("id", gameId)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Could not finish game");
    }

    return { game: data, finished: true };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("games")
    .update({
      phase: "question",
      current_question_index: nextIndex,
      question_started_at: now,
      reveal_started_at: null,
    })
    .eq("id", gameId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not start question");
  }

  return { game: data, finished: false };
}

export async function autoAdvanceGame(gameId: string) {
  const supabase = createAdminClient();
  const { data: game } = await supabase
    .from("games")
    .select("phase")
    .eq("id", gameId)
    .single();

  if (!game) {
    throw new Error("Game not found");
  }

  if (game.phase === "question") {
    const updatedGame = await revealCurrentQuestion(gameId);
    return { game: updatedGame, auto: "reveal" as const, finished: false };
  }

  if (game.phase === "reveal") {
    const result = await startNextQuestion(gameId);
    return {
      game: result.game,
      auto: "next_question" as const,
      finished: result.finished,
    };
  }

  throw new Error("Nothing to auto advance");
}

export async function restartGame(gameId: string) {
  const supabase = createAdminClient();
  const questions = await getQuestionsForGame(gameId);
  const questionIds = questions.map((question) => question.id);

  if (questionIds.length > 0) {
    await supabase.from("answers").delete().in("question_id", questionIds);
  }

  await supabase.from("participants").update({ score: 0 }).eq("game_id", gameId);

  const { data, error } = await supabase
    .from("games")
    .update({
      phase: "lobby",
      current_question_index: -1,
      question_started_at: null,
      reveal_started_at: null,
    })
    .eq("id", gameId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not restart game");
  }

  return data;
}
