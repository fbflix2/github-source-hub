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
];

const DOMAIN_LOOKUP_TIMEOUT_MS = 2500;
const RESELLER_SLUG_STORAGE_KEY = "fbflix_reseller_slug";
const PURCHASE_PASSTHROUGH_PREFIXES = ["/checkout", "/auth"];

function isMainHost(host: string) {
  return (
    MAIN_HOSTS.includes(host) ||
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".lovable.app")
  );
}

async function resolveSlugWithTimeout(host: string): Promise<string | null> {
  const lookup = supabase
    .rpc("get_reseller_slug_by_domain", { _domain: host })
    .then(({ data, error }) => (!error && data ? String(data) : null));

  const timeout = new Promise<null>((resolve) => {
    window.setTimeout(() => resolve(null), DOMAIN_LOOKUP_TIMEOUT_MS);
  });

  return Promise.race([lookup, timeout]);
}

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
    isMainHost(initialHost);
  const initialQuerySlug = new URLSearchParams(location.search).get("r")?.trim().toLowerCase() || null;
  const isPurchasePassthrough = PURCHASE_PASSTHROUGH_PREFIXES.some(
    (p) => location.pathname === p || location.pathname.startsWith(p),
  );
  // Em domínio de revendedor, sempre aguardar a resolução do branding antes
  // de renderizar (mesmo em rotas passthrough), para evitar o flash com logo
  // e menus da FBFlix.
  const [checked, setChecked] = useState(isMainHostInitial || (isPurchasePassthrough && Boolean(initialQuerySlug)));
  const [resellerSlug, setResellerSlug] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const host = window.location.hostname.toLowerCase();
    const root = document.documentElement;

    if (isMainHost(host)) {
      root.removeAttribute("data-custom-domain");
      setChecked(true);
      return;
    }

    root.setAttribute("data-custom-domain", "1");

    const path = location.pathname;
    const isPassthrough = PASSTHROUGH_PREFIXES.some(
      (p) => path === p || path.startsWith(p),
    );
    const querySlug = new URLSearchParams(location.search).get("r")?.trim().toLowerCase() || null;

    // Compra/login do revendedor não podem ficar bloqueados pela resolução do
    // domínio: a própria URL já informa o slug em `r=...`.
    if (isPassthrough && querySlug) {
      setResellerSlug(querySlug);
      try {
        localStorage.setItem(RESELLER_SLUG_STORAGE_KEY, querySlug);
      } catch {
        // silencioso
      }
      setChecked(true);
      return;
    }

    if (resellerSlug && isPassthrough) {
      setChecked(true);
      return;
    }

    (async () => {
      try {
        let slug = resellerSlug;
        if (!slug && querySlug) {
          slug = querySlug;
          setResellerSlug(slug);
          try {
            localStorage.setItem(RESELLER_SLUG_STORAGE_KEY, slug);
          } catch {
            // silencioso
          }
        }
        if (!slug) {
          try {
            slug = localStorage.getItem(RESELLER_SLUG_STORAGE_KEY);
          } catch {
            slug = null;
          }
          if (slug) setResellerSlug(slug);
        }
        if (!slug) {
          slug = await resolveSlugWithTimeout(host);
          if (slug) {
            setResellerSlug(slug);
            try {
              localStorage.setItem(RESELLER_SLUG_STORAGE_KEY, slug);
            } catch {
              // silencioso
            }
          }
        }
        if (slug && !isPassthrough) {
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
    return <div className="min-h-screen bg-background" />;
  }

  return <>{children}</>;
}