import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useCallback, useRef, useEffect } from "react";

async function callProxyBR(action: string, params: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("proxybr-api", {
    body: { action, ...params },
  });
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
      return (data || []).map((sub: any) => {
        const raw = sub.raw_data || {};
        const proxy = raw.proxies?.data?.[0] || null;
        let proxyInfo = undefined;
        if (proxy) {
          // Try parsed first, then parse from code string
          const parsed = proxy.parsed || (() => {
            const parts = proxy.code?.split(":");
            if (parts?.length >= 4) return { ip: parts[0], port: parts[1], username: parts[2], password: parts[3] };
            return null;
          })();
          if (parsed) {
            proxyInfo = {
              id: proxy.id,
              ip: parsed.ip,
              port: parsed.port,
              username: parsed.username,
              password: parsed.password,
              protocol: raw.product?.type || "SOCKS5",
            };
          }
        }
        return {
          code: sub.name,
          name: sub.name,
          product_name: raw.product?.name || raw.product_name || undefined,
          status: sub.status,
          start_date: sub.start_date,
          end_date: sub.end_date || sub.start_date,
          auto_renew: sub.auto_renew,
          proxy: proxyInfo,
          raw_data: raw,
        };
      });
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

export function useExchangeProxy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ subscriptionCode, proxy_id }: { subscriptionCode: string; proxy_id?: number }) =>
      callProxyBR("exchange-proxy", { subscriptionCode, ...(proxy_id ? { proxy_id } : {}) }),
    onSuccess: () => {
      toast.success("Proxy trocado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["proxybr-subscriptions"] });
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
