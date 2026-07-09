import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Wallet, QrCode, Loader2, Copy, CheckCircle2, Shield } from "lucide-react";

interface CTPlan {
  id: string;
  name: string;
  price: number | string;
  profiles_qty?: number;
  proxies_qty?: number;
  bms_qty?: number;
  accounts_qty?: number;
  replacements_qty?: number;
}

interface Props {
  plan: CTPlan | null;
  open: boolean;
  onClose: () => void;
}

type Step = "choose" | "processing" | "pix" | "success";

export default function CTCheckoutModal({ plan, open, onClose }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("choose");
  const [method, setMethod] = useState<"saldo" | "pix" | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [pixData, setPixData] = useState<{ payment_id: string; qr_code: string; qr_code_base64: string | null; expires_at: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const price = Number(plan?.price ?? 0);

  useEffect(() => {
    if (!open) return;
    setStep("choose");
    setMethod(null);
    setPixData(null);
    setCopied(false);
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("balance").eq("user_id", user.id).single();
      setBalance(Number(data?.balance || 0));
    })();
  }, [open]);

  // Poll for PIX confirmation
  useEffect(() => {
    if (step !== "pix" || !pixData) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("payments")
        .select("status")
        .eq("id", pixData.payment_id)
        .maybeSingle();
      if (data?.status === "completed") {
        clearInterval(interval);
        setStep("success");
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [step, pixData]);

  async function confirm(chosen: "saldo" | "pix") {
    if (!plan) return;
    setMethod(chosen);
    setStep("processing");
    try {
      const { data, error } = await supabase.functions.invoke("ct-subscribe", {
        body: { plan_id: plan.id, payment_method: chosen },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (chosen === "saldo") {
        setStep("success");
      } else {
        setPixData({
          payment_id: data.payment_id,
          qr_code: data.qr_code,
          qr_code_base64: data.qr_code_base64,
          expires_at: data.expires_at,
        });
        setStep("pix");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(msg);
      setStep("choose");
    }
  }

  function handleClose() {
    if (step === "processing") return;
    onClose();
  }

  function goToDashboard() {
    onClose();
    navigate("/contingencia");
  }

  const hasBalance = balance >= price;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="size-5 text-primary" />
            Assinar {plan?.name}
          </DialogTitle>
          <DialogDescription>
            R$ {price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / mês — renovação automática pelo saldo.
          </DialogDescription>
        </DialogHeader>

        {step === "choose" && (
          <div className="space-y-3">
            <button
              onClick={() => hasBalance && confirm("saldo")}
              disabled={!hasBalance}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                hasBalance
                  ? "border-primary/30 bg-primary/5 hover:bg-primary/10 cursor-pointer"
                  : "border-glass-border bg-muted/30 opacity-60 cursor-not-allowed"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Wallet className="size-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-foreground">Pagar com saldo</p>
                  <p className="text-xs text-muted-foreground">
                    Saldo atual: R$ {balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    {!hasBalance && " — insuficiente"}
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => confirm("pix")}
              className="w-full text-left p-4 rounded-xl border border-glass-border bg-card hover:bg-muted/40 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/15 flex items-center justify-center">
                  <QrCode className="size-5 text-green-500" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-foreground">Pagar com PIX</p>
                  <p className="text-xs text-muted-foreground">Confirmação em até 24 h</p>
                </div>
              </div>
            </button>

            <p className="text-[11px] text-muted-foreground text-center pt-2">
              Após 30 dias, a renovação será cobrada automaticamente do seu saldo.
            </p>
          </div>
        )}

        {step === "processing" && (
          <div className="py-10 flex flex-col items-center gap-3">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Processando...</p>
          </div>
        )}

        {step === "pix" && pixData && (
          <div className="space-y-4">
            {pixData.qr_code_base64 && (
              <div className="flex justify-center bg-white p-4 rounded-xl">
                <img
                  src={`data:image/png;base64,${pixData.qr_code_base64}`}
                  alt="QR Code PIX"
                  className="w-56 h-56"
                />
              </div>
            )}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground">PIX Copia e Cola</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={pixData.qr_code}
                  className="flex-1 px-3 py-2 text-xs rounded-lg bg-muted border border-glass-border font-mono truncate"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(pixData.qr_code);
                    setCopied(true);
                    toast.success("Código copiado");
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <CheckCircle2 className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>
            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3">
              <p className="text-xs text-yellow-500 font-medium">
                ⏱️ Aguardando pagamento — este PIX expira em até 24 horas.
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                A assinatura é ativada automaticamente quando o pagamento é confirmado.
              </p>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="py-6 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center">
              <CheckCircle2 className="size-8 text-green-500" />
            </div>
            <div>
              <p className="font-bold text-foreground">Assinatura ativada!</p>
              <p className="text-xs text-muted-foreground mt-1">
                {method === "saldo"
                  ? "Pagamento debitado do saldo com sucesso."
                  : "Pagamento PIX confirmado."}
              </p>
            </div>
            <Button onClick={goToDashboard} className="w-full mt-2">
              Ir para meu painel CT
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}