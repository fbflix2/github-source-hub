import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type FunctionInvokeError = Error & {
  context?: {
    json?: () => Promise<any>;
    text?: () => Promise<string>;
  };
};

async function extractProxy FbflixErrorMessage(error: unknown, fallback = "Erro Proxy Fbflix API") {
  const err = error as FunctionInvokeError;

  try {
    const payload = await err?.context?.json?.();
    if (typeof payload?.error === "string") return payload.error;
    if (typeof payload?.message === "string") return payload.message;
  } catch {
    // ignore JSON parse errors
  }

  try {
    const raw = await err?.context?.text?.();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.error === "string") return parsed.error;
      } catch {
        return raw;
      }
    }
  } catch {
    // ignore text read errors
  }

  return err?.message || fallback;
}

async function callProxy Fbflix(action: string, params: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const invokeProxy Fbflix = () => supabase.functions.invoke("proxy fbflix-api", {
    body: { action, ...params },
  });

  const { data, error } = await invokeProxy Fbflix();

  if (error) {
    const realErrorMsg = await extractProxy FbflixErrorMessage(error, data?.error || "Erro Proxy Fbflix API");

    // Retry once on auth failure
    if (error.message?.includes("401") || realErrorMsg.includes("Token inválido")) {
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr) {
        const retry = await invokeProxy Fbflix();
        if (retry.error) {
          const retryRealErr = await extractProxy FbflixErrorMessage(retry.error, retry.data?.error || "Erro Proxy Fbflix API");
          throw new Error(retryRealErr);
        }
        if (retry.data?.error && !retry.data?.data) throw new Error(retry.data.error);
        return retry.data;
      }
    }

    throw new Error(realErrorMsg);
  }

  if (data?.error && !data?.data) throw new Error(data.error);
  return data;
}

export { callProxy Fbflix };

/** Get Proxy Fbflix account profile */
export function useProxy FbflixProfile() {
  return useQuery({
    queryKey: ["proxy fbflix-profile"],
    queryFn: () => callProxy Fbflix("get-profile"),
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
  });
}

/** Get Proxy Fbflix subscription + active plan */
export function useProxy FbflixPlan() {
  return useQuery({
    queryKey: ["proxy fbflix-plan"],
    queryFn: () => callProxy Fbflix("get-plan"),
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
  });
}

/** Get proxy list (paginated) */
export function useProxy FbflixProxyList(page = 1, pageSize = 25, mode: "direct" | "backbone" = "direct") {
  return useQuery({
    queryKey: ["proxy fbflix-proxy-list", mode, page, pageSize],
    queryFn: () => callProxy Fbflix("get-proxy-list", { mode, page, page_size: pageSize }),
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });
}

/** Get all proxies (fetches all pages server-side) */
export function useProxy FbflixAllProxies(mode: "direct" | "backbone" = "direct") {
  return useQuery({
    queryKey: ["proxy fbflix-all-proxies", mode],
    queryFn: () => callProxy Fbflix("get-all-proxies", { mode }),
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
  });
}

