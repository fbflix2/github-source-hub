import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Loader2, Search, Package, ArrowRightLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NewReplacementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface OrderItemOption {
  id: string;
  name: string;
  price: number;
  order_id: string;
  order_code: string;
  product_name?: string;
}

interface StockItemOption {
  id: string;
  name: string;
  identification: string | null;
  product_id: string | null;
  product_name?: string;
}

export function NewReplacementModal({ open, onOpenChange, onCreated }: NewReplacementModalProps) {
  const [clientSearch, setClientSearch] = useState("");
  const [clients, setClients] = useState<{ user_id: string; full_name: string }[]>([]);
  const [selectedClient, setSelectedClient] = useState<{ user_id: string; full_name: string } | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);

  // Order linking
  const [orderSearch, setOrderSearch] = useState("");
  const [searchingOrder, setSearchingOrder] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItemOption[]>([]);
  const [selectedOrderItem, setSelectedOrderItem] = useState<OrderItemOption | null>(null);

  // Original problematic item (optional — can type product name manually)
  const [productName, setProductName] = useState("");
  const [itemName, setItemName] = useState("");
  const [originalStockId, setOriginalStockId] = useState<string | null>(null);

  // New stock item for replacement
  const [stockFilter, setStockFilter] = useState("");
  const [loadingStock, setLoadingStock] = useState(false);
  const [allStockItems, setAllStockItems] = useState<StockItemOption[]>([]);
  const [selectedNewItem, setSelectedNewItem] = useState<StockItemOption | null>(null);

  useEffect(() => {
    if (!open) {
      setClientSearch(""); setClients([]); setSelectedClient(null);
      setReason(""); setNotes("");
      setOrderSearch(""); setOrderItems([]); setSelectedOrderItem(null);
      setProductName(""); setItemName(""); setOriginalStockId(null);
      setStockFilter(""); setAllStockItems([]); setSelectedNewItem(null);
    } else {
      loadStockItems();
    }
  }, [open]);

  const loadStockItems = async () => {
    setLoadingStock(true);
    const { data: proxyProducts } = await supabase
      .from("products").select("id").eq("icon_type", "proxy");
    const proxyIds = new Set((proxyProducts || []).map(p => p.id));

    const { data } = await supabase
      .from("stock_items")
      .select("id, name, identification, product_id, type")
      .eq("status", "revisado")
      .is("order_item_id", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);

    if (data) {
      const nonProxy = data.filter(si => !si.product_id || !proxyIds.has(si.product_id));
      const productIds = [...new Set(nonProxy.filter(i => i.product_id).map(i => i.product_id!))];
      let productMap = new Map<string, string>();
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from("products").select("id, name").in("id", productIds);
        productMap = new Map((products || []).map(p => [p.id, p.name]));
      }
      setAllStockItems(nonProxy.map(si => ({
        ...si,
        product_name: si.product_id ? productMap.get(si.product_id) || undefined : undefined,
      })));
    }
    setLoadingStock(false);
  };

  const searchClients = async (query: string) => {
    setClientSearch(query);
    if (query.length < 2) { setClients([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from("profiles").select("user_id, full_name")
      .ilike("full_name", `%${query}%`).limit(10);
    setClients((data as any[]) ?? []);
    setSearching(false);
  };

  const searchOrder = async () => {
    if (!orderSearch.trim()) return;
    setSearchingOrder(true);
    setOrderItems([]); setSelectedOrderItem(null);
    const query = orderSearch.trim();
    const { data: orders } = await supabase
      .from("orders").select("id, code")
      .or(`code.ilike.%${query}%,id.eq.${query.length === 36 ? query : '00000000-0000-0000-0000-000000000000'}`)
      .limit(5);
    if (!orders?.length) { toast.error("Pedido não encontrado"); setSearchingOrder(false); return; }

    const { data: items } = await supabase
      .from("order_items").select("id, name, price, order_id, product_id")
      .in("order_id", orders.map(o => o.id));

    setOrderItems((items || []).map(oi => {
      const order = orders.find(o => o.id === oi.order_id);
      return { id: oi.id, name: oi.name, price: Number(oi.price), order_id: oi.order_id, order_code: order?.code || "" };
    }));
    setSearchingOrder(false);
  };

  // When order item is selected, auto-fill product/item name
  useEffect(() => {
    if (selectedOrderItem) {
      setProductName(selectedOrderItem.name);
      setItemName(selectedOrderItem.name);
    }
  }, [selectedOrderItem]);

  const handleSave = async () => {
    if (!selectedClient) { toast.error("Selecione o cliente"); return; }
    if (!reason) { toast.error("Informe o motivo"); return; }
    if (!selectedNewItem) { toast.error("Selecione o item de reposição"); return; }
    if (!productName.trim()) { toast.error("Informe o nome do produto"); return; }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    const insertData: Record<string, unknown> = {
      product_name: productName.trim(),
      item_name: itemName.trim() || selectedNewItem.name,
      client_user_id: selectedClient.user_id,
      client_name: selectedClient.full_name,
      reason,
      item_value: 0,
      notes: notes || null,
      created_by: user!.id,
      new_stock_item_id: selectedNewItem.id,
      stock_item_id: originalStockId,
    };

    if (selectedOrderItem) {
      insertData.order_id = selectedOrderItem.order_id;
      insertData.order_item_id = selectedOrderItem.id;
    }

    const { error } = await supabase.from("replacements").insert(insertData as any);
    if (error) { toast.error("Erro ao salvar reposição"); console.error(error); setSaving(false); return; }

    // Fetch new item data
    const { data: newStockFull } = await supabase
      .from("stock_items")
      .select("id, name, data, identification, identification_link")
      .eq("id", selectedNewItem.id).single();

    // Mark new item as sold
    await supabase.from("stock_items").update({
      status: "vendido",
      order_item_id: selectedOrderItem?.id || null,
      updated_at: new Date().toISOString(),
    }).eq("id", selectedNewItem.id);

    // Update delivery_data if order item linked
    if (selectedOrderItem && newStockFull) {
      const d = (newStockFull.data as Record<string, unknown>) || {};
      const deliveryData: Record<string, unknown> = {
        ...d,
        ...(newStockFull.identification ? { idPerfil: newStockFull.identification } : {}),
        ...(newStockFull.identification_link ? { linkPerfil: newStockFull.identification_link } : {}),
        _replaced: true,
        _replaced_at: new Date().toISOString(),
      };
      await supabase.from("order_items").update({ delivery_data: deliveryData as any }).eq("id", selectedOrderItem.id);
    }

    toast.success("Reposição registrada com sucesso!");
    onOpenChange(false);
    onCreated();
    setSaving(false);
  };

  const filteredStock = allStockItems.filter(si =>
    !stockFilter || si.name.toLowerCase().includes(stockFilter.toLowerCase()) ||
    (si.identification || "").toLowerCase().includes(stockFilter.toLowerCase()) ||
    (si.product_name || "").toLowerCase().includes(stockFilter.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-zinc-900 border-zinc-800 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-yellow-400" />
            Nova Reposição
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client */}
          <div className="space-y-2">
            <Label className="text-zinc-400">Cliente *</Label>
            {selectedClient ? (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800 border border-zinc-700">
                <span className="text-sm text-white flex-1">{selectedClient.full_name}</span>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-zinc-400" onClick={() => setSelectedClient(null)}>✕</Button>
              </div>
            ) : (
              <div className="space-y-1">
                <Input placeholder="Buscar cliente por nome..." value={clientSearch} onChange={(e) => searchClients(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                {searching && <p className="text-xs text-zinc-500">Buscando...</p>}
                {clients.length > 0 && (
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-800">
                    {clients.map((c) => (
                      <button key={c.user_id} className="w-full text-left px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
                        onClick={() => { setSelectedClient(c); setClients([]); setClientSearch(""); }}>
                        {c.full_name || "Sem nome"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Order */}
          <div className="space-y-2">
            <Label className="text-zinc-400 flex items-center gap-1">
              <Package className="h-3.5 w-3.5" /> Pedido (opcional)
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
                  <Input placeholder="Código do pedido..." value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchOrder()} className="bg-zinc-800 border-zinc-700 flex-1" />
                  <Button size="sm" variant="outline" className="border-zinc-700 px-2" onClick={searchOrder} disabled={searchingOrder}>
                    {searchingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
                {orderItems.length > 0 && (
                  <div className="max-h-36 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-800">
                    {orderItems.map((oi) => (
                      <button key={oi.id} className="w-full text-left px-3 py-2 hover:bg-zinc-700 transition-colors border-b border-zinc-700/50 last:border-0"
                        onClick={() => { setSelectedOrderItem(oi); setOrderItems([]); setOrderSearch(""); }}>
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

          {/* Product & Item name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-zinc-400 text-xs">Nome do Produto *</Label>
              <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Ex: Perfil Facebook" className="bg-zinc-800 border-zinc-700" />
            </div>
            <div className="space-y-1">
              <Label className="text-zinc-400 text-xs">Nome do Item</Label>
              <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Ex: perfil_123" className="bg-zinc-800 border-zinc-700" />
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1">
            <Label className="text-zinc-400 text-xs">Motivo *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="bg-zinc-800 border-zinc-700"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="bloqueado_garantia">Bloqueado em Garantia</SelectItem>
                <SelectItem value="defeito">Item com Defeito</SelectItem>
                <SelectItem value="erro_entrega">Erro na Entrega</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* New stock item */}
          <div className="space-y-2">
            <Label className="text-zinc-400 flex items-center gap-1">
              <ArrowRightLeft className="h-3.5 w-3.5" /> Item de Reposição (novo) *
            </Label>
            {selectedNewItem ? (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800 border border-green-600/40">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-white">{selectedNewItem.name}</p>
                    <Badge className="bg-green-500/20 text-green-400 text-[10px]">NOVO</Badge>
                  </div>
                  {selectedNewItem.identification && <p className="text-xs text-zinc-400 font-mono">{selectedNewItem.identification}</p>}
                  {selectedNewItem.product_name && <p className="text-xs text-zinc-500">Produto: {selectedNewItem.product_name}</p>}
                </div>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-zinc-400" onClick={() => setSelectedNewItem(null)}>✕</Button>
              </div>
            ) : (
              <div className="space-y-1">
                <Input placeholder="Filtrar por nome, ID ou produto..." value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} className="bg-zinc-800 border-zinc-700" />
                {loadingStock ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                    <span className="text-xs text-zinc-500 ml-2">Carregando itens...</span>
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-800">
                    {filteredStock.length === 0 ? (
                      <p className="text-xs text-zinc-500 p-3 text-center">Nenhum item disponível</p>
                    ) : filteredStock.slice(0, 30).map((si) => (
                      <button key={si.id} className="w-full text-left px-3 py-2 hover:bg-zinc-700 transition-colors border-b border-zinc-700/50 last:border-0"
                        onClick={() => setSelectedNewItem(si)}>
                        <p className="text-sm text-zinc-300">{si.name}</p>
                        <div className="flex items-center gap-2">
                          {si.identification && <span className="text-[10px] text-zinc-500 font-mono">{si.identification}</span>}
                          {si.product_name && <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">{si.product_name}</Badge>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label className="text-zinc-400 text-xs">Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anotações adicionais..." className="bg-zinc-800 border-zinc-700 min-h-[60px]" />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 border-zinc-700" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black gap-2" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Registrar Reposição
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
