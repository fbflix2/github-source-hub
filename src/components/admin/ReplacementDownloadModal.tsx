import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, RefreshCw, Loader2, Search, Package } from "lucide-react";
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

interface OrderItemOption {
  id: string;
  name: string;
  price: number;
  order_id: string;
  order_code: string;
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

  // Order linking
  const [orderSearch, setOrderSearch] = useState("");
  const [searchingOrder, setSearchingOrder] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItemOption[]>([]);
  const [selectedOrderItem, setSelectedOrderItem] = useState<OrderItemOption | null>(null);

  useEffect(() => {
    if (!open) {
      setIsReplacement(null);
      setClientSearch("");
      setClients([]);
      setSelectedClient(null);
      setReason("");
      setItemValue("");
      setNotes("");
      setOrderSearch("");
      setOrderItems([]);
      setSelectedOrderItem(null);
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

  const searchOrder = async () => {
    if (!orderSearch.trim()) return;
    setSearchingOrder(true);
    setOrderItems([]);
    setSelectedOrderItem(null);

    // Search by order code or id
    const query = orderSearch.trim();
    const { data: orders } = await supabase
      .from("orders")
      .select("id, code")
      .or(`code.ilike.%${query}%,id.eq.${query.length === 36 ? query : '00000000-0000-0000-0000-000000000000'}`)
      .limit(5);

    if (!orders || orders.length === 0) {
      toast.error("Pedido não encontrado");
      setSearchingOrder(false);
      return;
    }

    const orderIds = orders.map(o => o.id);
    const { data: items } = await supabase
      .from("order_items")
      .select("id, name, price, order_id")
      .in("order_id", orderIds);

    const mapped: OrderItemOption[] = (items || []).map(oi => {
      const order = orders.find(o => o.id === oi.order_id);
      return {
        id: oi.id,
        name: oi.name,
        price: Number(oi.price),
        order_id: oi.order_id,
        order_code: order?.code || "",
      };
    });

    setOrderItems(mapped);
    setSearchingOrder(false);
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

    const insertData: Record<string, unknown> = {
      stock_item_id: item.id,
      new_stock_item_id: item.id,
      product_name: productName,
      item_name: item.name,
      client_user_id: selectedClient.user_id,
      client_name: selectedClient.full_name,
      reason,
      item_value: parseFloat(itemValue) || 0,
      notes: notes || null,
      created_by: user!.id,
    };

    if (selectedOrderItem) {
      insertData.order_id = selectedOrderItem.order_id;
      insertData.order_item_id = selectedOrderItem.id;
    }

    const { error } = await supabase.from("replacements").insert(insertData as any);

    if (error) {
      toast.error("Erro ao salvar reposição");
      console.error(error);
      setSaving(false);
      return;
    }

    // Mark new stock item as sold (leaving stock for replacement)
    await supabase
      .from("stock_items")
      .update({ status: "vendido", updated_at: new Date().toISOString() })
      .eq("id", item.id);

    toast.success("Reposição registrada e item marcado como vendido");
    onDownload();
    onOpenChange(false);
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-zinc-900 border-zinc-800 text-white max-h-[90vh] overflow-y-auto">
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

            {/* Order search */}
            <div className="space-y-2">
              <Label className="text-zinc-400 flex items-center gap-1">
                <Package className="h-3.5 w-3.5" />
                Pedido com problema (opcional)
              </Label>
              {selectedOrderItem ? (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800 border border-yellow-600/40">
                  <div className="flex-1">
                    <p className="text-xs text-yellow-400">Pedido #{selectedOrderItem.order_code}</p>
                    <p className="text-sm text-white">{selectedOrderItem.name}</p>
                    <p className="text-xs text-zinc-400">R$ {selectedOrderItem.price.toFixed(2)}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-zinc-400" onClick={() => setSelectedOrderItem(null)}>✕</Button>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Código do pedido..."
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && searchOrder()}
                      className="bg-zinc-800 border-zinc-700 flex-1"
                    />
                    <Button size="sm" variant="outline" className="border-zinc-700 px-2" onClick={searchOrder} disabled={searchingOrder}>
                      {searchingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                  {orderItems.length > 0 && (
                    <div className="max-h-36 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-800">
                      {orderItems.map((oi) => (
                        <button
                          key={oi.id}
                          className="w-full text-left px-3 py-2 hover:bg-zinc-700 transition-colors border-b border-zinc-700/50 last:border-0"
                          onClick={() => { setSelectedOrderItem(oi); setOrderItems([]); setOrderSearch(""); }}
                        >
                          <p className="text-xs text-yellow-400">#{oi.order_code}</p>
                          <p className="text-sm text-zinc-300">{oi.name}</p>
                          <p className="text-xs text-zinc-500">R$ {oi.price.toFixed(2)}</p>
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
