import {
  buildPublicGameState,
  getGameById,
  jsonError,
  jsonOk,
  verifyAdminSecret,
} from "@/lib/api-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CreateQuestionInput } from "@/lib/types";

interface RouteContext {
  params: Promise<{ gameId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { gameId } = await context.params;
  const game = await getGameById(gameId);

  if (!game) {
    return jsonError("Game not found", 404);
  }

  try {
    const state = await buildPublicGameState(game);
    return jsonOk(state);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unexpected error",
      500
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { gameId } = await context.params;

  try {
    const body = await request.json();
    const adminSecret = body.admin_secret as string | undefined;
    const game = await verifyAdminSecret(gameId, adminSecret);

    if (!game) {
      return jsonError("Unauthorized", 401);
    }

    if (game.phase !== "setup") {
      return jsonError("Questions can only be added during setup");
    }

    const input = body.question as CreateQuestionInput | undefined;
    if (!input?.question_text?.trim()) {
      return jsonError("Question text is required");
    }

    const options = (input.options ?? [])
      .map((option) => option.trim())
      .filter(Boolean);

    if (options.length < 2) {
      return jsonError("At least two options are required");
    }

    if (
      typeof input.correct_index !== "number" ||
      input.correct_index < 0 ||
      input.correct_index >= options.length
    ) {
      return jsonError("Invalid correct answer index");
    }

    const supabase = createAdminClient();
    const { count } = await supabase
      .from("questions")
      .select("*", { count: "exact", head: true })
      .eq("game_id", gameId);

    const { data, error } = await supabase
      .from("questions")
      .insert({
        game_id: gameId,
        order_index: count ?? 0,
        question_text: input.question_text.trim(),
        options,
        correct_index: input.correct_index,
        timer_seconds: input.timer_seconds ?? null,
      })
      .select("*")
      .single();

    if (error || !data) {
      return jsonError(error?.message ?? "Could not add question", 500);
    }

    return jsonOk({ question: data });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unexpected error",
      500
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { gameId } = await context.params;

  try {
    const body = await request.json();
    const adminSecret = body.admin_secret as string | undefined;
    const game = await verifyAdminSecret(gameId, adminSecret);

    if (!game) {
      return jsonError("Unauthorized", 401);
    }

    const updates: Record<string, unknown> = {};

    if (typeof body.title === "string" && body.title.trim()) {
      updates.title = body.title.trim();
    }

    if (typeof body.default_timer_seconds === "number") {
      updates.default_timer_seconds = body.default_timer_seconds;
    }

    if (Object.keys(updates).length === 0) {
      return jsonError("No valid fields to update");
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("games")
      .update(updates)
      .eq("id", gameId)
      .select("*")
      .single();

    if (error || !data) {
      return jsonError(error?.message ?? "Could not update game", 500);
    }

    return jsonOk({ game: data });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unexpected error",
      500
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { gameId } = await context.params;

  try {
    const body = await request.json();
    const adminSecret = body.admin_secret as string | undefined;
    const game = await verifyAdminSecret(gameId, adminSecret);

    if (!game) {
      return jsonError("Unauthorized", 401);
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from("games").delete().eq("id", gameId);

    if (error) {
      return jsonError(error.message, 500);
    }

    return jsonOk({ deleted: true });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unexpected error",
      500
    );
  }
}
