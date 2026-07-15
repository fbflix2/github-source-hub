import { useEffect, useState } from "react";
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
];

/**
 * Detecta se o hostname atual pertence a um revendedor (custom_domain) e,
 * se sim, redireciona a rota raiz para a loja pública desse revendedor.
 * Só faz o redirect uma vez por sessão de página.
 */
export default function CustomDomainRouter() {
  const location = useLocation();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (checked) return;
    if (typeof window === "undefined") return;

    const host = window.location.hostname.toLowerCase();
    if (MAIN_HOSTS.includes(host) || host.endsWith(".lovableproject.com")) {
      setChecked(true);
      return;
    }

    // Se já está numa rota específica que deve continuar funcionando, não redireciona
    const path = location.pathname;
    if (PASSTHROUGH_PREFIXES.some((p) => path === p || path.startsWith(p))) {
      setChecked(true);
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_reseller_slug_by_domain", { _domain: host });
        if (!error && data) {
          navigate(`/r/${data}${location.search}`, { replace: true });
        }
      } catch {
        // silencioso
      } finally {
        setChecked(true);
      }
    })();
  }, [checked, location.pathname, location.search, navigate]);

  return null;
}