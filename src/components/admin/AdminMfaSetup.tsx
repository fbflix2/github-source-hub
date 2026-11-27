import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type Factor = { id: string; qr?: string; secret?: string };
type Props = { login?: boolean; onVerified?: () => void };

export function AdminMfaSetup({ login = false, onVerified }: Props) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"loading" | "unconfigured" | "configured" | "error">("loading");
  const [factor, setFactor] = useState<Factor | null>(null);
  const [code, setCode] = useState("");
  const [verifiedFactors, setVerifiedFactors] = useState<{ id: string; friendly_name?: string }[]>([]);

  async function load() {
    setStatus("loading");
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const existing = data.totp.filter(f => f.status === "verified");
      setVerifiedFactors(existing);
      setFactor(existing.length ? { id: existing[0].id } : null);
      setStatus(existing.length ? "configured" : "unconfigured");
    } catch {
      setStatus("error");
    }
  }
  useEffect(() => { void load(); }, []);

  async function start() {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      if (data.totp.some(f => f.status === "verified")) {
        await load();
        return;
      }
      // Only clean up incomplete TOTP enrollments; never remove verified factors.
      for (const old of data.all.filter(f => f.factor_type === "totp" && f.status === "unverified")) {
        const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: old.id });
        if (removeError) throw removeError;
      }
      const { data: enrollment, error: enrollmentError } = await supabase.auth.mfa.enroll({
        factorType: "totp", friendlyName: "FBFLIX"
      });
      if (enrollmentError) throw enrollmentError;
      setFactor({ id: enrollment.id, qr: enrollment.totp.qr_code, secret: enrollment.totp.secret });
      setCode("");
    } catch {
      toast.error("Não foi possível configurar o autenticador. Tente novamente.");
    } finally { setBusy(false); }
  }
  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!factor || !/^\d{6}$/.test(code) || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (error) throw error;
      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError || assurance?.currentLevel !== "aal2") throw new Error("MFA não confirmado");
      setFactor({ id: factor.id });
      setCode("");
      setStatus("configured");
      toast.success("Autenticador validado.");
      onVerified?.();
    } catch {
      setCode("");
      toast.error("Não foi possível validar o código. Confira o autenticador e tente novamente.");
    } finally { setBusy(false); }
  }

  return <section className={login ? "space-y-4" : "bg-[rgba(20,20,20,0.6)] border border-white/[0.08] rounded-2xl p-6 md:p-8 space-y-4"}>
    <div className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /><h2 className="text-xl font-bold">Autenticação em dois fatores</h2></div>
    {status === "loading" && <p className="text-sm text-muted-foreground">Consultando autenticador...</p>}
    {status === "error" && <div className="space-y-2"><p className="text-sm text-muted-foreground">Não foi possível consultar o autenticador.</p><Button variant="outline" onClick={load}>Tentar novamente</Button></div>}
    {status === "configured" && <p className="text-sm text-green-400">Autenticador cadastrado e ativo.</p>}
    {status === "configured" && !login && <p className="text-sm text-muted-foreground">O código de seis dígitos é exigido no login de administradores. O QR Code original não é exibido novamente.</p>}
    {status === "unconfigured" && !factor && <><p className="text-sm text-muted-foreground">Cadastre o Google Authenticator para proteger seu acesso administrativo.</p><Button disabled={busy} onClick={start}>{busy ? "Gerando..." : "Configurar autenticador"}</Button></>}
    {factor?.qr && <div className="space-y-2"><p className="text-sm">Escaneie o QR Code no Google Authenticator e informe o código gerado.</p><img className="mx-auto w-48 h-48 bg-white p-2 rounded" src={factor.qr} alt="QR Code do autenticador" />{factor.secret && <details className="text-sm"><summary className="cursor-pointer">Inserir chave manualmente</summary><code className="break-all select-all">{factor.secret}</code></details>}</div>}
    {login && verifiedFactors.length > 1 && <label className="block text-sm">Autenticador<select className="block w-full bg-background border rounded p-2 mt-1" value={factor?.id ?? ""} disabled={busy} onChange={e => { setFactor({ id: e.target.value }); setCode(""); }}>{verifiedFactors.map((f, i) => <option key={f.id} value={f.id}>{f.friendly_name || "Autenticador " + (i + 1)}</option>)}</select></label>}
    {factor && (login || factor.qr) && <form onSubmit={confirm} className="space-y-3">
      <label className="block text-sm">Código de seis dígitos</label>
      <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} disabled={busy} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" aria-label="Código de seis dígitos" />
      <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>{busy ? "Validando..." : login ? "Verificar e entrar" : "Ativar autenticador"}</Button>
    </form>}
  </section>;
}
