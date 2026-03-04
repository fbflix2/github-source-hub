import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function callWebshare(action: string, params: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabase.functions.invoke("webshare-api", {
    body: { action, ...params },
  });

  if (error) {
    // Retry once on auth failure
    if (error.message?.includes("401")) {
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr) {
        const retry = await supabase.functions.invoke("webshare-api", {
          body: { action, ...params },
        });
        if (retry.error) throw new Error(retry.error.message || "Erro Webshare API");
        if (retry.data?.error && !retry.data?.data) throw new Error(retry.data.error);
        return retry.data;
      }
    }
    throw new Error(error.message || "Erro Webshare API");
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
        .select("*")
        .eq("user_id", user.id)
        .eq("type", "webshare")
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      return (data || []).map((sub) => {
        const raw = (sub.raw_data || {}) as Record<string, any>;
        return {
          code: sub.name,
          name: sub.name,
          product_name: "Proxy Webshare",
          status: sub.status,
          start_date: sub.start_date,
          end_date: sub.end_date || sub.start_date,
          auto_renew: sub.auto_renew,
          raw_data: raw,
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
