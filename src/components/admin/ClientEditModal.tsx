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
  const [apiAuthorized, setApiAuthorized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);

  useEffect(() => {
    if (client) {
      setFullName(client.full_name || "");
      setPhone(client.phone || "");
      setBalance(client.balance.toString());
      setStatus(client.status);
      // Fetch card_payment_enabled
      supabase.from("profiles").select("card_payment_enabled, is_api_authorized, document_url").eq("user_id", client.user_id).single().then(({ data }) => {
        setCardPaymentEnabled(data?.card_payment_enabled ?? false);
        setApiAuthorized((data as any)?.is_api_authorized ?? false);
        setDocumentUrl((data as any)?.document_url ?? null);
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
          is_api_authorized: apiAuthorized,
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
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Pagamento via Cartão</Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">Liberar crédito/débito para este cliente</p>
              </div>
              <Switch checked={cardPaymentEnabled} onCheckedChange={setCardPaymentEnabled} />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Acesso à API</Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">Liberar integração via API para este usuário</p>
              </div>
              <Switch checked={apiAuthorized} onCheckedChange={setApiAuthorized} />
            </div>
          </div>

          {documentUrl && (
            <div className="space-y-3 pt-3 border-t border-border">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Documento Enviado</Label>
              
              {/\.(jpg|jpeg|png|webp|gif)$/i.test(documentUrl) && (
                <div className="rounded-lg overflow-hidden border border-border bg-secondary/30 aspect-video flex items-center justify-center relative group">
                  <img src={documentUrl} alt="Documento" className="w-full h-full object-contain cursor-pointer transition-transform group-hover:scale-105" onClick={() => window.open(documentUrl, "_blank")} />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <span className="material-symbols-outlined text-white text-3xl">zoom_in</span>
                  </div>
                </div>
              )}

              <Button 
                variant="outline" 
                className="w-full gap-2 border-primary/20 hover:bg-primary/5 text-primary h-10"
                  onClick={() => {
                    const newWindow = window.open("", "_blank");
                    if (newWindow) {
                      newWindow.document.write(`
                        <html>
                          <head>
                            <title>Visualizar Documento</title>
                            <style>
                              body { margin: 0; padding: 0; background: #000; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; }
                              iframe, img { max-width: 100%; max-height: 100%; border: none; }
                              .fallback { color: #fff; text-align: center; }
                              a { color: #ff4444; text-decoration: none; font-weight: bold; }
                            </style>
                          </head>
                          <body>
                            ${documentUrl.toLowerCase().endsWith('.pdf') 
                              ? `<iframe src="${documentUrl}" width="100%" height="100%"></iframe>`
                              : `<img src="${documentUrl}" />`
                            }
                          </body>
                        </html>
                      `);
                    }
                  }}
              >
                <span className="material-symbols-outlined text-lg">
                  {/\.pdf$/i.test(documentUrl) ? "picture_as_pdf" : "description"}
                </span>
                {/\.pdf$/i.test(documentUrl) ? "Abrir PDF em nova aba" : "Ver Documento Completo"}
              </Button>
            </div>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Alterações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
