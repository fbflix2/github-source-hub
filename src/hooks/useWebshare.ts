import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

async function callWebshare(action: string, params: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabase.functions.invoke("webshare-api", {
    body: { action, ...params },
  });

  // Extract real error message from response body when edge function returns non-2xx
  const realErrorMsg = data?.error || error?.message || "Erro Webshare API";

  if (error) {
    // Retry once on auth failure
    if (error.message?.includes("401") || data?.error?.includes("Token inválido")) {
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr) {
        const retry = await supabase.functions.invoke("webshare-api", {
          body: { action, ...params },
        });
        const retryRealErr = retry.data?.error || retry.error?.message || "Erro Webshare API";
        if (retry.error) throw new Error(retryRealErr);
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
        .eq("type", "webshare")
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      return (data || []).map((sub) => {
        const raw = (sub.raw_data || {}) as Record<string, any>;
        const productInfo = sub.products as any;
        const productName = productInfo?.name || raw.product_name || "Proxy Webshare";
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
          proxy: raw.proxy_address ? {
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
