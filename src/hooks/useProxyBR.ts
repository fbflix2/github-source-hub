import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useCallback, useRef, useEffect } from "react";

async function callProxyBR(action: string, params: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("proxybr-api", {
    body: { action, ...params },
  });

  // If token expired, refresh session and retry once
  if (error && (error.message?.includes("401") || data?.error?.includes("Token inválido"))) {
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError) {
      const retry = await supabase.functions.invoke("proxybr-api", {
        body: { action, ...params },
      });
      if (retry.error) throw new Error(retry.error.message || "Erro ao chamar ProxyBR API");
      if (retry.data?.error && !retry.data?.data) throw new Error(retry.data.error);
      return retry.data;
    }
  }

  if (error) throw new Error(error.message || "Erro ao chamar ProxyBR API");
  if (data?.error && !data?.data) throw new Error(data.error);
  return data;
}

/** Fetches all subscriptions in paginated batches to avoid edge function timeouts */
export function useProxyBRAllSubscriptions() {
  const [allSubs, setAllSubs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const fetchedRef = useRef(false);

  const fetchAll = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    const accumulated: any[] = [];
    let nextPage: number | null = 1;
    try {
      while (nextPage !== null) {
        const result = await callProxyBR("get-all-subscriptions", {
          startPage: nextPage,
          maxPages: 1,
        });
        if (result?.data?.length) {
          accumulated.push(...result.data);
          setAllSubs([...accumulated]); // update progressively
        }
        nextPage = result?.nextPage ?? null;
      }
    } catch (err: any) {
      setError(err);
      // Still keep whatever we accumulated
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchAll();
    }
  }, [fetchAll]);

  return {
    data: { data: allSubs, total: allSubs.length },
    isLoading,
    error,
    refetch: () => { fetchedRef.current = false; fetchAll(); },
  };
}

export function useProxyBRSubscriptions() {
  return useQuery({
    queryKey: ["proxybr-subscriptions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("type", "proxybr")
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      // Map local DB records to the format the UI expects
      // "Explode" multi-proxy subscriptions into individual entries
      const results: any[] = [];
      for (const sub of (data || [])) {
        const raw = (sub.raw_data || {}) as Record<string, any>;
        const proxies = raw.proxies?.data || raw.subscription?.proxies?.data || [];
        const isMulti = proxies.length > 1;

        const buildProxyInfo = (proxy: any) => {
          const parsed = proxy.parsed || (() => {
            const parts = proxy.code?.split(":");
            if (parts?.length >= 4) return { ip: parts[0], port: parts[1], username: parts[2], password: parts[3] };
            return null;
          })();
          if (!parsed) return undefined;
          return {
            id: proxy.id,
            ip: parsed.ip,
            port: parsed.port,
            username: parsed.username,
            password: parsed.password,
            protocol: raw.product?.type || "SOCKS5",
          };
        };

        const baseEntry = {
          code: sub.name,
          name: sub.name,
          product_name: raw.product?.name || raw.product_name || raw.subscription?.product?.name || undefined,
          status: sub.status,
          start_date: sub.start_date,
          end_date: sub.end_date || sub.start_date,
          auto_renew: sub.auto_renew,
          raw_data: raw,
          profile_tag: raw.profile_tag || null,
        };

        if (proxies.length === 0) {
          // No proxies — emit one entry without proxy info
          results.push({ ...baseEntry, proxy: undefined });
        } else if (!isMulti) {
          // Single proxy — same as before
          results.push({ ...baseEntry, proxy: buildProxyInfo(proxies[0]) });
        } else {
          // Multiple proxies — divide exchange quota equally per proxy
          const rawFreeQuota = raw.exchange_quota_free ?? raw.subscription?.exchange_quota_free ?? 0;
          const rawPaidQuota = raw.exchange_quota_pay ?? raw.subscription?.exchange_quota_pay ?? 0;
          const perProxyFree = Math.floor(rawFreeQuota / proxies.length);
          const perProxyPaid = Math.floor(rawPaidQuota / proxies.length);

          proxies.forEach((proxy: any, index: number) => {
            results.push({
              ...baseEntry,
              code: `${sub.name}__proxy_${proxy.id}`,
              name: sub.name,
              proxy: buildProxyInfo(proxy),
              proxyIndex: index + 1,
              totalProxies: proxies.length,
              proxyLabel: `Proxy ${index + 1}/${proxies.length}`,
              raw_data: {
                ...raw,
                exchange_quota_free: perProxyFree,
                exchange_quota_pay: perProxyPaid,
              },
            });
          });
        }
      }
      return results;
    },
    staleTime: 30_000,
  });
}

