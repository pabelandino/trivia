"use client";

import { useState } from "react";
import { AppShell, Card, LogoTitle, PrimaryButton } from "@/components/ui";
import { verifySiteAdmin, changeSiteAdminCode } from "@/lib/game-service";
import {
  clearSiteAdminCode,
  getSiteAdminCode,
  setSiteAdminCode,
} from "@/lib/site-admin-storage";

interface AdminAccessGateProps {
  children: React.ReactNode;
}

export function AdminAccessGate({ children }: AdminAccessGateProps) {
  const [unlocked, setUnlocked] = useState(() => Boolean(getSiteAdminCode()));
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUnlock() {
    setLoading(true);
    setError(null);

    try {
      await verifySiteAdmin(code.trim());
      setSiteAdminCode(code.trim());
      setUnlocked(true);
    } catch {
      setError("Código incorrecto");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    clearSiteAdminCode();
    setUnlocked(false);
    setCode("");
  }

  if (!unlocked) {
    return (
      <AppShell>
        <LogoTitle subtitle="Acceso admin" />
        <Card className="space-y-4">
          <p className="text-center text-white/80">
            Ingresa el código de seguridad para administrar trivias.
          </p>
          <input
            type="password"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Código de admin"
            className="w-full rounded-2xl border-0 bg-white px-4 py-3 font-semibold text-indigo-950 outline-none"
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleUnlock();
            }}
          />
          {error ? (
            <p className="rounded-2xl bg-rose-500/20 px-4 py-3 text-sm font-semibold text-rose-100">
              {error}
            </p>
          ) : null}
          <PrimaryButton
            onClick={handleUnlock}
            disabled={loading || code.trim().length < 4}
          >
            {loading ? "Verificando..." : "Entrar"}
          </PrimaryButton>
          <p className="text-center text-xs text-white/50">
            Código inicial por defecto: trivia2024 (cámbialo al entrar)
          </p>
        </Card>
      </AppShell>
    );
  }

  return (
    <>
      {children}
      <ChangeAdminCodePanel onLogout={handleLogout} />
    </>
  );
}

function ChangeAdminCodePanel({ onLogout }: { onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const [currentCode, setCurrentCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleChangeCode() {
    if (newCode !== confirmCode) {
      setMessage("Los códigos nuevos no coinciden");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await changeSiteAdminCode(currentCode.trim(), newCode.trim());
      setSiteAdminCode(newCode.trim());
      setCurrentCode("");
      setNewCode("");
      setConfirmCode("");
      setOpen(false);
      setMessage("Código actualizado correctamente");
    } catch (changeError) {
      setMessage(
        changeError instanceof Error
          ? changeError.message
          : "No se pudo cambiar el código"
      );
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full bg-white/20 px-4 py-2 text-xs font-bold text-white backdrop-blur"
        >
          Cambiar código
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-full bg-white/20 px-4 py-2 text-xs font-bold text-white backdrop-blur"
        >
          Salir
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <Card className="w-full max-w-md space-y-4">
        <h2 className="text-xl font-extrabold">Cambiar código de admin</h2>
        <input
          type="password"
          value={currentCode}
          onChange={(event) => setCurrentCode(event.target.value)}
          placeholder="Código actual"
          className="w-full rounded-2xl border-0 bg-white px-4 py-3 font-semibold text-indigo-950 outline-none"
        />
        <input
          type="password"
          value={newCode}
          onChange={(event) => setNewCode(event.target.value)}
          placeholder="Nuevo código (mín. 4 caracteres)"
          className="w-full rounded-2xl border-0 bg-white px-4 py-3 font-semibold text-indigo-950 outline-none"
        />
        <input
          type="password"
          value={confirmCode}
          onChange={(event) => setConfirmCode(event.target.value)}
          placeholder="Confirmar nuevo código"
          className="w-full rounded-2xl border-0 bg-white px-4 py-3 font-semibold text-indigo-950 outline-none"
        />
        {message ? (
          <p className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold">
            {message}
          </p>
        ) : null}
        <div className="flex gap-2">
          <PrimaryButton
            onClick={handleChangeCode}
            disabled={
              loading ||
              currentCode.length < 4 ||
              newCode.length < 4 ||
              confirmCode.length < 4
            }
          >
            {loading ? "Guardando..." : "Guardar"}
          </PrimaryButton>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full border border-white/30 px-4 py-3 text-sm font-bold text-white"
          >
            Cancelar
          </button>
        </div>
      </Card>
    </div>
  );
}
