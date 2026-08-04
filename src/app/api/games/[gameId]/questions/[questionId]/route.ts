import { jsonError, jsonOk, verifyAdminSecret } from "@/lib/api-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CreateQuestionInput } from "@/lib/types";

interface RouteContext {
  params: Promise<{ gameId: string; questionId: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { gameId, questionId } = await context.params;

  try {
    const body = await request.json();
    const adminSecret = body.admin_secret as string | undefined;
    const game = await verifyAdminSecret(gameId, adminSecret);

    if (!game) {
      return jsonError("Unauthorized", 401);
    }

    if (game.phase !== "setup") {
      return jsonError("Questions can only be edited during setup");
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
    const { data, error } = await supabase
      .from("questions")
      .update({
        question_text: input.question_text.trim(),
        options,
        correct_index: input.correct_index,
        timer_seconds: input.timer_seconds ?? null,
      })
      .eq("id", questionId)
      .eq("game_id", gameId)
      .select("*")
      .single();

    if (error || !data) {
      return jsonError(error?.message ?? "Could not update question", 500);
    }

    return jsonOk({ question: data });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unexpected error",
      500
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { gameId, questionId } = await context.params;

  try {
    const body = await request.json();
    const adminSecret = body.admin_secret as string | undefined;
    const game = await verifyAdminSecret(gameId, adminSecret);

    if (!game) {
      return jsonError("Unauthorized", 401);
    }

    if (game.phase !== "setup") {
      return jsonError("Questions can only be deleted during setup");
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("questions")
      .delete()
      .eq("id", questionId)
      .eq("game_id", gameId);

    if (error) {
      return jsonError(error.message, 500);
    }

    const { data: remaining } = await supabase
      .from("questions")
      .select("id, order_index")
      .eq("game_id", gameId)
      .order("order_index", { ascending: true });

    for (const [index, question] of (remaining ?? []).entries()) {
      await supabase
        .from("questions")
        .update({ order_index: index })
        .eq("id", question.id);
    }

    return jsonOk({ deleted: true });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unexpected error",
      500
    );
  }
}
