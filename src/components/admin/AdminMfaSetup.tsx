import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export function AdminMfaSetup() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [factor, setFactor] = useState<{ id: string; qr?: string } | null>(null);
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  async function start() {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const existing = data.totp.find(f => f.status === "verified");
      if (existing) { setFactor({ id: existing.id }); setVerified(true); return; }
      const { data: enrollment, error: enrollmentError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "FBFLIX " + Date.now() });
      if (enrollmentError) throw enrollmentError;
      setFactor({ id: enrollment.id, qr: enrollment.totp.qr_code });
    } catch { toast.error("Não foi possível configurar o autenticador."); }
    finally { setBusy(false); }
  }
  async function confirm() {
    if (!factor || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (error) throw error;
      setVerified(true); setFactor({ id: factor.id }); setCode("");
      toast.success("Autenticador validado.");
    } catch { toast.error("Código inválido ou expirado. Tente novamente."); }
    finally { setBusy(false); }
  }
  return <>
    <Button variant="outline" size="sm" className="fixed bottom-24 right-4 z-40" onClick={() => setOpen(true)}><ShieldCheck className="size-4 mr-2" /> Segurança MFA</Button>
    <Dialog open={open} onOpenChange={v => { if (!busy) setOpen(v); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Autenticação em dois fatores</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Configure seu Google Authenticator. Nesta fase, a proteção ainda não é obrigatória no servidor.</p>
        {!factor && <Button disabled={busy} onClick={start}>Configurar autenticador</Button>}
        {factor?.qr && <><p className="text-sm">Escaneie o QR Code no seu autenticador.</p><img className="mx-auto w-48 h-48 bg-white p-2" src={factor.qr} alt="QR Code do autenticador" /></>}
        {verified && <p className="text-sm">Autenticador cadastrado. Você pode validar um código nesta sessão.</p>}
        {factor && <><Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} placeholder="Código de seis dígitos" /><Button disabled={busy || code.length !== 6} onClick={confirm}>Validar código</Button></>}
      </DialogContent>
    </Dialog>
  </>;
}
