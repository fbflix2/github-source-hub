import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const STORE_LAYOUT_KEY = "store_layout_v2";

/** Lê a flag global de layout da loja (layout 1 padrão / layout 2 premium). */
export function useStoreLayoutV2() {
  const cached = typeof window !== "undefined" ? localStorage.getItem(STORE_LAYOUT_KEY) : null;
  const [enabled, setEnabled] = useState<boolean>(cached === "1");
  const [loaded, setLoaded] = useState<boolean>(cached !== null);

  useEffect(() => {
    let cancelled = false;
    (supabase.from("site_settings" as any) as any)
      .select("value")
      .eq("key", STORE_LAYOUT_KEY)
      .maybeSingle()
      .then(({ data }: any) => {
        if (cancelled) return;
        const on = String(data?.value ?? "") === "1";
        setEnabled(on);
        setLoaded(true);
        try { localStorage.setItem(STORE_LAYOUT_KEY, on ? "1" : "0"); } catch { /* noop */ }
      });
    return () => { cancelled = true; };
  }, []);

  return { layoutV2: enabled, loaded };
}
