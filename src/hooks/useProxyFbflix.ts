import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type FunctionInvokeError = Error & {
  context?: {
    json?: () => Promise<any>;
    text?: () => Promise<string>;
  };
};

async function extractProxyFbflixErrorMessage(error: unknown, fallback = "Erro ProxyFbflix API") {
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

async function callProxyFbflix(action: string, params: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const invokeProxyFbflix = () => supabase.functions.invoke("proxyfbflix-api", {
    body: { action, ...params },
  });

  const { data, error } = await invokeProxyFbflix();

  if (error) {
    const realErrorMsg = await extractProxyFbflixErrorMessage(error, data?.error || "Erro ProxyFbflix API");

    // Retry once on auth failure
    if (error.message?.includes("401") || realErrorMsg.includes("Token inválido")) {
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr) {
        const retry = await invokeProxyFbflix();
        if (retry.error) {
          const retryRealErr = await extractProxyFbflixErrorMessage(retry.error, retry.data?.error || "Erro ProxyFbflix API");
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

export { callProxyFbflix };

/** Get ProxyFbflix account profile */
export function useProxyFbflixProfile() {
  return useQuery({
    queryKey: ["proxyfbflix-profile"],
    queryFn: () => callProxyFbflix("get-profile"),
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
  });
}

/** Get ProxyFbflix subscription + active plan */
export function useProxyFbflixPlan() {
  return useQuery({
    queryKey: ["proxyfbflix-plan"],
    queryFn: () => callProxyFbflix("get-plan"),
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
  });
}

/** Get proxy list (paginated) */
export function useProxyFbflixProxyList(page = 1, pageSize = 25, mode: "direct" | "backbone" = "direct") {
  return useQuery({
    queryKey: ["proxyfbflix-proxy-list", mode, page, pageSize],
    queryFn: () => callProxyFbflix("get-proxy-list", { mode, page, page_size: pageSize }),
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });
}

/** Get all proxies (fetches all pages server-side) */
export function useProxyFbflixAllProxies(mode: "direct" | "backbone" = "direct") {
  return useQuery({
    queryKey: ["proxyfbflix-all-proxies", mode],
    queryFn: () => callProxyFbflix("get-all-proxies", { mode }),
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
  });
}

/** Get proxy config (auth mode, etc.) */
export function useProxyFbflixProxyConfig() {
  return useQuery({
    queryKey: ["proxyfbflix-proxy-config"],
    queryFn: () => callProxyFbflix("get-proxy-config"),
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** Get client's ProxyFbflix subscriptions from local DB */
export function useProxyFbflixSubscriptions() {
  return useQuery({
    queryKey: ["proxyfbflix-subscriptions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, products:product_id(name, price)")
        .eq("user_id", user.id)
        .in("type", ["proxyfbflix", "proxyfbflix_rotating", "webshare"])
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      const results: any[] = [];
      for (const sub of (data || [])) {
        const raw = (sub.raw_data || {}) as Record<string, any>;
        const productInfo = sub.products as any;
        const isRotating = sub.type === "proxyfbflix_rotating";
        const productName = productInfo?.name || raw.product_name || (isRotating ? "Proxy Rotativo BR" : "Proxy Residencial");
        const customerPrice = productInfo?.price || null;

        const baseEntry = {
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
          type: sub.type,
          profile_tag: raw.profile_tag || null,
          provider: "proxyfbflix",
          is_rotating: isRotating,
          gb_purchased: isRotating ? (raw.gb_purchased || 0) : undefined,
        };

        const proxiesData = raw.proxies?.data || [];
        if (!isRotating && Array.isArray(proxiesData) && proxiesData.length > 1) {
          // Explode multi-proxy subscriptions into individual entries
          proxiesData.forEach((proxy: any, index: number) => {
            const proxyTagKey = `profile_tag_${proxy.id}`;
            const proxyDisplayName = `${sub.name}#${index + 1}`;
            
            // Reconstruct parsed info if missing
            const parsed = proxy.parsed || (() => {
              const parts = String(proxy.code || "").split(":");
              if (parts?.length >= 4) return { ip: parts[0], port: parts[1], username: parts[2], password: parts[3] };
              return null;
            })();

            results.push({
              ...baseEntry,
              code: `${sub.name}__proxy_${proxy.id}`,
              name: proxyDisplayName,
              proxyIndex: index + 1,
              totalProxies: proxiesData.length,
              proxyLabel: `Proxy ${index + 1}/${proxiesData.length}`,
              profile_tag: raw[proxyTagKey] || raw.profile_tag || null,
              proxy: {
                id: proxy.id,
                ip: parsed?.ip || proxy.proxy_address || proxy.ip,
                port: parsed?.port || proxy.port,
                username: parsed?.username || proxy.username,
                password: parsed?.password || proxy.password,
                protocol: "HTTP/SOCKS5",
              }
            });
          });
        } else {
          // Single proxy or rotating
          results.push({
            ...baseEntry,
            proxy: isRotating
              ? {
                  ip: raw.proxy_host || "p.proxyfbflix.io",
                  port: raw.http_port || 80,
                  username: raw.username,
                  password: raw.password,
                  protocol: "HTTP/SOCKS5",
                  socks5_port: raw.socks5_port || 1080,
                  converted_host: raw.converted_host || null,
                  alt_http_port: raw.alt_http_port || 3128,
                }
              : raw.proxy_address ? {
                  id: raw.fbflix_proxy_id || raw.webshare_proxy_id,
                  ip: raw.proxy_address,
                  port: raw.port,
                  username: raw.username,
                  password: raw.password,
                  protocol: "HTTP/SOCKS5",
                } : undefined,
          });
        }
      }
      return results;
    },
    staleTime: 30_000,
  });
}

/** Get ProxyFbflix rotating proxy bandwidth stats */
export function useProxyFbflixRotatingBandwidth() {
  return useQuery({
    queryKey: ["proxyfbflix-rotating-bandwidth"],
    queryFn: () => callProxyFbflix("get-rotating-credentials"),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** Exchange history for ProxyFbflix proxies (localStorage) */
export interface ProxyFbflixExchangeRecord {
  date: string;
  oldProxy: string;
  newProxy: string;
  method: string;
}

export function getProxyFbflixExchangeHistory(subscriptionId: string): ProxyFbflixExchangeRecord[] {
  try {
    return JSON.parse(localStorage.getItem(`ws-exchange-history-${subscriptionId}`) || "[]");
  } catch { return []; }
}

function saveProxyFbflixExchangeRecord(subscriptionId: string, oldProxy: string, newProxy: string, method: string) {
  const key = `ws-exchange-history-${subscriptionId}`;
  const history = getProxyFbflixExchangeHistory(subscriptionId);
  history.unshift({ date: new Date().toISOString(), oldProxy, newProxy, method });
  localStorage.setItem(key, JSON.stringify(history.slice(0, 20)));
}

/** Exchange a ProxyFbflix proxy (API first, stock fallback) */
export function useExchangeProxyFbflixProxy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ subscriptionId, oldProxyString }: { subscriptionId: string; oldProxyString?: string }) => {
      const result = await callProxyFbflix("exchange-proxyfbflix-proxy", { subscription_id: subscriptionId });
      return { result, oldProxyString, subscriptionId };
    },
    onSuccess: ({ result, oldProxyString, subscriptionId }) => {
      const newProxy = result?.new_proxy || "";
      if (oldProxyString && newProxy) {
        saveProxyFbflixExchangeRecord(subscriptionId, oldProxyString, newProxy, result?.method || "unknown");
      }
      toast.success("Proxy trocado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["proxyfbflix-subscriptions"] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao trocar proxy: ${err.message}`);
    },
  });
}

export function useSyncProxyFbflixProxyCredentials() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ subscriptionId }: { subscriptionId: string }) => {
      const result = await callProxyFbflix("sync-proxyfbflix-proxy-credentials", { subscription_id: subscriptionId });
      return result;
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["proxyfbflix-subscriptions"] });
      if (result?.synced) {
        toast.success("Credenciais do proxy sincronizadas com o ProxyFbflix.");
      }
    },
    onError: (err: Error) => {
      toast.error(`Erro ao sincronizar credenciais: ${err.message}`);
    },
  });
}

