import { useEffect, useState } from "react";
import { useParams, useSearchParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { trackPartnerEvent } from "@/lib/partnerTracking";
import logoFbflix from "@/assets/logo-fbflix.webp";

export default function PartnerRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [, setFound] = useState(false);

  useEffect(() => {
    const track = async () => {
      if (!slug) { setLoading(false); return; }

      // Uses a public RPC: the partners table is not readable by visitors (RLS),
      // so a direct select would silently fail and break attribution.
      const { data: rows } = await supabase.rpc("get_partner_by_slug" as any, { _slug: slug });
      const data: any = Array.isArray(rows) ? rows[0] : rows;

      if (data?.id) {
        localStorage.setItem("partner_ref", data.slug);
        localStorage.setItem("partner_ref_id", data.id);
        localStorage.setItem("partner_ref_at", new Date().toISOString());
        setFound(true);
        // Track the click event with the freshly known partner id
        const to = searchParams.get("to");
        trackPartnerEvent("click", {
          partnerId: data.id,
          metadata: { to: to || null, slug: data.slug },
        });
      }
      setLoading(false);
    };
    track();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2">
          <img src={logoFbflix} alt="FBFLIX" className="w-10 h-10 object-contain animate-pulse" />
          <span className="text-xl font-bold text-foreground">Redirecionando...</span>
        </div>
      </div>
    );
  }

  // Honor optional ?to=/path to deep-link the visitor after tracking the partner cookie
  const to = searchParams.get("to");
  const safeTo = to && to.startsWith("/") && !to.startsWith("//") ? to : "/loja";
  return <Navigate to={safeTo} replace />;
}
