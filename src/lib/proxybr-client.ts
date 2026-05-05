import { supabase } from "@/integrations/supabase/client";

type ProxyBRParams = Record<string, unknown>;

async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.access_token) {
    return session.access_token;
  }

  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session?.access_token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  return data.session.access_token;
}

export async function invokeProxyBR(action: string, params: ProxyBRParams = {}) {
  const attempt = async (token: string) => {
    const { data, error } = await supabase.functions.invoke("proxybr-api", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: { action, ...params },
    });

    return { data, error };
  };

  // Proactively refresh if the token expires within 60 seconds
  const { data: { session } } = await supabase.auth.getSession();
  const expiresAt = session?.expires_at ?? 0;
  const nowSec = Math.floor(Date.now() / 1000);
  if (!session?.access_token || expiresAt - nowSec < 60) {
    await supabase.auth.refreshSession();
  }

  let token = await getAccessToken();
  let { data, error } = await attempt(token);

  const errMsg = `${error?.message ?? ""} ${data?.error ?? ""}`.toLowerCase();
  const hasTokenError =
    errMsg.includes("401") ||
    errMsg.includes("400") ||
    errMsg.includes("jwt") ||
    errMsg.includes("token inválido") ||
    errMsg.includes("expirado") ||
    errMsg.includes("expired");

  if (hasTokenError) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session?.access_token) {
      window.location.href = "/auth";
      throw new Error("Sessão expirada. Faça login novamente.");
    }

    token = refreshed.session.access_token;
    ({ data, error } = await attempt(token));
  }

  if (error) {
    throw new Error(error.message || "Erro ao chamar ProxyBR API");
  }

  if (data?.error && !data?.data) {
    throw new Error(data.error);
  }

  return data;
}