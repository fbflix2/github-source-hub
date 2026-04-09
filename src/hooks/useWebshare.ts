import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type FunctionInvokeError = Error & {
  context?: {
    json?: () => Promise<any>;
    text?: () => Promise<string>;
  };
};

async function extractWebshareErrorMessage(error: unknown, fallback = "Erro Webshare API") {
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

async function callWebshare(action: string, params: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const invokeWebshare = () => supabase.functions.invoke("webshare-api", {
    body: { action, ...params },
  });

  const { data, error } = await invokeWebshare();

  if (error) {
    const realErrorMsg = await extractWebshareErrorMessage(error, data?.error || "Erro Webshare API");

    // Retry once on auth failure
    if (error.message?.includes("401") || realErrorMsg.includes("Token inválido")) {
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr) {
        const retry = await invokeWebshare();
        if (retry.error) {
          const retryRealErr = await extractWebshareErrorMessage(retry.error, retry.data?.error || "Erro Webshare API");
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

export { callWebshare };

/** Get Webshare account profile */
export function useWebshareProfile() {
  return useQuery({
    queryKey: ["webshare-profile"],
    queryFn: () => callWebshare("get-profile"),
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
  });
}

/** Get Webshare subscription + active plan */
export function useWebsharePlan() {
  return useQuery({
    queryKey: ["webshare-plan"],
    queryFn: () => callWebshare("get-plan"),
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
  });
}

/** Get proxy list (paginated) */
export function useWebshareProxyList(page = 1, pageSize = 25, mode: "direct" | "backbone" = "direct") {
  return useQuery({
    queryKey: ["webshare-proxy-list", mode, page, pageSize],
    queryFn: () => callWebshare("get-proxy-list", { mode, page, page_size: pageSize }),
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });
}

/** Get all proxies (fetches all pages server-side) */
export function useWebshareAllProxies(mode: "direct" | "backbone" = "direct") {
  return useQuery({
    queryKey: ["webshare-all-proxies", mode],
    queryFn: () => callWebshare("get-all-proxies", { mode }),
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
  });
}

/** Get proxy config (auth mode, etc.) */
export function useWebshareProxyConfig() {
  return useQuery({
    queryKey: ["webshare-proxy-config"],
    queryFn: () => callWebshare("get-proxy-config"),
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** Get client's Webshare subscriptions from local DB */
export function useWebshareSubscriptions() {
  return useQuery({
    queryKey: ["webshare-subscriptions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, products:product_id(name, price)")
        .eq("user_id", user.id)
        .in("type", ["webshare", "webshare_rotating"])
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      return (data || []).map((sub) => {
        const raw = (sub.raw_data || {}) as Record<string, any>;
        const productInfo = sub.products as any;
        const isRotating = sub.type === "webshare_rotating";
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
          provider: "webshare",
          is_rotating: isRotating,
          gb_purchased: isRotating ? (raw.gb_purchased || 0) : undefined,
          proxy: isRotating
            ? {
                ip: raw.proxy_host || "p.webshare.io",
                port: raw.http_port || 80,
                username: raw.username,
                password: raw.password,
                protocol: "HTTP/SOCKS5",
                socks5_port: raw.socks5_port || 1080,
                converted_host: raw.converted_host || null,
                alt_http_port: raw.alt_http_port || 3128,
              }
            : raw.proxy_address ? {
                id: raw.webshare_proxy_id,
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

/** Get Webshare rotating proxy bandwidth stats */
export function useWebshareRotatingBandwidth() {
  return useQuery({
    queryKey: ["webshare-rotating-bandwidth"],
    queryFn: () => callWebshare("get-rotating-credentials"),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** Exchange history for Webshare proxies (localStorage) */
export interface WebshareExchangeRecord {
  date: string;
  oldProxy: string;
  newProxy: string;
  method: string;
}

export function getWebshareExchangeHistory(subscriptionId: string): WebshareExchangeRecord[] {
  try {
    return JSON.parse(localStorage.getItem(`ws-exchange-history-${subscriptionId}`) || "[]");
  } catch { return []; }
}

function saveWebshareExchangeRecord(subscriptionId: string, oldProxy: string, newProxy: string, method: string) {
  const key = `ws-exchange-history-${subscriptionId}`;
  const history = getWebshareExchangeHistory(subscriptionId);
  history.unshift({ date: new Date().toISOString(), oldProxy, newProxy, method });
  localStorage.setItem(key, JSON.stringify(history.slice(0, 20)));
}

/** Exchange a Webshare proxy (API first, stock fallback) */
export function useExchangeWebshareProxy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ subscriptionId, oldProxyString }: { subscriptionId: string; oldProxyString?: string }) => {
      const result = await callWebshare("exchange-webshare-proxy", { subscription_id: subscriptionId });
      return { result, oldProxyString, subscriptionId };
    },
    onSuccess: ({ result, oldProxyString, subscriptionId }) => {
      const newProxy = result?.new_proxy || "";
      if (oldProxyString && newProxy) {
        saveWebshareExchangeRecord(subscriptionId, oldProxyString, newProxy, result?.method || "unknown");
      }
      toast.success("Proxy trocado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["webshare-subscriptions"] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao trocar proxy: ${err.message}`);
    },
  });
}

/** Toggle auto-renew for a Webshare subscription (direct DB update) */
export function useToggleWebshareAutoRenew() {
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
      queryClient.invalidateQueries({ queryKey: ["webshare-subscriptions"] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar: ${err.message}`);
    },
  });
}

/** Migrate a ProxyBR expired/cancelled subscription to Webshare on renewal */
export function useMigrateProxyBRToWebshare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ subscriptionName, proxyIndex, totalProxies }: { subscriptionName: string; proxyIndex?: number; totalProxies?: number }) => {
      const result = await callWebshare("migrate-proxybr-renewal", {
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
      queryClient.invalidateQueries({ queryKey: ["webshare-subscriptions"] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao renovar: ${err.message}`);
    },
  });
}