export function useProxyBRProducts() {
  return useQuery({
    queryKey: ["proxybr-products"],
    queryFn: () => callProxyBR("get-products"),
    staleTime: 60_000,
  });
}

export function useProxyBRSubscription(code: string | null) {
  return useQuery({
    queryKey: ["proxybr-subscription", code],
    queryFn: () => callProxyBR("get-subscription", { subscriptionCode: code }),
    enabled: !!code,
  });
}

export function useRenewSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (subscriptionCode: string) =>
      callProxyBR("renew-subscription", { subscriptionCode }),
    onSuccess: () => {
      toast.success("Assinatura renovada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["proxybr-subscriptions"] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao renovar: ${err.message}`);
    },
  });
}

export interface ProxyExchangeRecord {
  date: string;
  oldProxy: string;
  newProxy: string;
}

export function getExchangeHistory(subscriptionCode: string): ProxyExchangeRecord[] {
  try {
    const key = `proxy-exchange-history-${subscriptionCode}`;
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch { return []; }
}

function saveExchangeRecord(subscriptionCode: string, oldProxy: string, newProxy: string) {
  const key = `proxy-exchange-history-${subscriptionCode}`;
  const history = getExchangeHistory(subscriptionCode);
  history.unshift({ date: new Date().toISOString(), oldProxy, newProxy });
  localStorage.setItem(key, JSON.stringify(history.slice(0, 20)));
}

export function useExchangeProxy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ subscriptionCode, proxy_id, oldProxyString }: { subscriptionCode: string; proxy_id?: number; oldProxyString?: string }) => {
      const result = await callProxyBR("exchange-proxy", { subscriptionCode, ...(proxy_id ? { proxy_id } : {}) });
      return { result, oldProxyString, subscriptionCode };
    },
    onSuccess: ({ result, oldProxyString, subscriptionCode }) => {
      const newProxyStr = result?.subscription?.new_proxy || result?.new_proxy || "";
      if (oldProxyString && newProxyStr) {
        saveExchangeRecord(subscriptionCode, oldProxyString, newProxyStr);
      }

      // Optimistically update cache with new proxy data from exchange response
      if (newProxyStr && newProxyStr !== "desconhecido") {
        const parts = newProxyStr.split(":");
        if (parts.length >= 4) {
          queryClient.setQueryData(["proxybr-subscriptions"], (old: any[] | undefined) => {
            if (!old) return old;
            return old.map((sub: any) => {
              // Match by subscription name (strip __proxy_ suffix)
              const subName = sub.name || sub.code?.split("__proxy_")[0];
              if (subName !== subscriptionCode) return sub;
              return {
                ...sub,
                proxy: {
                  ...sub.proxy,
                  ip: parts[0],
                  port: parts[1],
                  username: parts[2],
                  password: parts[3],
                },
              };
            });
          });
        }
      }

      toast.success("Proxy trocado com sucesso!");
      // Also refetch from DB after a delay (edge function updates DB in background)
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["proxybr-subscriptions"] });
      }, 3000);
    },
    onError: (err: Error) => {
      toast.error(`Erro ao trocar proxy: ${err.message}`);
    },
  });
}

export function useToggleAutoRenew() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ subscriptionCode, auto_renew }: { subscriptionCode: string; auto_renew: boolean }) =>
      callProxyBR("toggle-auto-renew", { subscriptionCode, auto_renew }),
    onSuccess: () => {
      toast.success("Renovação automática atualizada!");
      queryClient.invalidateQueries({ queryKey: ["proxybr-subscriptions"] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar: ${err.message}`);
    },
  });
}

export function useCheckSubscriptionCount() {
  return useQuery({
    queryKey: ["proxybr-check-count"],
    queryFn: () => callProxyBR("check-subscription-count"),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useContractSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      quantity: number;
      interval: "monthly" | "quarterly";
      product_variant_id: number;
      discount_coupon?: string;
    }) => callProxyBR("contract-subscription", params),
    onSuccess: () => {
      toast.success("Assinatura contratada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["proxybr-subscriptions"] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao contratar: ${err.message}`);
    },
  });
}
