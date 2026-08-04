import {
  buildPublicGameState,
  getGameById,
  jsonError,
  jsonOk,
  verifyAdminSecret,
} from "@/lib/api-helpers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const items = (body.items ?? []) as Array<{
      gameId: string;
      adminSecret: string;
    }>;

    if (!Array.isArray(items) || items.length === 0) {
      return jsonOk({ games: [] });
    }

    const supabase = createAdminClient();
    const games = [];

    for (const item of items.slice(0, 20)) {
      const game = await verifyAdminSecret(item.gameId, item.adminSecret);
      if (!game) continue;

      const { count: questionCount } = await supabase
        .from("questions")
        .select("*", { count: "exact", head: true })
        .eq("game_id", game.id);

      const { count: participantCount } = await supabase
        .from("participants")
        .select("*", { count: "exact", head: true })
        .eq("game_id", game.id);

      games.push({
        id: game.id,
        code: game.code,
        title: game.title,
        phase: game.phase,
        questionCount: questionCount ?? 0,
        participantCount: participantCount ?? 0,
        default_timer_seconds: game.default_timer_seconds,
        created_at: game.created_at,
      });
    }

    return jsonOk({ games });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unexpected error",
      500
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const gameId = body.game_id as string | undefined;
    const adminSecret = body.admin_secret as string | undefined;
    const game = await verifyAdminSecret(gameId ?? "", adminSecret);

    if (!game) {
      return jsonError("Unauthorized", 401);
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from("games").delete().eq("id", game.id);

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
