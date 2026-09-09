import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const MAIN_HOSTS = [
  "fbflix.com.br",
  "www.fbflix.com.br",
  "fbflix1.lovable.app",
  "localhost",
];

// Rotas internas (equipe / revendedor / fornecedor) não são afetadas
const EXEMPT_PREFIXES = ["/admin", "/revenda", "/fornecedor", "/reset-password", "/migrar"];

const RESELLER_SLUG_STORAGE_KEY = "fbflix_reseller_slug";

function isMainHost(host: string) {
  return (
    MAIN_HOSTS.includes(host) ||
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".lovable.app")
  );
}

/**
 * Garante o isolamento entre clientes da FBFlix e clientes de revendedores:
 *  - Cliente vinculado a um revendedor NUNCA navega no site da FBFlix:
 *    é deslogado e enviado para o domínio/loja do revendedor dele.
 *  - Cliente que se cadastrou/logou no domínio de um revendedor e ficou sem
 *    vínculo (ex.: login com Google) é vinculado automaticamente.
 */
export default function ResellerClientGuard() {
  const location = useLocation();
  const running = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const host = window.location.hostname.toLowerCase();
    const path = location.pathname;
    if (EXEMPT_PREFIXES.some((p) => path === p || path.startsWith(p))) return;

    const check = async () => {
      if (running.current) return;
      running.current = true;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;
        if (!user) return;

        const { data, error } = await supabase.rpc("get_my_reseller_binding" as any);
        if (error) return;
        const binding = Array.isArray(data) ? data[0] : data;

        if (isMainHost(host)) {
          // Cliente de revendedor tentando acessar a FBFlix -> desloga e redireciona
          if (binding && !binding.is_owner) {
            const slug = binding.slug as string | null;
            const domain = binding.custom_domain as string | null;
            try {
              await supabase.auth.signOut();
            } catch {
              /* noop */
            }
            const target = domain
              ? `https://${domain}/auth`
              : slug
                ? `/r/${slug}`
                : "/auth";
            window.location.replace(target);
          }
          return;
        }

        // Domínio de revendedor: se o cliente ainda não tem vínculo, vincular agora
        if (!binding) {
          let slug: string | null = null;
          try {
            slug = localStorage.getItem(RESELLER_SLUG_STORAGE_KEY);
          } catch {
            slug = null;
          }
          if (!slug) {
            const { data: slugData } = await supabase.rpc("get_reseller_slug_by_domain", {
              _domain: host,
            });
            if (slugData) slug = String(slugData);
          }
          if (!slug) return;

          const { data: pub } = await supabase.rpc("get_reseller_public_by_slug", { _slug: slug });
          const row = Array.isArray(pub) ? pub[0] : pub;
          if (!row?.id) return;

          await supabase
            .from("profiles")
            .update({ reseller_id: row.id })
            .eq("user_id", user.id)
            .is("reseller_id", null);
        }
      } finally {
        running.current = false;
      }
    };

    check();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setTimeout(() => void check(), 0);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [location.pathname]);

  return null;
}
