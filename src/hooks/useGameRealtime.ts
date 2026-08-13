"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchGameStateByCode,
  fetchGameStateById,
} from "@/lib/game-service";
import type { PublicGameState } from "@/lib/types";

type FetchSnapshot = {
  sourceKey: string;
  state: PublicGameState | null;
  error: string | null;
  ready: boolean;
};

const emptySnapshot: FetchSnapshot = {
  sourceKey: "",
  state: null,
  error: null,
  ready: false,
};

async function loadGameByCode(code: string) {
  if (!code) {
    return { state: null as PublicGameState | null, error: null as string | null };
  }

  try {
    const data = await fetchGameStateByCode(code);
    return { state: data, error: null };
  } catch (fetchError) {
    return {
      state: null,
      error:
        fetchError instanceof Error ? fetchError.message : "Could not load game",
    };
  }
}

async function loadGameById(gameId: string) {
  try {
    const data = await fetchGameStateById(gameId);
    return { state: data, error: null };
  } catch (fetchError) {
    return {
      state: null,
      error:
        fetchError instanceof Error ? fetchError.message : "Could not load game",
    };
  }
}

function isCurrentSnapshot(snapshot: FetchSnapshot, sourceKey: string) {
  return snapshot.sourceKey === sourceKey && snapshot.ready;
}

function useDebouncedCallback(callback: () => void, delayMs: number) {
  const timeoutRef = useRef<number | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      callbackRef.current();
    }, delayMs);
  }, [delayMs]);
}

export function useGameByCode(code: string) {
  const [snapshot, setSnapshot] = useState<FetchSnapshot>(emptySnapshot);
  const fetchGenerationRef = useRef(0);

  const loading = Boolean(code) && !isCurrentSnapshot(snapshot, code);

  const refresh = useCallback(async () => {
    const generation = ++fetchGenerationRef.current;
    const result = await loadGameByCode(code);

    if (generation !== fetchGenerationRef.current) return;

    setSnapshot({
      sourceKey: code,
      state: result.state,
      error: result.error,
      ready: true,
    });
  }, [code]);

  const debouncedRefresh = useDebouncedCallback(() => {
    void refresh();
  }, 250);

  useEffect(() => {
    let cancelled = false;
    const generation = ++fetchGenerationRef.current;

    void loadGameByCode(code).then((result) => {
      if (cancelled || generation !== fetchGenerationRef.current) return;
      setSnapshot({
        sourceKey: code,
        state: result.state,
        error: result.error,
        ready: true,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [code]);

  const state = isCurrentSnapshot(snapshot, code) ? snapshot.state : null;
  const error = isCurrentSnapshot(snapshot, code) ? snapshot.error : null;

  useEffect(() => {
    if (!state?.game.id) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`game-${state.game.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${state.game.id}` },
        () => debouncedRefresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants", filter: `game_id=eq.${state.game.id}` },
        () => debouncedRefresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "answers" },
        () => debouncedRefresh()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [debouncedRefresh, state?.game.id]);

  return { state, loading, error, refresh };
}

export function useGameById(gameId: string, enabled = true) {
  const [snapshot, setSnapshot] = useState<FetchSnapshot>(emptySnapshot);
  const fetchGenerationRef = useRef(0);
  const sourceKey = enabled && gameId ? gameId : "";

  const loading = Boolean(sourceKey) && !isCurrentSnapshot(snapshot, sourceKey);

  const refresh = useCallback(async () => {
    if (!enabled || !gameId) return;

    const generation = ++fetchGenerationRef.current;
    const result = await loadGameById(gameId);

    if (generation !== fetchGenerationRef.current) return;

    setSnapshot({
      sourceKey: gameId,
      state: result.state,
      error: result.error,
      ready: true,
    });
  }, [enabled, gameId]);

  const debouncedRefresh = useDebouncedCallback(() => {
    void refresh();
  }, 250);

  useEffect(() => {
    if (!enabled || !gameId) return;

    let cancelled = false;
    const generation = ++fetchGenerationRef.current;

    void loadGameById(gameId).then((result) => {
      if (cancelled || generation !== fetchGenerationRef.current) return;
      setSnapshot({
        sourceKey: gameId,
        state: result.state,
        error: result.error,
        ready: true,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, gameId]);

  const state = isCurrentSnapshot(snapshot, sourceKey) ? snapshot.state : null;
  const error = isCurrentSnapshot(snapshot, sourceKey) ? snapshot.error : null;

  useEffect(() => {
    if (!enabled || !gameId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`admin-game-${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        () => debouncedRefresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants", filter: `game_id=eq.${gameId}` },
        () => debouncedRefresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "answers" },
        () => debouncedRefresh()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [debouncedRefresh, enabled, gameId]);

  return { state, loading, error, refresh };
}