/** Get proxy config (auth mode, etc.) */
export function useProxy FbflixProxyConfig() {
  return useQuery({
    queryKey: ["proxy fbflix-proxy-config"],
    queryFn: () => callProxy Fbflix("get-proxy-config"),
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** Get client's Proxy Fbflix subscriptions from local DB */
export function useProxy FbflixSubscriptions() {
  return useQuery({
    queryKey: ["proxy fbflix-subscriptions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, products:product_id(name, price)")
        .eq("user_id", user.id)
        .in("type", ["proxy fbflix", "proxy fbflix_rotating"])
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      return (data || []).map((sub) => {
        const raw = (sub.raw_data || {}) as Record<string, any>;
        const productInfo = sub.products as any;
        const isRotating = sub.type === "proxy fbflix_rotating";
        const productName = productInfo?.name || raw.product_name || (isRotating ? "Proxy Rotativo BR" : "Proxy Residencial");
        const customerPrice = productInfo?.price || null;
        return {
          id: sub.id,
          code: sub.name,
          name: sub.name,
          product_name: productName,
          customer_price: customerPrice,
          status: sub.status,
          start_date: sub.start_date,
          end_date: sub.end_date || sub.start_date,
          auto_renew: sub.auto_renew,
          raw_data: raw,
          profile_tag: raw.profile_tag || null,
          provider: "proxy fbflix",
          is_rotating: isRotating,
          gb_purchased: isRotating ? (raw.gb_purchased || 0) : undefined,
          proxy: isRotating
            ? {
                ip: raw.proxy_host || "p.proxy fbflix.io",
                port: raw.http_port || 80,
                username: raw.username,
                password: raw.password,
                protocol: "HTTP/SOCKS5",
                socks5_port: raw.socks5_port || 1080,
                converted_host: raw.converted_host || null,
                alt_http_port: raw.alt_http_port || 3128,
              }
            : raw.proxy_address ? {
                id: raw.proxy fbflix_proxy_id,
                ip: raw.proxy_address,
                port: raw.port,
                username: raw.username,
                password: raw.password,
                protocol: "HTTP/SOCKS5",
              } : undefined,
        };
      });
    },
    staleTime: 30_000,
  });
}

/** Get Proxy Fbflix rotating proxy bandwidth stats */
export function useProxy FbflixRotatingBandwidth() {
  return useQuery({
    queryKey: ["proxy fbflix-rotating-bandwidth"],
    queryFn: () => callProxy Fbflix("get-rotating-credentials"),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** Exchange history for Proxy Fbflix proxies (localStorage) */
export interface Proxy FbflixExchangeRecord {
  date: string;
  oldProxy: string;
  newProxy: string;
  method: string;
}

export function getProxy FbflixExchangeHistory(subscriptionId: string): Proxy FbflixExchangeRecord[] {
  try {
    return JSON.parse(localStorage.getItem(`ws-exchange-history-${subscriptionId}`) || "[]");
  } catch { return []; }
}

function saveProxy FbflixExchangeRecord(subscriptionId: string, oldProxy: string, newProxy: string, method: string) {
  const key = `ws-exchange-history-${subscriptionId}`;
  const history = getProxy FbflixExchangeHistory(subscriptionId);
  history.unshift({ date: new Date().toISOString(), oldProxy, newProxy, method });
  localStorage.setItem(key, JSON.stringify(history.slice(0, 20)));
}

/** Exchange a Proxy Fbflix proxy (API first, stock fallback) */
export function useExchangeProxy FbflixProxy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ subscriptionId, oldProxyString }: { subscriptionId: string; oldProxyString?: string }) => {
      const result = await callProxy Fbflix("exchange-proxy fbflix-proxy", { subscription_id: subscriptionId });
      return { result, oldProxyString, subscriptionId };
    },
    onSuccess: ({ result, oldProxyString, subscriptionId }) => {
      const newProxy = result?.new_proxy || "";
      if (oldProxyString && newProxy) {
        saveProxy FbflixExchangeRecord(subscriptionId, oldProxyString, newProxy, result?.method || "unknown");
      }
      toast.success("Proxy trocado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["proxy fbflix-subscriptions"] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao trocar proxy: ${err.message}`);
    },
  });
}

export function useSyncProxy FbflixProxyCredentials() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ subscriptionId }: { subscriptionId: string }) => {
      const result = await callProxy Fbflix("sync-proxy fbflix-proxy-credentials", { subscription_id: subscriptionId });
      return result;
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["proxy fbflix-subscriptions"] });
      if (result?.synced) {
        toast.success("Credenciais do proxy sincronizadas com o Proxy Fbflix.");
      }
    },
    onError: (err: Error) => {
      toast.error(`Erro ao sincronizar credenciais: ${err.message}`);
    },
  });
}

/** Toggle auto-renew for a Proxy Fbflix subscription (direct DB update) */
export function useToggleProxy FbflixAutoRenew() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ subscriptionId, auto_renew }: { subscriptionId: string; auto_renew: boolean }) => {
      const { error } = await supabase
        .from("subscriptions")
        .update({ auto_renew })
        .eq("id", subscriptionId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Renovação automática atualizada!");
      queryClient.invalidateQueries({ queryKey: ["proxy fbflix-subscriptions"] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar: ${err.message}`);
    },
  });
}

/** Migrate a ProxyBR expired/cancelled subscription to Proxy Fbflix on renewal */
export function useMigrateProxyBRToProxy Fbflix() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ subscriptionName, proxyIndex, totalProxies }: { subscriptionName: string; proxyIndex?: number; totalProxies?: number }) => {
      const result = await callProxy Fbflix("migrate-proxybr-renewal", {
        subscription_name: subscriptionName,
        proxy_index: proxyIndex,
        total_proxies: totalProxies,
      });
      return result;
    },
    onSuccess: (result: any) => {
      const price = result?.price ? `R$ ${Number(result.price).toFixed(2).replace('.', ',')}` : '';
      toast.success(`Proxy renovado com sucesso!${price ? ` • ${price}` : ''}`);
      queryClient.invalidateQueries({ queryKey: ["proxybr-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["proxy fbflix-subscriptions"] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao renovar: ${err.message}`);
    },
  });
}

/** Get Proxy Fbflix Top 10 usage stats */
export function useProxy FbflixUsageStats(period: "1h" | "24h" | "7d" = "24h") {
  return useQuery({
    queryKey: ["proxy fbflix-usage-stats", period],
    queryFn: () => callProxy Fbflix("get-usage-stats", { period }),
    staleTime: 300_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

/** Get proxy usage alerts configuration */
export function useProxyUsageAlerts() {
  return useQuery({
    queryKey: ["proxy-usage-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proxy_usage_alerts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Update/Create usage alert */
export function useUpsertUsageAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (alert: any) => {
      const { error } = await supabase
        .from("proxy_usage_alerts")
        .upsert(alert, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Regra de alerta salva!");
      queryClient.invalidateQueries({ queryKey: ["proxy-usage-alerts"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
