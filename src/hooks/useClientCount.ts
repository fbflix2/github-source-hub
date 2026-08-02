import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Contagem de clientes em tempo real (RPC + realtime em profiles). */
export function useClientCount(fallback = 0) {
  const [count, setCount] = useState<number>(fallback);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data, error } = await supabase.rpc("get_client_count");
      if (!active || error) return;
      const n = Number(data);
      if (Number.isFinite(n) && n > 0) setCount(n);
    };

    load();

    const channel = supabase
      .channel("client-count")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "profiles" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "profiles" },
        () => load()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return count;
}

/** Substitui os marcadores de contagem de clientes no texto. */
export function applyClientCount(text: string | null, count: number) {
  if (!text) return text;
  const formatted = count > 0 ? count.toLocaleString("pt-BR") : "";
  return text
    .replace(/\{\s*clientes?\s*\}/gi, formatted || "milhares de")
    .replace(/3\.581/g, formatted || "3.581");
}
