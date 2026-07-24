import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const MAIN_HOSTS = [
  "fbflix.com.br",
  "www.fbflix.com.br",
  "fbflix1.lovable.app",
  "localhost",
];

const STORAGE_KEY = "fbflix_reseller_id";
const STORAGE_SLUG_KEY = "fbflix_reseller_slug";

/**
 * Resolve o reseller_id ativo a partir de:
 *  1. query string `?r=<slug>` (loja pública -> checkout)
 *  2. hostname (custom_domain do revendedor)
 *  3. localStorage (persistido durante a jornada)
 *
 * Retorna { resellerId, resellerSlug, loading }.
 */
export function useResellerContext() {
  const [searchParams] = useSearchParams();
  const [resellerId, setResellerId] = useState<string | null>(null);
  const [resellerSlug, setResellerSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const querySlug = (searchParams.get("r") || "").trim().toLowerCase();
        const host = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
        const isMainHost =
          !host ||
          MAIN_HOSTS.includes(host) ||
          host.endsWith(".lovableproject.com") ||
          host.endsWith(".lovable.app");

        let slug: string | null = querySlug || null;
        if (!slug && !isMainHost) {
          const { data } = await supabase.rpc("get_reseller_slug_by_domain", { _domain: host });
          if (data) slug = String(data);
        }
        if (!slug && typeof window !== "undefined") {
          slug = localStorage.getItem(STORAGE_SLUG_KEY);
        }

        if (!slug) {
          if (!cancelled) setLoading(false);
          return;
        }

        const { data: rows } = await supabase
          .from("resellers")
          .select("id, slug, status")
          .eq("slug", slug)
          .in("status", ["active", "warning"])
          .maybeSingle();

        if (!cancelled && rows?.id) {
          setResellerId(rows.id);
          setResellerSlug(rows.slug);
          try {
            localStorage.setItem(STORAGE_KEY, rows.id);
            localStorage.setItem(STORAGE_SLUG_KEY, rows.slug);
          } catch { /* noop */ }
        }
      } catch (e) {
        console.warn("useResellerContext error", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return { resellerId, resellerSlug, loading };
}

export function clearResellerContext() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_SLUG_KEY);
  } catch { /* noop */ }
}