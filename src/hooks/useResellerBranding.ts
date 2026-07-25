import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const MAIN_HOSTS = [
  "fbflix.com.br",
  "www.fbflix.com.br",
  "fbflix1.lovable.app",
  "localhost",
];
const LOOKUP_TIMEOUT_MS = 3500;
const CACHE_PREFIX = "reseller_branding_cache_v1:";

const isResellerHostSync = (): boolean => {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  if (MAIN_HOSTS.includes(host)) return false;
  if (host.endsWith(".lovableproject.com")) return false;
  if (host.endsWith(".lovable.app")) return false;
  return true;
};

const readCachedBranding = (): ResellerBranding | null => {
  if (typeof window === "undefined") return null;
  try {
    const host = window.location.hostname.toLowerCase();
    const raw = window.localStorage.getItem(CACHE_PREFIX + host);
    if (!raw) return null;
    return JSON.parse(raw) as ResellerBranding;
  } catch {
    return null;
  }
};

const writeCachedBranding = (b: ResellerBranding) => {
  if (typeof window === "undefined") return;
  try {
    const host = window.location.hostname.toLowerCase();
    window.localStorage.setItem(CACHE_PREFIX + host, JSON.stringify(b));
  } catch {}
};

const withTimeout = async <T,>(promise: PromiseLike<T>, fallback: T): Promise<T> => {
  const timeout = new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(fallback), LOOKUP_TIMEOUT_MS);
  });
  return Promise.race([Promise.resolve(promise), timeout]);
};

export interface ResellerBranding {
  slug: string;
  brand_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  company_name: string | null;
}

const getSlugFromUrl = () => {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const directSlug = params.get("r")?.trim().toLowerCase();
  if (directSlug) return directSlug;

  const redirect = params.get("redirect");
  if (!redirect) return null;
  try {
    const redirectUrl = new URL(redirect, window.location.origin);
    return redirectUrl.searchParams.get("r")?.trim().toLowerCase() || null;
  } catch {
    return null;
  }
};

/**
 * Detecta se o hostname atual pertence a um revendedor (custom_domain)
 * e retorna a identidade visual dele. Retorna null nos hosts principais
 * (FBFlix) ou enquanto carrega.
 */
export function useResellerBranding() {
  const [branding, setBranding] = useState<ResellerBranding | null>(() => readCachedBranding());
  const [loading, setLoading] = useState(true);
  const isResellerHost = isResellerHostSync();

  useEffect(() => {
    if (typeof window === "undefined") {
      setLoading(false);
      return;
    }
    const host = window.location.hostname.toLowerCase();
    const urlSlug = getSlugFromUrl();
    if (!urlSlug && (
      MAIN_HOSTS.includes(host) ||
      host.endsWith(".lovableproject.com") ||
      host.endsWith(".lovable.app")
    )) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        let slug: string | null = urlSlug;
        if (!slug) {
          const { data } = await withTimeout(
            supabase.rpc("get_reseller_slug_by_domain", { _domain: host }),
            { data: null, error: null } as any,
          );
          slug = data ? String(data) : null;
        }
        if (!slug || cancelled) {
          if (!cancelled) setLoading(false);
          return;
        }
        const { data } = await withTimeout(
          supabase.rpc("get_reseller_public_by_slug", { _slug: slug }),
          { data: null, error: null } as any,
        );
        const r = Array.isArray(data) ? data[0] : data;
        if (!cancelled && r) {
          const next: ResellerBranding = {
            slug: slug as string,
            brand_name: r.brand_name ?? r.company_name ?? null,
            logo_url: r.logo_url ?? null,
            favicon_url: r.favicon_url ?? null,
            primary_color: r.primary_color ?? null,
            accent_color: r.accent_color ?? null,
            company_name: r.company_name ?? null,
          };
          setBranding(next);
          writeCachedBranding(next);
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

  return { branding, loading, isResellerHost };
}
