"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import {
  joinParticipant,
  participantHeartbeat,
  submitAnswer as submitAnswerRpc,
} from "@/lib/game-service";
import {
  findParticipantAnswer,
  getQuestionTimerSeconds,
  isAnswerCorrect,
} from "@/lib/game-utils";
import { getWinners } from "@/lib/winner-utils";
import type { Participant } from "@/lib/types";

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

function PlayPageContent() {
  const searchParams = useSearchParams();
  const code = (searchParams.get("code") ?? "").toUpperCase();

  const [displayName, setDisplayName] = useState("");
  const [joinedSession, setJoinedSession] = useState<ReturnType<typeof getStoredSession>>(null);
  const [pendingSelection, setPendingSelection] = useState<{
    questionId: string;
    index: number;
  } | null>(null);
  const [confirmedRoundKey, setConfirmedRoundKey] = useState<string | null>(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storedSession =
    code && typeof window !== "undefined" ? getStoredSession(code) : null;
  const session = joinedSession ?? storedSession;

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
  const questionRoundKey =
    currentQuestion && state?.game.phase === "question" && state.game.question_started_at
      ? `${currentQuestion.id}:${state.game.question_started_at}`
      : null;
  const timerSeconds = state && currentQuestion
    ? getQuestionTimerSeconds(currentQuestion, {
        ...state.game,
        admin_secret: "",
      })
    : 30;

  const myAnswer = useMemo(() => {
    if (!state || !session || !currentQuestion) return null;

    return findParticipantAnswer(
      state.answersForCurrentQuestion,
      session.participantId,
      currentQuestion.id
    );
  }, [currentQuestion, session, state]);

  const hasSubmittedThisRound =
    Boolean(myAnswer) || confirmedRoundKey === questionRoundKey;

  const selectedIndex =
    myAnswer?.selected_index ??
    (pendingSelection && pendingSelection.questionId === currentQuestion?.id
      ? pendingSelection.index
      : null);

  const answerWasCorrect =
    myAnswer && currentQuestion && state
      ? isAnswerCorrect(myAnswer, currentQuestion, state.game.phase)
      : false;

  useEffect(() => {
    if (!state) return;
    if (state.game.phase === "reveal" || state.game.phase === "finished") {
      void refresh();
    }
  }, [state?.game.phase, refresh, state]);

  useEffect(() => {
    if (!state?.game.id || !session) return;

    const interval = window.setInterval(() => {
      void participantHeartbeat(
        state.game.id,
        session.participantId,
        session.sessionToken
      );
    }, 10_000);

    return () => window.clearInterval(interval);
  }, [session, state?.game.id]);

  async function joinGame() {
    if (!state) return;

    setJoinLoading(true);
    setError(null);

    try {
      const data = await joinParticipant(state.game.id, displayName);
      const nextSession = {
        participantId: data.participant.id,
        sessionToken: data.sessionToken,
        displayName: data.participant.display_name,
      };

      storeSession(code, nextSession);
      setJoinedSession(nextSession);
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
    if (
      !state ||
      !session ||
      !currentQuestion ||
      !questionRoundKey ||
      selectedIndex === null ||
      hasSubmittedThisRound ||
      submitLoading
    ) {
      return;
    }

    setSubmitLoading(true);
    setError(null);

    try {
      await submitAnswerRpc(
        state.game.id,
        session.participantId,
        session.sessionToken,
        selectedIndex
      );

      setConfirmedRoundKey(questionRoundKey);
      setPendingSelection(null);
      void refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo enviar la respuesta"
      );
    } finally {
      setSubmitLoading(false);
    }
  }

  if (!code) {
    return (
      <AppShell>
        <Card>Falta el código de la trivia en el link.</Card>
      </AppShell>
    );
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
            key={questionRoundKey ?? currentQuestion.id}
            options={currentQuestion.options}
            selectedIndex={selectedIndex}
            disabled={hasSubmittedThisRound || submitLoading}
            onSelect={(index) => {
              if (hasSubmittedThisRound || submitLoading) return;
              setPendingSelection({ questionId: currentQuestion.id, index });
            }}
          />

          {!hasSubmittedThisRound ? (
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
            {answerWasCorrect
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

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <Card>Cargando...</Card>
        </AppShell>
      }
    >
      <PlayPageContent />
    </Suspense>
  );
}
