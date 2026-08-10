import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const STORE_LAYOUT_KEY = "store_layout_v2";
export const STORE_HEADLINE_KEY = "store_v2_headline";
export const STORE_HEADLINE_VISIBLE_KEY = "store_v2_headline_visible";
export const DEFAULT_STORE_HEADLINE = "Ativos prontos para escalar";

/** Lê a flag global de layout da loja (layout 1 padrão / layout 2 premium). */
export function useStoreLayoutV2() {
  const cached = typeof window !== "undefined" ? localStorage.getItem(STORE_LAYOUT_KEY) : null;
  const [enabled, setEnabled] = useState<boolean>(cached === "1");
  const [loaded, setLoaded] = useState<boolean>(cached !== null);
  const [headline, setHeadline] = useState<string>(
    (typeof window !== "undefined" && localStorage.getItem(STORE_HEADLINE_KEY)) || DEFAULT_STORE_HEADLINE
  );
  const [headlineVisible, setHeadlineVisible] = useState<boolean>(
    typeof window !== "undefined" ? localStorage.getItem(STORE_HEADLINE_VISIBLE_KEY) !== "0" : true
  );

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

    (supabase.from("site_settings" as any) as any)
      .select("key,value")
      .in("key", [STORE_HEADLINE_KEY, STORE_HEADLINE_VISIBLE_KEY])
      .then(({ data }: any) => {
        if (cancelled || !Array.isArray(data)) return;
        const map: Record<string, string> = {};
        data.forEach((r: any) => { map[r.key] = String(r.value ?? ""); });
        const text = map[STORE_HEADLINE_KEY] || DEFAULT_STORE_HEADLINE;
        const visible = map[STORE_HEADLINE_VISIBLE_KEY] !== "0";
        setHeadline(text);
        setHeadlineVisible(visible);
        try {
          localStorage.setItem(STORE_HEADLINE_KEY, text);
          localStorage.setItem(STORE_HEADLINE_VISIBLE_KEY, visible ? "1" : "0");
        } catch { /* noop */ }
      });
    return () => { cancelled = true; };
  }, []);

  return { layoutV2: enabled, loaded, headline, headlineVisible };
}
