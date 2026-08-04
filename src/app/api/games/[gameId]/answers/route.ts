import { getGameById, getQuestionsForGame, jsonError, jsonOk } from "@/lib/api-helpers";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{ gameId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { gameId } = await context.params;

  try {
    const body = await request.json();
    const sessionToken = body.session_token as string | undefined;
    const participantId = body.participant_id as string | undefined;
    const selectedIndex = body.selected_index as number | undefined;

    if (!sessionToken || !participantId || typeof selectedIndex !== "number") {
      return jsonError("Missing answer data");
    }

    const game = await getGameById(gameId);

    if (!game) {
      return jsonError("Game not found", 404);
    }

    if (game.phase !== "question") {
      return jsonError("Answers can only be submitted during a question");
    }

    const questions = await getQuestionsForGame(gameId);
    const currentQuestion = questions.find(
      (question) => question.order_index === game.current_question_index
    );

    if (!currentQuestion) {
      return jsonError("Current question not found", 404);
    }

    if (selectedIndex < 0 || selectedIndex >= currentQuestion.options.length) {
      return jsonError("Invalid answer selection");
    }

    const supabase = createAdminClient();

    const { data: participant, error: participantError } = await supabase
      .from("participants")
      .select("id")
      .eq("id", participantId)
      .eq("game_id", gameId)
      .eq("session_token", sessionToken)
      .single();

    if (participantError || !participant) {
      return jsonError("Participant not found", 404);
    }

    const { data, error } = await supabase
      .from("answers")
      .insert({
        question_id: currentQuestion.id,
        participant_id: participantId,
        selected_index: selectedIndex,
        is_correct: false,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        const { data: existing } = await supabase
          .from("answers")
          .select("*")
          .eq("question_id", currentQuestion.id)
          .eq("participant_id", participantId)
          .single();

        if (existing) {
          return jsonOk({ answer: existing });
        }

        return jsonError("You already answered this question");
      }
      return jsonError(error.message, 500);
    }

    return jsonOk({ answer: data });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unexpected error",
      500
    );
  }
}
