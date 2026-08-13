const SITE_ADMIN_CODE_KEY = "trivia_site_admin_code";
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

export function subscribeSiteAdminCode(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function hasSiteAdminCode(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(sessionStorage.getItem(SITE_ADMIN_CODE_KEY));
}

export function getSiteAdminCode(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(SITE_ADMIN_CODE_KEY);
}

export function setSiteAdminCode(code: string) {
  sessionStorage.setItem(SITE_ADMIN_CODE_KEY, code);
  emitChange();
}

export function clearSiteAdminCode() {
  sessionStorage.removeItem(SITE_ADMIN_CODE_KEY);
  emitChange();
}

export function requireSiteAdminCode(): string {
  const code = getSiteAdminCode();
  if (!code) {
    throw new Error("Admin session expired. Enter your access code again.");
  }
  return code;
}
