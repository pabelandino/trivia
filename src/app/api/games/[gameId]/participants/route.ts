import { getGameById, jsonError, jsonOk } from "@/lib/api-helpers";
import { createSessionToken } from "@/lib/game-utils";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{ gameId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { gameId } = await context.params;

  try {
    const body = await request.json();
    const displayName =
      typeof body.display_name === "string" ? body.display_name.trim() : "";

    if (!displayName || displayName.length < 2) {
      return jsonError("Display name must be at least 2 characters");
    }

    if (displayName.length > 24) {
      return jsonError("Display name must be 24 characters or less");
    }

    const game = await getGameById(gameId);

    if (!game) {
      return jsonError("Game not found", 404);
    }

    if (!["lobby", "question", "reveal"].includes(game.phase)) {
      return jsonError("This game is not accepting players right now");
    }

    const supabase = createAdminClient();
    const sessionToken = createSessionToken();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("participants")
      .insert({
        game_id: gameId,
        display_name: displayName,
        session_token: sessionToken,
        last_seen_at: now,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return jsonError("That name is already taken in this game");
      }
      return jsonError(error.message, 500);
    }

    return jsonOk({ participant: data, sessionToken });
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
    const sessionToken = body.session_token as string | undefined;
    const participantId = body.participant_id as string | undefined;

    if (!sessionToken || !participantId) {
      return jsonError("Missing participant credentials");
    }

    const supabase = createAdminClient();
    const { data: participant, error } = await supabase
      .from("participants")
      .select("*")
      .eq("id", participantId)
      .eq("game_id", gameId)
      .eq("session_token", sessionToken)
      .single();

    if (error || !participant) {
      return jsonError("Participant not found", 404);
    }

    const { data, error: updateError } = await supabase
      .from("participants")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", participantId)
      .select("*")
      .single();

    if (updateError || !data) {
      return jsonError(updateError?.message ?? "Could not update heartbeat", 500);
    }

    return jsonOk({ participant: data });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Unexpected error",
      500
    );
  }
}
