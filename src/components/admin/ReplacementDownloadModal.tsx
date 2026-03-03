import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ReplacementDownloadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    id: string;
    name: string;
    data: Record<string, unknown> | null;
    identification: string | null;
    identification_link: string | null;
  };
  productName: string;
  onDownload: () => void;
}

export function ReplacementDownloadModal({
  open,
  onOpenChange,
  item,
  productName,
  onDownload,
}: ReplacementDownloadModalProps) {
  const [isReplacement, setIsReplacement] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [clients, setClients] = useState<{ user_id: string; full_name: string }[]>([]);
  const [selectedClient, setSelectedClient] = useState<{ user_id: string; full_name: string } | null>(null);
  const [reason, setReason] = useState("");
  const [itemValue, setItemValue] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsReplacement(null);
      setClientSearch("");
      setClients([]);
      setSelectedClient(null);
      setReason("");
      setItemValue("");
      setNotes("");
    }
  }, [open]);

  const searchClients = async (query: string) => {
    setClientSearch(query);
    if (query.length < 2) { setClients([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .ilike("full_name", `%${query}%`)
      .limit(10);
    setClients((data as any[]) ?? []);
    setSearching(false);
  };

  const handleDownloadOnly = () => {
    onDownload();
    onOpenChange(false);
  };

  const handleSaveAndDownload = async () => {
    if (!selectedClient) { toast.error("Selecione o cliente"); return; }
    if (!reason) { toast.error("Informe o motivo"); return; }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("replacements").insert({
      stock_item_id: item.id,
      product_name: productName,
      item_name: item.name,
      client_user_id: selectedClient.user_id,
      client_name: selectedClient.full_name,
      reason,
      item_value: parseFloat(itemValue) || 0,
      notes: notes || null,
      created_by: user!.id,
    } as any);

    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar reposição");
      console.error(error);
      return;
    }

    toast.success("Reposição registrada com sucesso");
    onDownload();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-zinc-900 border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Baixar TXT — {item.name}
          </DialogTitle>
        </DialogHeader>

        {isReplacement === null ? (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              Este download é para uma <strong className="text-white">reposição</strong> de item (cliente com perfil bloqueado em garantia)?
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-zinc-700 hover:bg-zinc-800 gap-2"
                onClick={() => setIsReplacement("yes")}
              >
                <RefreshCw className="h-4 w-4 text-yellow-400" />
                Sim, é reposição
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-zinc-700 hover:bg-zinc-800 gap-2"
                onClick={handleDownloadOnly}
              >
                <Download className="h-4 w-4 text-primary" />
                Não, apenas baixar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Client search */}
            <div className="space-y-2">
              <Label className="text-zinc-400">Cliente</Label>
              {selectedClient ? (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800 border border-zinc-700">
                  <span className="text-sm text-white flex-1">{selectedClient.full_name}</span>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-zinc-400" onClick={() => setSelectedClient(null)}>✕</Button>
                </div>
              ) : (
                <div className="space-y-1">
                  <Input
                    placeholder="Buscar cliente por nome..."
                    value={clientSearch}
                    onChange={(e) => searchClients(e.target.value)}
                    className="bg-zinc-800 border-zinc-700"
                  />
                  {searching && <p className="text-xs text-zinc-500">Buscando...</p>}
                  {clients.length > 0 && (
                    <div className="max-h-32 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-800">
                      {clients.map((c) => (
                        <button
                          key={c.user_id}
                          className="w-full text-left px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
                          onClick={() => { setSelectedClient(c); setClients([]); setClientSearch(""); }}
                        >
                          {c.full_name || "Sem nome"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label className="text-zinc-400">Motivo da reposição</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="bloqueado_garantia">Perfil bloqueado em garantia</SelectItem>
                  <SelectItem value="defeito">Item com defeito</SelectItem>
                  <SelectItem value="erro_entrega">Erro na entrega</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Value */}
            <div className="space-y-2">
              <Label className="text-zinc-400">Valor do item (R$)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={itemValue}
                onChange={(e) => setItemValue(e.target.value)}
                className="bg-zinc-800 border-zinc-700"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-zinc-400">Observações (opcional)</Label>
              <Textarea
                placeholder="Detalhes adicionais..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-zinc-800 border-zinc-700 min-h-[60px]"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 border-zinc-700" onClick={() => setIsReplacement(null)}>
                Voltar
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleSaveAndDownload}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Registrar e Baixar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
