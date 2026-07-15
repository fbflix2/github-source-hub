import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const MAIN_HOSTS = [
  "fbflix.com.br",
  "www.fbflix.com.br",
  "fbflix1.lovable.app",
  "localhost",
];

export interface ResellerBranding {
  slug: string;
  brand_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  company_name: string | null;
}

/**
 * Detecta se o hostname atual pertence a um revendedor (custom_domain)
 * e retorna a identidade visual dele. Retorna null nos hosts principais
 * (FBFlix) ou enquanto carrega.
 */
export function useResellerBranding() {
  const [branding, setBranding] = useState<ResellerBranding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") {
      setLoading(false);
      return;
    }
    const host = window.location.hostname.toLowerCase();
    if (
      MAIN_HOSTS.includes(host) ||
      host.endsWith(".lovableproject.com") ||
      host.endsWith(".lovable.app")
    ) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data: slug } = await supabase.rpc(
          "get_reseller_slug_by_domain",
          { _domain: host },
        );
        if (!slug || cancelled) {
          if (!cancelled) setLoading(false);
          return;
        }
        const { data } = await supabase.rpc("get_reseller_public_by_slug", {
          _slug: slug as string,
        });
        const r = Array.isArray(data) ? data[0] : data;
        if (!cancelled && r) {
          setBranding({
            slug: slug as string,
            brand_name: r.brand_name ?? r.company_name ?? null,
            logo_url: r.logo_url ?? null,
            favicon_url: r.favicon_url ?? null,
            primary_color: r.primary_color ?? null,
            accent_color: r.accent_color ?? null,
            company_name: r.company_name ?? null,
          });
        }
      } catch {
        // silencioso
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { branding, loading };
}
