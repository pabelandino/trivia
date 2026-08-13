"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AppShell,
  Card,
  LogoTitle,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui";
import {
  getAdminSessions,
  getAdminSecretForGame,
  removeAdminSession,
  saveAdminSession,
  type AdminSession,
} from "@/lib/admin-storage";
import type { GamePhase } from "@/lib/types";
import {
  createGame as createGameRpc,
  deleteGame as deleteGameRpc,
  fetchDashboardGames,
  gameControl,
} from "@/lib/game-service";

interface DashboardGame {
  id: string;
  code: string;
  title: string;
  phase: GamePhase;
  questionCount: number;
  participantCount: number;
  default_timer_seconds: number;
  created_at: string;
}

const phaseLabels: Record<GamePhase, string> = {
  setup: "Borrador",
  lobby: "Sala abierta",
  question: "En juego",
  reveal: "Resultados",
  finished: "Terminada",
};

const phaseColors: Record<GamePhase, string> = {
  setup: "bg-slate-400/20 text-slate-100",
  lobby: "bg-emerald-400/20 text-emerald-100",
  question: "bg-sky-400/20 text-sky-100",
  reveal: "bg-yellow-400/20 text-yellow-100",
  finished: "bg-pink-400/20 text-pink-100",
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [games, setGames] = useState<DashboardGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("Trivia Night");
  const [timer, setTimer] = useState(30);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    const stored = getAdminSessions();
    setSessions(stored);
    setLoading(true);
    setError(null);

    if (stored.length === 0) {
      setGames([]);
      setLoading(false);
      return;
    }

    try {
      const nextGames = await fetchDashboardGames(
        stored.map((session) => ({
          gameId: session.gameId,
          adminSecret: session.adminSecret,
        }))
      );

      setGames(nextGames);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar el dashboard"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const stored = getAdminSessions();

    void (async () => {
      if (cancelled) return;
      setSessions(stored);

      if (stored.length === 0) {
        setGames([]);
        setLoading(false);
        return;
      }

      try {
        const nextGames = await fetchDashboardGames(
          stored.map((session) => ({
            gameId: session.gameId,
            adminSecret: session.adminSecret,
          }))
        );

        if (cancelled) return;
        setGames(nextGames);
      } catch (loadError) {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar el dashboard"
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function getSecret(gameId: string) {
    return sessions.find((session) => session.gameId === gameId)?.adminSecret ?? "";
  }

  function openGame(gameId: string) {
    const secret = getSecret(gameId) || getAdminSecretForGame(gameId);
    if (!secret) {
      setError("No se encontró el token de esta trivia. Créala de nuevo desde el panel.");
      return;
    }
    router.push(
      `/admin/manage?gameId=${encodeURIComponent(gameId)}&secret=${encodeURIComponent(secret)}`
    );
  }

  async function createGame() {
    setCreating(true);
    setError(null);

    try {
      const data = await createGameRpc(title, timer);

      saveAdminSession({
        gameId: data.game.id,
        adminSecret: data.adminSecret,
        code: data.game.code,
        title: data.game.title,
      });

      router.push(
        `/admin/manage?gameId=${encodeURIComponent(data.game.id)}&secret=${encodeURIComponent(data.adminSecret)}`
      );
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "No se pudo crear la trivia"
      );
    } finally {
      setCreating(false);
    }
  }

  async function deleteGame(gameId: string) {
    const secret = getSecret(gameId);
    if (!secret) return;

    const confirmed = window.confirm("¿Eliminar esta trivia? No se puede deshacer.");
    if (!confirmed) return;

    setActionId(gameId);
    setError(null);

    try {
      await deleteGameRpc(gameId, secret);
      removeAdminSession(gameId);
      await loadDashboard();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar"
      );
    } finally {
      setActionId(null);
    }
  }

  async function restartGame(gameId: string) {
    const secret = getSecret(gameId);
    if (!secret) return;

    setActionId(gameId);
    setError(null);

    try {
      await gameControl(gameId, secret, "restart");
      openGame(gameId);
    } catch (restartError) {
      setError(
        restartError instanceof Error
          ? restartError.message
          : "No se pudo reiniciar"
      );
    } finally {
      setActionId(null);
    }
  }

  return (
    <AppShell>
      <LogoTitle subtitle="Dashboard admin" />

      <div className="flex gap-3">
        <PrimaryButton onClick={() => setShowCreate((current) => !current)}>
          {showCreate ? "Cerrar formulario" : "+ Nueva trivia"}
        </PrimaryButton>
        <SecondaryButton onClick={() => router.push("/")}>Inicio</SecondaryButton>
      </div>

      {showCreate ? (
        <Card className="space-y-4">
          <h2 className="text-xl font-extrabold">Crear trivia</h2>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Nombre de la trivia"
            className="w-full rounded-2xl border-0 bg-white px-4 py-3 font-semibold text-indigo-950 outline-none"
          />
          <input
            type="number"
            min={10}
            max={120}
            value={timer}
            onChange={(event) => setTimer(Number(event.target.value))}
            className="w-full rounded-2xl border-0 bg-white px-4 py-3 font-semibold text-indigo-950 outline-none"
          />
          <PrimaryButton onClick={createGame} disabled={creating}>
            {creating ? "Creando..." : "Crear y editar"}
          </PrimaryButton>
        </Card>
      ) : null}

      {error ? (
        <div className="rounded-2xl bg-rose-500/20 px-4 py-3 text-sm font-semibold">
          {error}
        </div>
      ) : null}

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Mis trivias</h2>
          <span className="text-sm text-white/70">{games.length} total</span>
        </div>

        {loading ? (
          <p className="text-white/70">Cargando...</p>
        ) : games.length === 0 ? (
          <p className="rounded-2xl bg-white/5 px-4 py-6 text-center text-white/70">
            Todavía no tienes trivias. Crea la primera arriba.
          </p>
        ) : (
          <div className="space-y-3">
            {games.map((game) => (
              <div
                key={game.id}
                className="rounded-2xl bg-white/10 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black">{game.title}</h3>
                    <p className="text-sm text-white/70">
                      Código {game.code} · {game.questionCount} preguntas ·{" "}
                      {game.participantCount} jugadores
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${phaseColors[game.phase]}`}
                  >
                    {phaseLabels[game.phase]}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openGame(game.id)}
                    className="rounded-full bg-white px-4 py-2 text-sm font-bold text-indigo-900"
                  >
                    {game.phase === "setup" ? "Editar" : "Abrir"}
                  </button>

                  {game.phase === "finished" ? (
                    <button
                      type="button"
                      disabled={actionId === game.id}
                      onClick={() => restartGame(game.id)}
                      className="rounded-full bg-yellow-300 px-4 py-2 text-sm font-bold text-indigo-900 disabled:opacity-50"
                    >
                      Reiniciar
                    </button>
                  ) : game.phase === "setup" && game.questionCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => openGame(game.id)}
                      className="rounded-full bg-emerald-300 px-4 py-2 text-sm font-bold text-indigo-900"
                    >
                      Iniciar
                    </button>
                  ) : (
                    <Link
                      href={`/play?code=${game.code}`}
                      className="rounded-full border border-white/30 px-4 py-2 text-center text-sm font-bold text-white"
                    >
                      Ver link
                    </Link>
                  )}

                  <button
                    type="button"
                    disabled={actionId === game.id}
                    onClick={() => deleteGame(game.id)}
                    className="col-span-2 rounded-full bg-rose-500/20 px-4 py-2 text-sm font-bold text-rose-100 disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </AppShell>
  );
}
