"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { AnswerOptions } from "@/components/AnswerOptions";
import { CountdownTimer } from "@/components/CountdownTimer";
import { Leaderboard } from "@/components/Leaderboard";
import { WinnerCelebration } from "@/components/WinnerCelebration";
import {
  AppShell,
  Card,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui";
import { useGameById } from "@/hooks/useGameRealtime";
import { saveAdminSession, getAdminSecretForGame, updateAdminSessionTitle } from "@/lib/admin-storage";
import {
  countCorrectAnswers,
  getQuestionTimerSeconds,
  isParticipantOnline,
} from "@/lib/game-utils";
import {
  addQuestion,
  deleteQuestion as deleteQuestionRpc,
  gameControl,
  getShareUrl,
  updateGameSettings,
  updateQuestion,
} from "@/lib/game-service";

import { getWinners } from "@/lib/winner-utils";
import type { CreateQuestionInput, Question } from "@/lib/types";

const emptyQuestion: CreateQuestionInput = {
  question_text: "",
  options: ["", "", "", ""],
  correct_index: 0,
};

function AdminManageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientReady = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const gameId = searchParams.get("gameId") ?? "";
  const secretFromUrl = searchParams.get("secret") ?? "";
  const secretFromStorage = clientReady ? getAdminSecretForGame(gameId) : null;
  const adminSecret = secretFromUrl || secretFromStorage || "";

  const [draft, setDraft] = useState<CreateQuestionInput>(emptyQuestion);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [timerDraft, setTimerDraft] = useState<number | null>(null);

  const { state, loading, error, refresh } = useGameById(gameId, Boolean(gameId));

  const editTitle = titleDraft ?? state?.game.title ?? "";
  const editTimer = timerDraft ?? state?.game.default_timer_seconds ?? 30;
  const shareUrl = state?.game.code ? getShareUrl(state.game.code) : "";

  useEffect(() => {
    if (!gameId) {
      router.replace("/admin");
      return;
    }

    if (secretFromUrl || !secretFromStorage) return;

    const params = new URLSearchParams({
      gameId,
      secret: secretFromStorage,
    });
    router.replace(`/admin/manage?${params.toString()}`);
  }, [gameId, router, secretFromStorage, secretFromUrl]);

  useEffect(() => {
    if (!state || !adminSecret) return;

    saveAdminSession({
      gameId: state.game.id,
      adminSecret,
      code: state.game.code,
      title: state.game.title,
    });
  }, [adminSecret, state]);

  const currentQuestion = state?.currentQuestion ?? null;
  const timerSeconds = state
    ? getQuestionTimerSeconds(currentQuestion, {
        ...state.game,
        admin_secret: "",
      })
    : 30;

  const control = useCallback(
    async (action: string) => {
      if (!gameId || !adminSecret) return;

      setActionLoading(true);
      setMessage(null);

      try {
        const data = await gameControl(gameId, adminSecret, action);

        await refresh();

        if (data.finished) {
          setMessage("¡Trivia finalizada!");
        } else if (action === "restart") {
          setMessage("Trivia reiniciada. Comparte el link y empieza de nuevo.");
        }
      } catch (controlError) {
        setMessage(
          controlError instanceof Error
            ? controlError.message
            : "No se pudo ejecutar la acción"
        );
      } finally {
        setActionLoading(false);
      }
    },
    [adminSecret, gameId, refresh]
  );

  const handleTimerExpire = useCallback(() => {
    if (!state || actionLoading) return;

    if (state.game.phase === "question") {
      void control("auto_advance");
    } else if (state.game.phase === "reveal") {
      void control("auto_advance");
    }
  }, [actionLoading, control, state]);

  async function copyLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function saveGameSettings() {
    if (!gameId || !adminSecret) return;

    setActionLoading(true);
    setMessage(null);

    try {
      await updateGameSettings(gameId, adminSecret, editTitle, editTimer);

      updateAdminSessionTitle(gameId, editTitle);
      setTitleDraft(null);
      setTimerDraft(null);
      await refresh();
      setMessage("Cambios guardados");
    } catch (saveError) {
      setMessage(
        saveError instanceof Error ? saveError.message : "No se pudo guardar"
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteQuestion(questionId: string) {
    if (!gameId || !adminSecret) return;
    if (!window.confirm("¿Eliminar esta pregunta?")) return;

    setActionLoading(true);
    try {
      await deleteQuestionRpc(gameId, questionId, adminSecret);
      if (editingQuestionId === questionId) {
        setEditingQuestionId(null);
        setDraft(emptyQuestion);
      }

      await refresh();
      setMessage("Pregunta eliminada");
    } catch (deleteError) {
      setMessage(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar la pregunta"
      );
    } finally {
      setActionLoading(false);
    }
  }

  function startEditQuestion(question: Question) {
    setEditingQuestionId(question.id);
    setDraft({
      question_text: question.question_text,
      options: [...question.options, "", "", ""].slice(0, 4),
      correct_index: question.correct_index,
      timer_seconds: question.timer_seconds ?? undefined,
    });
  }

  async function saveQuestion() {
    if (!gameId || !adminSecret) return;

    setActionLoading(true);
    setMessage(null);

    try {
      if (editingQuestionId) {
        await updateQuestion(gameId, editingQuestionId, adminSecret, draft);
      } else {
        await addQuestion(gameId, adminSecret, draft);
      }

      setDraft(emptyQuestion);
      const wasEditing = Boolean(editingQuestionId);
      setEditingQuestionId(null);
      await refresh();
      setMessage(wasEditing ? "Pregunta actualizada" : "Pregunta agregada");
    } catch (saveError) {
      setMessage(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar la pregunta"
      );
    } finally {
      setActionLoading(false);
    }
  }

  if (!gameId) {
    return (
      <AppShell>
        <Card>Cargando...</Card>
      </AppShell>
    );
  }

  if (!clientReady && !secretFromUrl) {
    return (
      <AppShell>
        <Card>Cargando...</Card>
      </AppShell>
    );
  }

  if (!adminSecret) {
    return (
      <AppShell>
        <Card className="space-y-4">
          <p className="font-semibold text-white">
            No encontramos el token de esta trivia en este dispositivo. Ábrela
            desde el panel o crea una nueva.
          </p>
          <PrimaryButton onClick={() => router.push("/admin")}>
            Ir al panel admin
          </PrimaryButton>
        </Card>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell>
        <Card>Cargando trivia...</Card>
      </AppShell>
    );
  }

  if (error || !state) {
    return (
      <AppShell>
        <Card>{error ?? "No se encontró la trivia"}</Card>
      </AppShell>
    );
  }

  const onlineParticipants = state.participants.filter(isParticipantOnline);
  const answeredCount = state.answersForCurrentQuestion.length;
  const winners = getWinners(state.leaderboard);

  return (
    <AppShell>
      <div className="space-y-2 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-pink-200">
          Admin en vivo
        </p>
        <h1 className="text-3xl font-black">{state.game.title}</h1>
        <p className="text-white/70">Código: {state.game.code}</p>
        <SecondaryButton onClick={() => router.push("/admin")} className="!py-2 !text-sm">
          ← Dashboard
        </SecondaryButton>
      </div>

      {message ? (
        <div className="rounded-2xl bg-white/10 px-4 py-3 text-center text-sm font-semibold">
          {message}
        </div>
      ) : null}

      {state.game.phase === "setup" ? (
        <Card className="space-y-4">
          <h2 className="text-xl font-extrabold">Configuración</h2>
          <input
            value={editTitle}
            onChange={(event) => setTitleDraft(event.target.value)}
            className="w-full rounded-2xl border-0 bg-white px-4 py-3 font-semibold text-indigo-950 outline-none"
          />
          <input
            type="number"
            min={10}
            max={120}
            value={editTimer}
            onChange={(event) => setTimerDraft(Number(event.target.value))}
            className="w-full rounded-2xl border-0 bg-white px-4 py-3 font-semibold text-indigo-950 outline-none"
          />
          <SecondaryButton onClick={saveGameSettings} disabled={actionLoading}>
            Guardar configuración
          </SecondaryButton>

          <h2 className="text-xl font-extrabold">
            {editingQuestionId ? "Editar pregunta" : "Agregar preguntas"}
          </h2>
          <textarea
            value={draft.question_text}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                question_text: event.target.value,
              }))
            }
            rows={3}
            placeholder="Escribe la pregunta"
            className="w-full rounded-2xl border-0 bg-white px-4 py-3 font-semibold text-indigo-950 outline-none"
          />
          {draft.options.map((option, index) => (
            <div key={index} className="flex items-center gap-3">
              <input
                type="radio"
                checked={draft.correct_index === index}
                onChange={() =>
                  setDraft((current) => ({ ...current, correct_index: index }))
                }
              />
              <input
                value={option}
                onChange={(event) =>
                  setDraft((current) => {
                    const options = [...current.options];
                    options[index] = event.target.value;
                    return { ...current, options };
                  })
                }
                placeholder={`Opción ${index + 1}`}
                className="w-full rounded-2xl border-0 bg-white px-4 py-3 font-semibold text-indigo-950 outline-none"
              />
            </div>
          ))}
          <PrimaryButton onClick={saveQuestion} disabled={actionLoading}>
            {editingQuestionId ? "Actualizar pregunta" : "Guardar pregunta"}
          </PrimaryButton>
          {editingQuestionId ? (
            <SecondaryButton
              onClick={() => {
                setEditingQuestionId(null);
                setDraft(emptyQuestion);
              }}
            >
              Cancelar edición
            </SecondaryButton>
          ) : null}
          {state.questions.length > 0 ? (
            <SecondaryButton
              onClick={() => control("open_lobby")}
              disabled={actionLoading}
            >
              Abrir sala ({state.questions.length} preguntas)
            </SecondaryButton>
          ) : null}
        </Card>
      ) : null}

      {state.game.phase !== "setup" ? (
        <>
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white/70">Link para jugadores</p>
                <p className="break-all text-sm">{shareUrl}</p>
              </div>
              <button
                type="button"
                onClick={copyLink}
                className="rounded-full bg-yellow-300 px-4 py-2 text-sm font-extrabold text-indigo-950"
              >
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold uppercase tracking-wide text-white/70">
                Conectados ({onlineParticipants.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {onlineParticipants.length === 0 ? (
                  <span className="text-sm text-white/60">
                    Esperando participantes...
                  </span>
                ) : (
                  onlineParticipants.map((participant) => (
                    <span
                      key={participant.id}
                      className="rounded-full bg-emerald-400/20 px-3 py-1 text-sm font-bold text-emerald-100"
                    >
                      {participant.display_name}
                    </span>
                  ))
                )}
              </div>
            </div>
          </Card>

          {state.game.phase === "lobby" ? (
            <Card className="space-y-4 text-center">
              <p className="text-lg font-bold">Sala abierta</p>
              <p className="text-white/70">
                Comparte el link y espera a que entren los jugadores.
              </p>
              <PrimaryButton
                onClick={() => control("start_question")}
                disabled={actionLoading}
              >
                Iniciar primera pregunta
              </PrimaryButton>
            </Card>
          ) : null}

          {state.game.phase === "question" && currentQuestion ? (
            <Card className="space-y-5">
              <div className="flex items-center justify-between">
                <CountdownTimer
                  startedAt={state.game.question_started_at}
                  durationSeconds={timerSeconds}
                  onExpire={handleTimerExpire}
                  label="Tiempo"
                />
                <div className="text-right">
                  <p className="text-sm font-bold text-white/70">Respuestas</p>
                  <p className="text-2xl font-black">
                    {answeredCount}/{state.participants.length}
                  </p>
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm font-bold text-pink-200">
                  Pregunta {currentQuestion.order_index + 1} de{" "}
                  {state.questions.length}
                </p>
                <h2 className="mt-2 text-2xl font-black leading-tight">
                  {currentQuestion.question_text}
                </h2>
              </div>

              <AnswerOptions
                options={currentQuestion.options}
                selectedIndex={null}
                disabled
              />

              <SecondaryButton
                onClick={() => control("reveal")}
                disabled={actionLoading}
              >
                Mostrar respuesta correcta
              </SecondaryButton>
            </Card>
          ) : null}

          {state.game.phase === "reveal" && currentQuestion ? (
            <Card className="space-y-5">
              <div className="flex justify-center">
                <CountdownTimer
                  startedAt={state.game.reveal_started_at}
                  durationSeconds={Math.min(15, timerSeconds)}
                  onExpire={handleTimerExpire}
                  label="Siguiente pregunta"
                  size="sm"
                />
              </div>

              <div className="text-center">
                <p className="text-sm font-bold uppercase tracking-wide text-yellow-200">
                  Resultados
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  {currentQuestion.question_text}
                </h2>
              </div>

              <AnswerOptions
                options={currentQuestion.options}
                selectedIndex={null}
                correctIndex={currentQuestion.correct_index}
                showResults
                disabled
              />

              <p className="text-center text-sm font-semibold text-white/80">
                {countCorrectAnswers(state.answersForCurrentQuestion)} acertaron
              </p>

              <Leaderboard entries={state.leaderboard} />

              <PrimaryButton
                onClick={() => control("start_question")}
                disabled={actionLoading}
              >
                {currentQuestion.order_index + 1 >= state.questions.length
                  ? "Finalizar trivia"
                  : "Siguiente pregunta"}
              </PrimaryButton>
            </Card>
          ) : null}

          {state.game.phase === "finished" ? (
            <Card className="space-y-4">
              <WinnerCelebration winners={winners} active />
              <Leaderboard entries={state.leaderboard} />
              <PrimaryButton
                onClick={() => control("restart")}
                disabled={actionLoading}
              >
                Jugar de nuevo
              </PrimaryButton>
              <SecondaryButton onClick={() => router.push("/admin")}>
                Volver al dashboard
              </SecondaryButton>
            </Card>
          ) : null}
        </>
      ) : null}

      {state.game.phase === "setup" && state.questions.length > 0 ? (
        <Card>
          <p className="mb-3 font-bold">Preguntas guardadas</p>
          <div className="space-y-2">
            {state.questions.map((question, index) => (
              <div
                key={question.id}
                className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold"
              >
                <p>{index + 1}. {question.question_text}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEditQuestion(question)}
                    className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteQuestion(question.id)}
                    className="rounded-full bg-rose-500/20 px-3 py-1 text-xs font-bold text-rose-100"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </AppShell>
  );
}

export default function AdminManagePage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <Card>Cargando trivia...</Card>
        </AppShell>
      }
    >
      <AdminManageContent />
    </Suspense>
  );
}
