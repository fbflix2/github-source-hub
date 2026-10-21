// Reads the admin's OWN Supabase session in an impersonation tab.
// The impersonation tab keeps the client's session in sessionStorage under a
// separate key; the admin's real session stays in localStorage (same origin).
// This only returns a JWT — the server must still verify it (getUser + is_staff).
// It never grants anything by itself: a regular client has no admin token here.
const ADMIN_STORAGE_KEY = "sb-mxnlerkeygfvdnznoxld-auth-token";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export function isImpersonationTab(): boolean {
  return typeof window !== "undefined" && sessionStorage.getItem("fbflix_impersonation_tab") === "1";
}

export async function getStoredAdminAccessToken(): Promise<{ token: string; email: string | null } | null> {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const session = parsed?.currentSession ?? parsed;
    const token: unknown = session?.access_token;
    const expiresAt: number = Number(session?.expires_at ?? 0) * 1000;
    if (typeof token === "string" && token && (!expiresAt || expiresAt - Date.now() > 60_000)) {
      return { token, email: session?.user?.email ?? null };
    }
    // Expired: silently renew with the admin's refresh token.
    const refreshToken = session?.refresh_token;
    if (!refreshToken) return null;
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const fresh = await res.json();
    if (!fresh?.access_token) return null;
    const stored = { ...session, ...fresh, expires_at: fresh.expires_at ?? Math.floor(Date.now() / 1000) + (fresh.expires_in ?? 3600) };
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(stored));
    return { token: fresh.access_token, email: fresh.user?.email ?? session?.user?.email ?? null };
  } catch {
    return null;
  }
}
