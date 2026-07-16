import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useResellerBranding } from "@/hooks/useResellerBranding";

function hexToHslTriplet(hex: string): string | null {
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / (max - min) + (g < b ? 6 : 0); break;
      case g: h = (b - r) / (max - min) + 2; break;
      case b: h = (r - g) / (max - min) + 4; break;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Aplica globalmente as cores do revendedor (primary/accent) via variáveis CSS
 * para que TODAS as páginas (checkout, wallet, tickets, etc.) herdem a
 * identidade visual do revendedor — não apenas o portal.
 *
 * Fontes:
 * 1) useResellerBranding — quando o app roda em domínio customizado do revendedor.
 * 2) Usuário logado que é revendedor — busca a row em `resellers`.
 *
 * Nunca aplica no FBFlix (sem revendedor no contexto).
 */
export default function ResellerBrandingApplier() {
  const { branding } = useResellerBranding();
  const [userReseller, setUserReseller] = useState<{ primary_color: string | null; accent_color: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setUserReseller(null);
          return;
        }
        const { data } = await supabase
          .from("resellers")
          .select("primary_color, accent_color")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!cancelled) setUserReseller(data ?? null);
      } catch {
        if (!cancelled) setUserReseller(null);
      }
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const primary = branding?.primary_color || userReseller?.primary_color || null;
  const accent = branding?.accent_color || userReseller?.accent_color || null;

  useEffect(() => {
    const STYLE_ID = "reseller-branding-vars-global";
    const existing = document.getElementById(STYLE_ID);
    if (!primary && !accent) {
      existing?.remove();
      return;
    }
    const primaryHsl = primary ? hexToHslTriplet(primary) : null;
    const accentHsl = accent ? hexToHslTriplet(accent) : null;
    if (!primaryHsl && !accentHsl) {
      existing?.remove();
      return;
    }
    const rules: string[] = [];
    if (primaryHsl) {
      rules.push(`--primary: ${primaryHsl} !important;`);
      rules.push(`--ring: ${primaryHsl} !important;`);
      rules.push(`--sidebar-primary: ${primaryHsl} !important;`);
      rules.push(`--sidebar-ring: ${primaryHsl} !important;`);
    }
    if (accentHsl) {
      rules.push(`--accent: ${accentHsl} !important;`);
    }
    const css = `:root, .dark, html, body { ${rules.join(" ")} }`;
    if (existing) {
      existing.textContent = css;
    } else {
      const el = document.createElement("style");
      el.id = STYLE_ID;
      el.textContent = css;
      document.head.appendChild(el);
    }
  }, [primary, accent]);

  return null;
}
