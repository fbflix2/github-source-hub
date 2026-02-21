import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Minus, DollarSign } from "lucide-react";

interface AdjustBalanceModalProps {
  open: boolean;
  onClose: () => void;
  client: {
    user_id: string;
    full_name: string | null;
    balance: number;
  } | null;
  onUpdate: () => void;
}

export default function AdjustBalanceModal({ open, onClose, client, onUpdate }: AdjustBalanceModalProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"credit" | "debit">("credit");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!client) return;
    const val = parseFloat(amount);
    if (!val || val <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    if (!description.trim()) {
      toast.error("Informe uma descrição para a operação");
      return;
    }

    setSaving(true);
    try {
      const newBalance = type === "credit"
        ? client.balance + val
        : client.balance - val;

      if (newBalance < 0) {
        toast.error("Saldo insuficiente para essa operação");
        setSaving(false);
        return;
      }

      // Update balance
      const { error: balanceError } = await supabase
        .from("profiles")
        .update({ balance: newBalance })
        .eq("user_id", client.user_id);
      if (balanceError) throw balanceError;

      // Register wallet transaction
      const { error: txError } = await supabase
        .from("wallet_transactions")
        .insert({
          user_id: client.user_id,
          amount: type === "credit" ? val : -val,
          type,
          title: `[Admin] ${description.trim()}`,
          balance_after: newBalance,
        });
      if (txError) throw txError;

      toast.success(`Saldo ${type === "credit" ? "adicionado" : "removido"} com sucesso`);
      setAmount("");
      setDescription("");
      onUpdate();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao ajustar saldo");
    } finally {
      setSaving(false);
    }
  };

  if (!client) return null;

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setAmount(""); setDescription(""); } onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <DollarSign className="size-5 text-primary" />
            Ajustar Saldo
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Cliente: <strong>{client.full_name || "Sem nome"}</strong>
          <br />
          Saldo atual: <strong>{formatCurrency(client.balance)}</strong>
        </p>

        <div className="space-y-4 pt-2">
          {/* Type selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setType("credit")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold border transition-all ${
                type === "credit"
                  ? "bg-green-500/20 border-green-500/40 text-green-400"
                  : "bg-muted/50 border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Plus className="size-4" /> Adicionar
            </button>
            <button
              onClick={() => setType("debit")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold border transition-all ${
                type === "debit"
                  ? "bg-red-500/20 border-red-500/40 text-red-400"
                  : "bg-muted/50 border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Minus className="size-4" /> Remover
            </button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Valor (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Descrição da operação</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Compensação por problema no pedido..."
              className="min-h-[60px] resize-none text-sm"
            />
          </div>

          <Button onClick={handleSubmit} disabled={saving || !amount || !description.trim()} className="w-full gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
            {type === "credit" ? "Adicionar Saldo" : "Remover Saldo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
