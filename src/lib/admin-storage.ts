export interface AdminSession {
  gameId: string;
  adminSecret: string;
  code: string;
  title: string;
  updatedAt: string;
}

const ADMIN_STORAGE_KEY = "trivia_admin_sessions";

export function getAdminSessions(): AdminSession[] {
  if (typeof window === "undefined") return [];

  try {
    return JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY) ?? "[]") as AdminSession[];
  } catch {
    return [];
  }
}

export function saveAdminSession(session: Omit<AdminSession, "updatedAt">) {
  const existing = getAdminSessions();
  const nextSession: AdminSession = {
    ...session,
    updatedAt: new Date().toISOString(),
  };

  const filtered = existing.filter((item) => item.gameId !== session.gameId);
  localStorage.setItem(
    ADMIN_STORAGE_KEY,
    JSON.stringify([nextSession, ...filtered])
  );
}

export function removeAdminSession(gameId: string) {
  const filtered = getAdminSessions().filter((item) => item.gameId !== gameId);
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(filtered));
}

export function updateAdminSessionTitle(gameId: string, title: string) {
  const sessions = getAdminSessions().map((session) =>
    session.gameId === gameId
      ? { ...session, title, updatedAt: new Date().toISOString() }
      : session
  );
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(sessions));
}

export function getAdminSecretForGame(gameId: string): string | null {
  if (!gameId) return null;

  return (
    getAdminSessions().find((session) => session.gameId === gameId)?.adminSecret ??
    null
  );
}
