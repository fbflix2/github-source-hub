import { useState } from "react";
import { Loader2, Send, MessageCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type SoldProfile = { order: string; profile_id: string; item_id: string; product: string };
type AlertResult = { ok?: boolean; error?: string; date?: string; profiles?: SoldProfile[]; already_sent?: boolean; sent?: boolean; count?: number };

function localDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export default function LauthSoldAlert() {
  const [date, setDate] = useState(localDate);
  const [profiles, setProfiles] = useState<SoldProfile[] | null>(null);
  const [alreadySent, setAlreadySent] = useState(false);
  const [busy, setBusy] = useState(false);

  const invoke = async (action: "preview" | "send") => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("lauth-sold-alert", { body: { action, date } });
      if (error) throw error;
      const result = data as AlertResult;
      if (result?.error || !result?.ok) throw new Error(result?.error || "Não foi possível consultar o alerta.");
      if (action === "preview") {
        setProfiles(result.profiles || []);
        setAlreadySent(Boolean(result.already_sent));
        if (!result.profiles?.length) toast.info("Nenhum perfil com pagamento confirmado nesta data.");
      } else {
        toast.success("Solicitação de envio ao WhatsApp registrada.");
        setAlreadySent(true);
        await invokePreviewAfterSend();
      }
    } catch (err: any) {
      toast.error(err?.message || "Falha ao comunicar com o Supabase.");
    } finally {
      setBusy(false);
    }
  };

  const invokePreviewAfterSend = async () => {
    const { data } = await supabase.functions.invoke("lauth-sold-alert", { body: { action: "preview", date } });
    if (data?.ok) {
      setProfiles(data.profiles || []);
      setAlreadySent(Boolean(data.already_sent));
    }
  };

  return (
    <div className="glass-panel rounded-2xl border border-border p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <MessageCircle className="size-4 text-primary" /> Alerta de vendas — Lauth
          </div>
          <p className="text-xs text-muted-foreground mt-1">Enviar IDs de perfis pagos para (19) 99508-1355. Nenhum perfil será movido automaticamente.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" className="w-40" value={date} onChange={e => { setDate(e.target.value); setProfiles(null); setAlreadySent(false); }} />
          <Button variant="outline" disabled={busy || !date} onClick={() => invoke("preview")}>
            {busy ? <Loader2 className="size-4 animate-spin mr-2" /> : <ShieldCheck className="size-4 mr-2" />}
            Conferir vendas
          </Button>
        </div>
      </div>
      {profiles !== null && (
        <div className="space-y-3">
          <p className="text-sm text-foreground">{profiles.length} perfil(is) identificado(s) em pedidos com pagamento confirmado.</p>
          {profiles.length > 0 && (
            <div className="max-h-56 overflow-auto rounded-lg border border-border divide-y divide-border text-xs">
              {profiles.map(p => <div key={p.item_id + p.profile_id} className="flex flex-wrap justify-between gap-2 px-3 py-2"><span className="font-mono text-foreground">{p.profile_id}</span><span className="text-muted-foreground">{p.order}</span></div>)}
            </div>
          )}
          {alreadySent ? <p className="text-sm text-muted-foreground">Alerta já registrado para esta data. Novo envio bloqueado para evitar duplicidade.</p> : (
            <Button disabled={busy || profiles.length === 0} onClick={() => invoke("send")} className="gap-2">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Enviar alerta ao WhatsApp
            </Button>
          )}
          <p className="text-xs text-muted-foreground">O envio exige sessão de administrador. Confira o recebimento no WhatsApp antes de aprovar qualquer movimentação no Lauth.</p>
        </div>
      )}
    </div>
  );
}
