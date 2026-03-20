import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

interface ClientEditModalProps {
  open: boolean;
  onClose: () => void;
  client: {
    id: string;
    user_id: string;
    full_name: string | null;
    email?: string;
    phone: string | null;
    balance: number;
    status: string;
    avatar_url: string | null;
  } | null;
  onUpdate: () => void;
}

export default function ClientEditModal({ open, onClose, client, onUpdate }: ClientEditModalProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [balance, setBalance] = useState("0");
  const [status, setStatus] = useState("active");
  const [cardPaymentEnabled, setCardPaymentEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (client) {
      setFullName(client.full_name || "");
      setPhone(client.phone || "");
      setBalance(client.balance.toString());
      setStatus(client.status);
      // Fetch card_payment_enabled
      supabase.from("profiles").select("card_payment_enabled").eq("user_id", client.user_id).single().then(({ data }) => {
        setCardPaymentEnabled(data?.card_payment_enabled ?? false);
      });
    }
  }, [client]);

  const handleSave = async () => {
    if (!client) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName || null,
          phone: phone || null,
          balance: parseFloat(balance) || 0,
          status,
          card_payment_enabled: cardPaymentEnabled,
        })
        .eq("user_id", client.user_id);

      if (error) throw error;
      toast.success("Cliente atualizado com sucesso");
      onUpdate();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar cliente");
    } finally {
      setSaving(false);
    }
  };

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Editar Cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {client.email && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">E-mail</Label>
              <Input value={client.email} readOnly className="opacity-70 cursor-default" />
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nome Completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nome do cliente" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Telefone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Saldo (R$)</Label>
            <Input type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
                <SelectItem value="blocked">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Alterações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
