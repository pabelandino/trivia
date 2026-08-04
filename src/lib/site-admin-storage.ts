const SITE_ADMIN_CODE_KEY = "trivia_site_admin_code";

export function getSiteAdminCode(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(SITE_ADMIN_CODE_KEY);
}

export function setSiteAdminCode(code: string) {
  sessionStorage.setItem(SITE_ADMIN_CODE_KEY, code);
}

export function clearSiteAdminCode() {
  sessionStorage.removeItem(SITE_ADMIN_CODE_KEY);
}

export function requireSiteAdminCode(): string {
  const code = getSiteAdminCode();
  if (!code) {
    throw new Error("Admin session expired. Enter your access code again.");
  }
  return code;
}
