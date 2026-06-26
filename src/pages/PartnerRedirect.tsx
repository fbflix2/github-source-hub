import { useEffect, useState } from "react";
import { useParams, useSearchParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import logoFbflix from "@/assets/logo-fbflix.webp";

export default function PartnerRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [, setFound] = useState(false);

  useEffect(() => {
    const track = async () => {
      if (!slug) { setLoading(false); return; }

      const { data } = await supabase
        .from("partners")
        .select("id, slug")
        .eq("slug", slug.toLowerCase())
        .maybeSingle();

      if (data) {
        localStorage.setItem("partner_ref", data.slug);
        localStorage.setItem("partner_ref_id", data.id);
        localStorage.setItem("partner_ref_at", new Date().toISOString());
        setFound(true);
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
