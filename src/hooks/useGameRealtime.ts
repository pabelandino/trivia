"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PublicGameState } from "@/lib/types";

export function useGameByCode(code: string) {
  const [state, setState] = useState<PublicGameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/games?code=${encodeURIComponent(code)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load game");
      }

      setState(data);
      setError(null);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error ? fetchError.message : "Could not load game"
      );
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!state?.game.id) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`game-${state.game.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${state.game.id}` },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants", filter: `game_id=eq.${state.game.id}` },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "answers" },
        () => refresh()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [state?.game.id, refresh]);

  return { state, loading, error, refresh };
}

export function useGameById(gameId: string, enabled = true) {
  const [state, setState] = useState<PublicGameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !gameId) return;

    try {
      const response = await fetch(`/api/games/${gameId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load game");
      }

      setState(data);
      setError(null);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error ? fetchError.message : "Could not load game"
      );
    } finally {
      setLoading(false);
    }
  }, [enabled, gameId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled || !gameId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`admin-game-${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants", filter: `game_id=eq.${gameId}` },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "answers" },
        () => refresh()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, gameId, refresh]);

  return { state, loading, error, refresh };
}
