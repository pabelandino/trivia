"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnswerOptions } from "@/components/AnswerOptions";
import { CountdownTimer } from "@/components/CountdownTimer";
import { Leaderboard } from "@/components/Leaderboard";
import { WinnerCelebration } from "@/components/WinnerCelebration";
import {
  AppShell,
  Card,
  LogoTitle,
  PrimaryButton,
} from "@/components/ui";
import { useGameByCode } from "@/hooks/useGameRealtime";
import { getQuestionTimerSeconds } from "@/lib/game-utils";
import { getWinners } from "@/lib/winner-utils";
import type { Answer, Participant } from "@/lib/types";

interface PlayPageProps {
  params: Promise<{ code: string }>;
}

const SESSION_PREFIX = "trivia_player_";

function getStoredSession(code: string) {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(`${SESSION_PREFIX}${code}`);
  if (!raw) return null;
  return JSON.parse(raw) as {
    participantId: string;
    sessionToken: string;
    displayName: string;
  };
}

function storeSession(
  code: string,
  data: { participantId: string; sessionToken: string; displayName: string }
) {
  localStorage.setItem(`${SESSION_PREFIX}${code}`, JSON.stringify(data));
}

export default function PlayPage({ params }: PlayPageProps) {
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [session, setSession] = useState<ReturnType<typeof getStoredSession>>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [myAnswer, setMyAnswer] = useState<Answer | null>(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitLockRef = useRef(false);

  useEffect(() => {
    params.then(({ code: gameCode }) => {
      const normalized = gameCode.toUpperCase();
      setCode(normalized);
      setSession(getStoredSession(normalized));
    });
  }, [params]);

  const { state, loading, error: loadError, refresh } = useGameByCode(code);

  const participant = useMemo(() => {
    if (!state || !session) return null;
    return state.participants.find(
      (item: Participant) => item.id === session.participantId
    );
  }, [session, state]);

  const myScore = useMemo(() => {
    if (!session || !state) return 0;
    return (
      state.leaderboard.find((entry) => entry.id === session.participantId)?.score ??
      participant?.score ??
      0
    );
  }, [participant?.score, session, state]);

  const winners = useMemo(
    () => (state ? getWinners(state.leaderboard) : []),
    [state]
  );

  const currentQuestion = state?.currentQuestion ?? null;
  const timerSeconds = state && currentQuestion
    ? getQuestionTimerSeconds(currentQuestion, {
        ...state.game,
        admin_secret: "",
      })
    : 30;

  useEffect(() => {
    if (!state || !session || !currentQuestion) {
      setMyAnswer(null);
      setSelectedIndex(null);
      submitLockRef.current = false;
      return;
    }

    const existing = state.answersForCurrentQuestion.find(
      (answer) => answer.participant_id === session.participantId
    );

    setMyAnswer(existing ?? null);
    setSelectedIndex(existing?.selected_index ?? null);

    if (existing) {
      submitLockRef.current = true;
    } else {
      submitLockRef.current = false;
    }
  }, [currentQuestion?.id, session, state]);

  useEffect(() => {
    if (!state) return;
    if (state.game.phase === "reveal" || state.game.phase === "finished") {
      void refresh();
    }
  }, [state?.game.phase, refresh, state]);

  useEffect(() => {
    if (!state?.game.id || !session) return;

    const interval = window.setInterval(async () => {
      await fetch(`/api/games/${state.game.id}/participants`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participant_id: session.participantId,
          session_token: session.sessionToken,
        }),
      });
    }, 10_000);

    return () => window.clearInterval(interval);
  }, [session, state?.game.id]);

  async function joinGame() {
    if (!state) return;

    setJoinLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/games/${state.game.id}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo unir a la trivia");
      }

      const nextSession = {
        participantId: data.participant.id,
        sessionToken: data.sessionToken,
        displayName: data.participant.display_name,
      };

      storeSession(code, nextSession);
      setSession(nextSession);
      await refresh();
    } catch (joinError) {
      setError(
        joinError instanceof Error
          ? joinError.message
          : "No se pudo unir a la trivia"
      );
    } finally {
      setJoinLoading(false);
    }
  }

  async function submitAnswer() {
    if (!state || !session || selectedIndex === null || myAnswer) return;
    if (submitLockRef.current) return;

    submitLockRef.current = true;
    setSubmitLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/games/${state.game.id}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participant_id: session.participantId,
          session_token: session.sessionToken,
          selected_index: selectedIndex,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo enviar la respuesta");
      }

      setMyAnswer(data.answer);
      await refresh();
    } catch (submitError) {
      submitLockRef.current = false;
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo enviar la respuesta"
      );
    } finally {
      setSubmitLoading(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <Card>Cargando...</Card>
      </AppShell>
    );
  }

  if (loadError || !state) {
    return (
      <AppShell>
        <Card>{loadError ?? "No se encontró la trivia"}</Card>
      </AppShell>
    );
  }

  if (!session) {
    return (
      <AppShell>
        <LogoTitle subtitle={state.game.title} />
        <Card className="space-y-4">
          <p className="text-center text-white/80">
            Elige un nombre para unirte
          </p>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Tu nombre"
            className="w-full rounded-2xl border-0 bg-white px-4 py-3 font-bold text-indigo-950 outline-none"
          />
          {error ? (
            <p className="rounded-2xl bg-rose-500/20 px-4 py-3 text-sm font-semibold">
              {error}
            </p>
          ) : null}
          <PrimaryButton
            onClick={joinGame}
            disabled={joinLoading || displayName.trim().length < 2}
          >
            {joinLoading ? "Entrando..." : "Entrar a la trivia"}
          </PrimaryButton>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-pink-200">{state.game.title}</p>
          <p className="text-lg font-black">{session.displayName}</p>
        </div>
        <div className="rounded-full bg-yellow-300 px-4 py-2 text-sm font-extrabold text-indigo-950">
          ⭐ {myScore} pts
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl bg-rose-500/20 px-4 py-3 text-sm font-semibold">
          {error}
        </div>
      ) : null}

      {state.game.phase === "lobby" ? (
        <Card className="space-y-3 text-center">
          <p className="text-5xl">⏳</p>
          <h2 className="text-2xl font-black">Esperando al admin</h2>
          <p className="text-white/70">
            Ya estás conectado. La trivia empezará pronto.
          </p>
          <Leaderboard entries={state.leaderboard} highlightId={session.participantId} compact />
        </Card>
      ) : null}

      {state.game.phase === "question" && currentQuestion ? (
        <Card className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-white/70">
              Pregunta {currentQuestion.order_index + 1} de {state.questions.length}
            </p>
            <CountdownTimer
              startedAt={state.game.question_started_at}
              durationSeconds={timerSeconds}
              size="sm"
            />
          </div>

          <h2 className="text-center text-2xl font-black leading-tight">
            {currentQuestion.question_text}
          </h2>

          <AnswerOptions
            options={currentQuestion.options}
            selectedIndex={selectedIndex}
            disabled={Boolean(myAnswer) || submitLoading}
            onSelect={setSelectedIndex}
          />

          {!myAnswer ? (
            <PrimaryButton
              onClick={submitAnswer}
              disabled={selectedIndex === null || submitLoading}
            >
              {submitLoading ? "Enviando..." : "Confirmar respuesta"}
            </PrimaryButton>
          ) : (
            <p className="text-center font-bold text-yellow-200">
              Respuesta enviada. Espera los resultados...
            </p>
          )}
        </Card>
      ) : null}

      {state.game.phase === "reveal" && currentQuestion ? (
        <Card className="space-y-5">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-wide text-yellow-200">
              Respuesta correcta
            </p>
            <h2 className="mt-2 text-2xl font-black">
              {currentQuestion.question_text}
            </h2>
          </div>

          <AnswerOptions
            options={currentQuestion.options}
            selectedIndex={myAnswer?.selected_index ?? null}
            correctIndex={currentQuestion.correct_index}
            showResults
            disabled
          />

          <p className="text-center text-lg font-extrabold">
            {myAnswer?.is_correct
              ? "¡Correcto! +1 punto"
              : myAnswer
                ? "Esta vez no fue..."
                : "No respondiste a tiempo"}
          </p>

          <Leaderboard entries={state.leaderboard} highlightId={session.participantId} />
        </Card>
      ) : null}

      {state.game.phase === "finished" ? (
        <Card className="space-y-4">
          <WinnerCelebration winners={winners} active />
          <Leaderboard entries={state.leaderboard} highlightId={session.participantId} />
        </Card>
      ) : null}

      {state.game.phase === "setup" ? (
        <Card className="text-center">
          <p className="text-lg font-bold">El admin todavía está preparando la trivia.</p>
        </Card>
      ) : null}
    </AppShell>
  );
}
