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

  let token = await getAccessToken();
  let { data, error } = await attempt(token);

  const hasTokenError =
    !!error?.message?.includes("401") ||
    !!data?.error?.includes?.("Token inválido") ||
    !!data?.error?.includes?.("expirado");

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