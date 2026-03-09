import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PendingPayment {
  amount: number;
  original_product: string;
  created_at: string;
}

// Also used for locked sibling items
export type ExchangeLockType = "pending_payment" | "locked";

interface Props {
  itemId: string;
  orderId: string;
  orderCode: string;
  pendingPayment: PendingPayment;
  onPaymentComplete: () => void;
}

export default function ExchangePaymentGate({ itemId, orderId, orderCode, pendingPayment, onPaymentComplete }: Props) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_base64: string } | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchBalance();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  async function fetchBalance() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("balance")
      .eq("user_id", user.id)
      .single();
    setBalance(profile?.balance ?? 0);
  }

  async function clearPendingFlag() {
    // Remove the _exchange_pending_payment flag from delivery_data
    const { data: item } = await supabase
      .from("order_items")
      .select("delivery_data")
      .eq("id", itemId)
      .single();

    if (item?.delivery_data && typeof item.delivery_data === "object") {
      const dd = { ...(item.delivery_data as Record<string, any>) };
      delete dd._exchange_pending_payment;
      await supabase.from("order_items").update({
        delivery_data: Object.keys(dd).length > 0 ? dd : null,
      }).eq("id", itemId);
    }
  }

  async function handlePayWithBalance() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("balance")
        .eq("user_id", user.id)
        .single();

      const currentBalance = profile?.balance ?? 0;
      if (currentBalance < pendingPayment.amount) {
        toast.error("Saldo insuficiente");
        setLoading(false);
        return;
      }

      const newBalance = currentBalance - pendingPayment.amount;
      await supabase.from("profiles").update({ balance: newBalance }).eq("user_id", user.id);
      await supabase.from("wallet_transactions").insert({
        user_id: user.id,
        type: "debit",
        amount: pendingPayment.amount,
        title: `[Troca] Diferença de valor — ${orderCode}`,
        balance_after: newBalance,
      });

      await clearPendingFlag();
      toast.success("Pagamento realizado! Acesso liberado.");
      onPaymentComplete();
    } catch (err: any) {
      toast.error(err.message || "Erro ao pagar");
    } finally {
      setLoading(false);
    }
  }

  async function handlePayWithPix() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-pix-payment", {
        body: { amount: pendingPayment.amount },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setPixData({
        qr_code: data.qr_code,
        qr_code_base64: data.qr_code_base64,
      });
      setPaymentId(data.payment_id || null);

      // Start polling for payment confirmation
      if (data.payment_id) {
        pollingRef.current = setInterval(async () => {
          const { data: payment } = await supabase
            .from("payments")
            .select("status")
            .eq("id", data.payment_id)
            .single();

          if (payment?.status === "approved") {
            if (pollingRef.current) clearInterval(pollingRef.current);

            // Credit wallet then debit for exchange
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("balance")
                .eq("user_id", user.id)
                .single();

              const bal = profile?.balance ?? 0;
              // The PIX payment already credits the wallet via webhook,
              // so we just debit the exchange amount
              const newBalance = bal - pendingPayment.amount;
              await supabase.from("profiles").update({ balance: newBalance }).eq("user_id", user.id);
              await supabase.from("wallet_transactions").insert({
                user_id: user.id,
                type: "debit",
                amount: pendingPayment.amount,
                title: `[Troca] Diferença de valor — ${orderCode}`,
                balance_after: newBalance,
              });
            }

            await clearPendingFlag();
            toast.success("Pagamento confirmado! Acesso liberado.");
            onPaymentComplete();
          }
        }, 5000);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar PIX");
    } finally {
      setLoading(false);
    }
  }

  const canPayWithBalance = balance !== null && balance >= pendingPayment.amount;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-4">
      <div className="text-center space-y-2">
        <span className="material-symbols-outlined text-primary text-[40px]">lock</span>
        <h3 className="text-base font-bold text-foreground">Pagamento Pendente</h3>
        <p className="text-sm text-muted-foreground">
          Seu item foi trocado com sucesso, mas há uma diferença de valor a ser paga antes de acessar as credenciais.
        </p>
      </div>

      <div className="rounded-lg bg-muted/50 border border-border p-3 text-center">
        <p className="text-xs text-muted-foreground">Valor da diferença</p>
        <p className="text-2xl font-black text-primary">
          R$ {pendingPayment.amount.toFixed(2).replace(".", ",")}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          Troca de "{pendingPayment.original_product}"
        </p>
      </div>

      {!pixData ? (
        <div className="space-y-2">
          {/* Pay with balance */}
          <Button
            onClick={handlePayWithBalance}
            disabled={loading || !canPayWithBalance}
            className="w-full"
            variant={canPayWithBalance ? "default" : "outline"}
          >
            {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : (
              <span className="material-symbols-outlined text-[16px] mr-2">account_balance_wallet</span>
            )}
            Pagar com Saldo
            {balance !== null && (
              <span className="ml-2 text-xs opacity-70">
                (R$ {balance.toFixed(2).replace(".", ",")})
              </span>
            )}
          </Button>

          {!canPayWithBalance && balance !== null && (
            <p className="text-[10px] text-muted-foreground text-center">
              Saldo insuficiente. Use o PIX abaixo.
            </p>
          )}

          {/* Pay with PIX */}
          <Button
            onClick={handlePayWithPix}
            disabled={loading}
            variant="outline"
            className="w-full"
          >
            {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : (
              <span className="material-symbols-outlined text-[16px] mr-2">pix</span>
            )}
            Pagar via PIX
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground text-center font-medium">
            Escaneie o QR Code ou copie o código PIX abaixo:
          </p>

          {pixData.qr_code_base64 && (
            <div className="flex justify-center">
              <img
                src={`data:image/png;base64,${pixData.qr_code_base64}`}
                alt="QR Code PIX"
                className="w-48 h-48 rounded-lg border border-border"
              />
            </div>
          )}

          <button
            onClick={() => {
              navigator.clipboard.writeText(pixData.qr_code);
              setPixCopied(true);
              toast.success("Código PIX copiado!");
              setTimeout(() => setPixCopied(false), 3000);
            }}
            className="w-full py-2.5 rounded-lg bg-muted/50 border border-border text-foreground font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-muted transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">
              {pixCopied ? "check" : "content_copy"}
            </span>
            {pixCopied ? "Copiado!" : "Copiar Copia e Cola"}
          </button>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Aguardando confirmação do pagamento...
          </div>
        </div>
      )}
    </div>
  );
}