/** Toggle auto-renew for a ProxyFbflix subscription (direct DB update) */
export function useToggleProxyFbflixAutoRenew() {
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
      queryClient.invalidateQueries({ queryKey: ["proxyfbflix-subscriptions"] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar: ${err.message}`);
    },
  });
}

/** Migrate a ProxyBR expired/cancelled subscription to ProxyFbflix on renewal */
export function useMigrateProxyBRToProxyFbflix() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ subscriptionName, proxyIndex, totalProxies }: { subscriptionName: string; proxyIndex?: number; totalProxies?: number }) => {
      const result = await callProxyFbflix("migrate-proxybr-renewal", {
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
      queryClient.invalidateQueries({ queryKey: ["proxyfbflix-subscriptions"] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao renovar: ${err.message}`);
    },
  });
}

/** Get ProxyFbflix Top 10 usage stats */
export function useProxyFbflixUsageStats(period: "1h" | "24h" | "7d" = "24h") {
  return useQuery({
    queryKey: ["proxyfbflix-usage-stats", period],
    queryFn: () => callProxyFbflix("get-usage-stats", { period }),
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

/** Fix repeated proxy exchange (no quota deduction, one-time use) */
export function useFixRepeatedProxy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ subscriptionId }: { subscriptionId: string }) => {
      const result = await callProxyFbflix("fix-repeated-proxy", { 
        subscription_id: subscriptionId,
        is_fix: true
      });
      return result;
    },
    onSuccess: () => {
      toast.success("Correção realizada! Seu proxy foi trocado por um novo IP.");
      queryClient.invalidateQueries({ queryKey: ["proxyfbflix-subscriptions"] });
    },
    onError: (err: Error) => {
      toast.error(`Erro na correção: ${err.message}`);
    },
  });
}
