// Reads the admin's OWN Supabase session in an impersonation tab.
// The impersonation tab keeps the client's session in sessionStorage under a
// separate key; the admin's real session stays in localStorage (same origin).
// This only returns a JWT — the server must still verify it (getUser + is_staff).
// It never grants anything by itself: a regular client has no admin token here.
const ADMIN_STORAGE_KEY = "sb-mxnlerkeygfvdnznoxld-auth-token";

export function isImpersonationTab(): boolean {
  return typeof window !== "undefined" && sessionStorage.getItem("fbflix_impersonation_tab") === "1";
}

export function getStoredAdminAccessToken(): { token: string; email: string | null } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const session = parsed?.currentSession ?? parsed;
    const token: unknown = session?.access_token;
    const expiresAt: number = Number(session?.expires_at ?? 0) * 1000;
    if (typeof token !== "string" || !token) return null;
    if (expiresAt && expiresAt - Date.now() < 30_000) return null;
    return { token, email: session?.user?.email ?? null };
  } catch {
    return null;
  }
}
