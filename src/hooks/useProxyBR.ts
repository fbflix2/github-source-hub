import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

async function callProxyBR(action: string, params: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("proxybr-api", {
    body: { action, ...params },
  });
  if (error) throw new Error(error.message || "Erro ao chamar ProxyBR API");
  if (data?.error) throw new Error(data.error);
  return data;
}

export function useProxyBRSubscriptions() {
  return useQuery({
    queryKey: ["proxybr-subscriptions"],
    queryFn: () => callProxyBR("get-subscriptions"),
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
    mutationFn: ({ subscriptionCode, proxy_id }: { subscriptionCode: string; proxy_id: number }) =>
      callProxyBR("exchange-proxy", { subscriptionCode, proxy_id }),
    onSuccess: () => {
      toast.success("Proxy trocado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["proxybr-subscriptions"] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao trocar proxy: ${err.message}`);
    },
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
