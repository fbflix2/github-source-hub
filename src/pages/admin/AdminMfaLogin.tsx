import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdminMfaSetup } from "@/components/admin/AdminMfaSetup";
import { Button } from "@/components/ui/button";
import logoFbflix from "@/assets/logo-fbflix.webp";

export default function AdminMfaLogin() {
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (cancelled) return;
        if (error || !data.user) { navigate("/admin/login", { replace: true }); return; }
        const { data: admin, error: roleError } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
        if (cancelled) return;
        if (roleError) throw roleError;
        if (!admin) { navigate("/admin/login", { replace: true }); return; }
        const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (cancelled) return;
        if (assuranceError) throw assuranceError;
        if (assurance.currentLevel === "aal2") { navigate("/admin", { replace: true }); return; }
        setState("ready");
      } catch { if (!cancelled) setState("error"); }
    }
    void check();
    return () => { cancelled = true; };
  }, [navigate]);

  async function cancel() {
    setLeaving(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      navigate("/admin/login", { replace: true });
    } catch { setState("error"); }
    finally { setLeaving(false); }
  }
  return <main className="min-h-screen bg-[#0a0505] text-white flex items-center justify-center p-6">
    <div className="w-full max-w-md space-y-6">
      <div className="flex items-center justify-center gap-3"><img src={logoFbflix} alt="FBFLIX" className="size-14 object-contain" /><div><h1 className="text-2xl font-bold">FBFLIX <span className="text-primary">Admin</span></h1><p className="text-sm text-white/50">Verificação de segurança</p></div></div>
      <div className="glass-card-static rounded-2xl p-8 space-y-4">
        {state === "loading" && <p>Validando sessão...</p>}
        {state === "error" && <><p>Não foi possível validar sua sessão.</p><Button onClick={() => window.location.reload()}>Tentar novamente</Button></>}
        {state === "ready" && <AdminMfaSetup login onVerified={() => navigate("/admin", { replace: true })} />}
        <Button variant="ghost" className="w-full" disabled={leaving} onClick={cancel}>Cancelar e voltar ao login</Button>
      </div>
    </div>
  </main>;
}
