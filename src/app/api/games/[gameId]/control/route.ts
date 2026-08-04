import {
  getGameById,
  getQuestionsForGame,
  jsonError,
  jsonOk,
  verifyAdminSecret,
} from "@/lib/api-helpers";
import {
  autoAdvanceGame,
  revealCurrentQuestion,
  restartGame,
  startNextQuestion,
} from "@/lib/game-control";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{ gameId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { gameId } = await context.params;

  try {
    const body = await request.json();
    const adminSecret = body.admin_secret as string | undefined;
    const action = body.action as string | undefined;
    const game = await verifyAdminSecret(gameId, adminSecret);

    if (!game) {
      return jsonError("Unauthorized", 401);
    }

    if (action === "restart") {
      const updatedGame = await restartGame(gameId);
      return jsonOk({ game: updatedGame });
    }

    const questions = await getQuestionsForGame(gameId);

    if (questions.length === 0) {
      return jsonError("Add at least one question before starting");
    }

    if (action === "open_lobby") {
      if (game.phase !== "setup") {
        return jsonError("Lobby can only be opened from setup");
      }

      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("games")
        .update({ phase: "lobby", current_question_index: -1 })
        .eq("id", gameId)
        .select("*")
        .single();

      if (error || !data) {
        return jsonError(error?.message ?? "Could not open lobby", 500);
      }

      return jsonOk({ game: data });
    }

    if (action === "start_question") {
      const result = await startNextQuestion(gameId);
      return jsonOk({ game: result.game, finished: result.finished });
    }

    if (action === "reveal") {
      const updatedGame = await revealCurrentQuestion(gameId);
      return jsonOk({ game: updatedGame });
    }

    if (action === "auto_advance") {
      const result = await autoAdvanceGame(gameId);
      return jsonOk(result);
    }

    return jsonError("Unknown action");
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unexpected error",
      500
    );
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const { gameId } = await context.params;
  const game = await getGameById(gameId);

  if (!game) {
    return jsonError("Game not found", 404);
  }

  return jsonOk({ game });
}
