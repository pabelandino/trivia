import {
  buildPublicGameState,
  jsonError,
  jsonOk,
} from "@/lib/api-helpers";
import { createAdminSecret, createGameCode } from "@/lib/game-utils";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "Trivia Night";
    const defaultTimerSeconds =
      typeof body.default_timer_seconds === "number"
        ? body.default_timer_seconds
        : 30;

    const supabase = createAdminClient();
    const code = createGameCode();
    const adminSecret = createAdminSecret();

    const { data, error } = await supabase
      .from("games")
      .insert({
        code,
        admin_secret: adminSecret,
        title: title || "Trivia Night",
        default_timer_seconds: defaultTimerSeconds,
        phase: "setup",
      })
      .select("*")
      .single();

    if (error || !data) {
      return jsonError(error?.message ?? "Could not create game", 500);
    }

    return jsonOk({
      game: data,
      adminSecret,
      shareUrl: `/play/${data.code}`,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unexpected error",
      500
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return jsonError("Missing game code");
  }

  try {
    const supabase = createAdminClient();
    const { data: game, error } = await supabase
      .from("games")
      .select("*")
      .eq("code", code.toUpperCase())
      .single();

    if (error || !game) {
      return jsonError("Game not found", 404);
    }

    const state = await buildPublicGameState(game);
    return jsonOk(state);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unexpected error",
      500
    );
  }
}
