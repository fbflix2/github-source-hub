import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WhatsAppRequiredPopupProps {
  open: boolean;
  onClose: () => void;
  onSaved: (phone: string) => void;
  userId: string;
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function WhatsAppRequiredPopup({ open, onClose, onSaved, userId }: WhatsAppRequiredPopupProps) {
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const digits = phone.replace(/\D/g, "");
  const isValid = digits.length >= 10 && digits.length <= 11;

  const handleSave = async () => {
    if (!isValid) {
      toast.error("Informe um número válido com DDD");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ phone: digits })
        .eq("user_id", userId);

      if (error) throw error;

      toast.success("WhatsApp salvo com sucesso!");
      onSaved(digits);
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-green-500" />
            </div>
            <DialogTitle className="text-lg">Informe seu WhatsApp</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground text-sm">
            Para finalizar sua compra, precisamos do seu número de WhatsApp. Ele será usado para envio de informações importantes sobre seu pedido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="whatsapp-phone">Número com DDD</Label>
            <Input
              id="whatsapp-phone"
              type="tel"
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              className="text-base"
              autoFocus
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MessageCircle className="w-4 h-4 mr-2" />}
            Salvar e continuar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
