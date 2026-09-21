import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function CampaignRedirect() {
  const { code } = useParams<{ code: string }>();

  useEffect(() => {
    (async () => {
      if (!code) { window.location.replace("/"); return; }
      try {
        const { data, error } = await supabase.rpc("partner_campaign_increment_click" as any, { _short_code: code });
        const row: any = Array.isArray(data) ? data[0] : data;
        if (error || !row?.destination_url) {
          window.location.replace("/");
          return;
        }
        // Attribute partner
        try {
          if (row.partner_id) {
            localStorage.setItem("partner_ref_id", String(row.partner_id));
            localStorage.setItem("partner_ref_at", new Date().toISOString());
          }
        } catch {}
        // Build destination with UTMs appended
        const url = new URL(row.destination_url, window.location.origin);
        const utms: Record<string, string | null> = {
          utm_source: row.utm_source,
          utm_medium: row.utm_medium,
          utm_campaign: row.utm_campaign,
          utm_content: row.utm_content,
          utm_term: row.utm_term,
        };
        Object.entries(utms).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
        url.searchParams.set("ref_campaign", String(row.campaign_id || ""));
        window.location.replace(url.toString());
      } catch {
        window.location.replace("/");
      }
    })();
  }, [code]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] text-slate-400 text-sm">
      Redirecionando…
    </div>
  );
}