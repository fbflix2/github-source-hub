import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Cookie, Settings, X } from "lucide-react";

const STORAGE_KEY = "fbflix_cookie_consent_v1";
const POLICY_VERSION = "2026-06-26";

type Prefs = { necessary: true; analytics: boolean; marketing: boolean };

export function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({ necessary: true, analytics: true, marketing: false });

  useEffect(() => {
    (async () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return;
      } catch {}
      // Fallback: check DB for prior consent of this user (covers cleared localStorage / other devices)
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from("consent_logs")
            .select("event_type, preferences, policy_version")
            .eq("user_id", user.id)
            .in("event_type", ["cookies_accept_all", "cookies_reject_all", "cookies_custom"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data) {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify({
                preferences: data.preferences,
                version: data.policy_version,
                ts: new Date().toISOString(),
              }));
            } catch {}
            return;
          }
        }
      } catch {}
      setOpen(true);
    })();
  }, []);

  const persist = async (eventType: string, preferences: Prefs) => {
    const payload = { preferences, version: POLICY_VERSION, ts: new Date().toISOString() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch {}
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("consent_logs").insert({
        user_id: user?.id ?? null,
        event_type: eventType,
        policy_version: POLICY_VERSION,
        preferences: preferences as any,
        user_agent: navigator.userAgent,
      });
    } catch (e) { console.warn("[consent] failed to log", e); }
    setOpen(false);
  };

  const acceptAll = () => persist("cookies_accept_all", { necessary: true, analytics: true, marketing: true });
  const rejectAll = () => persist("cookies_reject_all", { necessary: true, analytics: false, marketing: false });
  const saveCustom = () => persist("cookies_custom", prefs);

  if (!open) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[9999] p-3 sm:p-4 pointer-events-none">
      <div className="pointer-events-auto max-w-4xl mx-auto bg-card/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl p-5 sm:p-6 animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-start gap-4">
          <div className="hidden sm:flex w-11 h-11 rounded-xl bg-primary/10 text-primary items-center justify-center shrink-0">
            <Cookie className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <Cookie className="size-4 sm:hidden" /> Sua privacidade importa
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
              Usamos cookies para manter sua sessão, melhorar a navegação e analisar o uso da plataforma.
              Você pode aceitar todos, rejeitar opcionais ou personalizar. Leia nossa{" "}
              <Link to="/cookies" className="text-primary underline">Política de Cookies</Link> e a{" "}
              <Link to="/privacidade" className="text-primary underline">Política de Privacidade</Link>.
            </p>

            {showPrefs && (
              <div className="mt-4 space-y-2 text-xs sm:text-sm">
                <Row label="Necessários" desc="Essenciais para login, carrinho e segurança." checked disabled />
                <Row label="Analíticos" desc="Medem visitas e comportamento para melhorar a plataforma."
                  checked={prefs.analytics}
                  onChange={(v) => setPrefs((p) => ({ ...p, analytics: v }))} />
                <Row label="Marketing" desc="Personalizam ofertas e campanhas (Pixel do Facebook, etc.)."
                  checked={prefs.marketing}
                  onChange={(v) => setPrefs((p) => ({ ...p, marketing: v }))} />
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {!showPrefs && (
                <button onClick={() => setShowPrefs(true)}
                  className="px-4 py-2 text-xs sm:text-sm rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-medium inline-flex items-center gap-2">
                  <Settings className="size-3.5" /> Personalizar
                </button>
              )}
              <button onClick={rejectAll}
                className="px-4 py-2 text-xs sm:text-sm rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-medium">
                Rejeitar opcionais
              </button>
              {showPrefs && (
                <button onClick={saveCustom}
                  className="px-4 py-2 text-xs sm:text-sm rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-medium">
                  Salvar escolhas
                </button>
              )}
              <button onClick={acceptAll}
                className="px-4 py-2 text-xs sm:text-sm rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90">
                Aceitar todos
              </button>
            </div>
          </div>
          <button onClick={rejectAll} className="text-muted-foreground hover:text-foreground -mr-1 -mt-1 p-1" aria-label="Fechar">
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, desc, checked, disabled, onChange }: { label: string; desc: string; checked: boolean; disabled?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-xl bg-secondary/50 border border-border cursor-pointer">
      <input type="checkbox" checked={checked} disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-0.5 size-4 accent-primary" />
      <div className="flex-1">
        <div className="font-semibold text-foreground">{label}{disabled && <span className="ml-2 text-[10px] uppercase text-muted-foreground">obrigatório</span>}</div>
        <div className="text-muted-foreground text-xs">{desc}</div>
      </div>
    </label>
  );
}