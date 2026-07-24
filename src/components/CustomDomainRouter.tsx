import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Hosts em que o app é a FBFlix "principal" — nunca redirecionar para loja de revendedor
const MAIN_HOSTS = [
  "fbflix.com.br",
  "www.fbflix.com.br",
  "fbflix1.lovable.app",
  "localhost",
];

// Prefixos de rota que devem funcionar normalmente mesmo em domínio de revendedor
const PASSTHROUGH_PREFIXES = [
  "/r/",
  "/auth",
  "/checkout",
  "/pagar",
  "/reset-password",
  "/2fa",
  "/admin",
  "/revenda",
  "/produto/",
  "/p/",
  "/wallet",
  "/tickets",
  "/profile",
  "/welcome",
  "/migrar",
  "/subscriptions",
  "/orders",
  "/item-details",
  "/loja",
];

/**
 * Detecta se o hostname atual pertence a um revendedor (custom_domain) e,
 * se sim, redireciona a rota raiz para a loja pública desse revendedor.
 * Só faz o redirect uma vez por sessão de página.
 */
export default function CustomDomainRouter({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const initialHost =
    typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
  const isMainHostInitial =
    MAIN_HOSTS.includes(initialHost) ||
    initialHost.endsWith(".lovableproject.com") ||
    initialHost.endsWith(".lovable.app");
  const isPassthroughInitial =
    typeof window !== "undefined" &&
    PASSTHROUGH_PREFIXES.some(
      (p) =>
        window.location.pathname === p || window.location.pathname.startsWith(p),
    );
  const [checked, setChecked] = useState(isMainHostInitial || isPassthroughInitial);
  const [resellerSlug, setResellerSlug] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const host = window.location.hostname.toLowerCase();
    if (
      MAIN_HOSTS.includes(host) ||
      host.endsWith(".lovableproject.com") ||
      host.endsWith(".lovable.app")
    ) {
      setChecked(true);
      return;
    }

    const path = location.pathname;
    if (PASSTHROUGH_PREFIXES.some((p) => path === p || path.startsWith(p))) {
      setChecked(true);
      return;
    }

    (async () => {
      try {
        let slug = resellerSlug;
        if (!slug) {
          const { data, error } = await supabase.rpc("get_reseller_slug_by_domain", { _domain: host });
          if (!error && data) {
            slug = data as string;
            setResellerSlug(slug);
          }
        }
        if (slug) {
          navigate(`/r/${slug}${location.search}`, { replace: true });
          setTimeout(() => setChecked(true), 0);
          return;
        }
      } catch {
        // silencioso
      }
      setChecked(true);
    })();
  }, [location.pathname, location.search, navigate, resellerSlug]);

  if (!checked) {
    // Tela neutra (sem branding FBFlix) enquanto resolvemos o domínio customizado
    return <div style={{ minHeight: "100vh", background: "#000" }} />;
  }

  return <>{children}</>;
}