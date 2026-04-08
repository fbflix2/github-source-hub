import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, RefreshCw, Loader2, Search, Package, ArrowRightLeft } from "lucide-react";
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
  product_id: string | null;
}

interface StockItemOption {
  id: string;
  name: string;
  identification: string | null;
  product_id: string | null;
  product_name?: string;
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

  // New stock item for replacement
  const [stockFilter, setStockFilter] = useState("");
  const [loadingStock, setLoadingStock] = useState(false);
  const [allStockItems, setAllStockItems] = useState<StockItemOption[]>([]);
  const [selectedNewItem, setSelectedNewItem] = useState<StockItemOption | null>(null);

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
      setStockFilter("");
      setAllStockItems([]);
      setSelectedNewItem(null);
    }
  }, [open]);

  // Load available stock items (non-proxy) when replacement mode is activated
  useEffect(() => {
    if (isReplacement !== "yes") return;
    loadStockItems();
  }, [isReplacement]);

  const loadStockItems = async () => {
    setLoadingStock(true);

    // Get products that are proxy type to exclude them
    const { data: proxyProducts } = await supabase
      .from("products")
      .select("id")
      .eq("icon_type", "proxy");
    const proxyProductIds = new Set((proxyProducts || []).map(p => p.id));

    const { data } = await supabase
      .from("stock_items")
      .select("id, name, identification, product_id, type")
      .eq("status", "revisado")
      .is("order_item_id", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);

    if (data && data.length > 0) {
      // Filter out proxy items
      const nonProxy = data.filter(si => !si.product_id || !proxyProductIds.has(si.product_id));

      const productIds = [...new Set(nonProxy.filter(i => i.product_id).map(i => i.product_id!))];
      let productMap = new Map<string, string>();
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from("products")
          .select("id, name")
          .in("id", productIds);
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

  const handleSaveReplacement = async () => {
    if (!selectedClient) { toast.error("Selecione o cliente"); return; }
    if (!selectedOrderItem) { toast.error("Selecione o item do pedido para vincular a reposição"); return; }
    if (!reason) { toast.error("Informe o motivo"); return; }
    if (!selectedNewItem) { toast.error("Selecione o item de reposição"); return; }
    if (selectedNewItem.id === item.id) { toast.error("Selecione um item diferente do original para a reposição"); return; }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    const insertData: Record<string, unknown> = {
      stock_item_id: item.id,
      new_stock_item_id: selectedNewItem.id,
      product_name: productName,
      item_name: item.name,
      client_user_id: selectedClient.user_id,
      client_name: selectedClient.full_name,
      reason,
      item_value: parseFloat(itemValue) || 0,
      notes: notes || null,
      created_by: user!.id,
      order_id: selectedOrderItem.order_id,
      order_item_id: selectedOrderItem.id,
    };

    const { error } = await supabase.from("replacements").insert(insertData as any);

    if (error) {
      toast.error("Erro ao salvar reposição");
      console.error(error);
      setSaving(false);
      return;
    }

    const now = new Date().toISOString();

    const [{ data: currentOrderItem }, { data: newStockFull }, { data: productInfo }] = await Promise.all([
      supabase
        .from("order_items")
        .select("delivery_data, product_id")
        .eq("id", selectedOrderItem.id)
        .maybeSingle(),
      supabase
        .from("stock_items")
        .select("id, name, data, identification, identification_link, type")
        .eq("id", selectedNewItem.id)
        .single(),
      selectedOrderItem.product_id
        ? supabase.from("products").select("icon_type").eq("id", selectedOrderItem.product_id).maybeSingle().then(r => r.data)
        : Promise.resolve(null),
    ]);

    // Mark the NEW stock item as sold and link to the order_item
    await supabase
      .from("stock_items")
      .update({
        status: "vendido",
        order_item_id: selectedOrderItem.id,
        updated_at: now,
      })
      .eq("id", selectedNewItem.id);

    // Unlink the ORIGINAL stock item so the old credentials stop being resolved in the client view
    await supabase
      .from("stock_items")
      .update({
        order_item_id: null,
        updated_at: now,
      })
      .eq("id", item.id);

    // Update the order_item's delivery_data so the client sees the new item, preserving operational flags
    if (newStockFull) {
      const currentDeliveryData =
        currentOrderItem?.delivery_data && typeof currentOrderItem.delivery_data === "object"
          ? { ...(currentOrderItem.delivery_data as Record<string, unknown>) }
          : {};
      const d = (newStockFull.data as Record<string, unknown>) || {};
      const isBmProduct = newStockFull.type === "bm" || productInfo?.icon_type === "bm";
      const deliveryData: Record<string, unknown> = {
        ...currentDeliveryData,
        ...d,
        ...(newStockFull.identification ? { idPerfil: newStockFull.identification } : {}),
        ...(newStockFull.identification_link ? { linkPerfil: newStockFull.identification_link } : {}),
        ...(isBmProduct && newStockFull.identification_link ? { bmLinks: [newStockFull.identification_link] } : {}),
        _replaced: true,
        _replaced_at: now,
        _replacement_stock_item_id: newStockFull.id,
        _replacement_old_stock_item_id: item.id,
      };

      await supabase
        .from("order_items")
        .update({ delivery_data: deliveryData as any })
        .eq("id", selectedOrderItem.id);
    }

    toast.success("Reposição registrada! Novo item marcado como vendido.");
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

            {/* New stock item selector */}
            <div className="space-y-2">
              <Label className="text-zinc-400 flex items-center gap-1">
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Item de reposição (novo item do estoque)
              </Label>
              {selectedNewItem ? (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800 border border-green-600/40">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-white">{selectedNewItem.name}</p>
                      <Badge className="bg-green-500/20 text-green-400 text-[10px]">NOVO</Badge>
                    </div>
                    {selectedNewItem.identification && (
                      <p className="text-xs text-zinc-400 font-mono">{selectedNewItem.identification}</p>
                    )}
                    {selectedNewItem.product_name && (
                      <p className="text-xs text-zinc-500">Produto: {selectedNewItem.product_name}</p>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-zinc-400" onClick={() => setSelectedNewItem(null)}>✕</Button>
                </div>
              ) : (
                <div className="space-y-1">
                  <Input
                    placeholder="Filtrar por nome, ID ou produto..."
                    value={stockFilter}
                    onChange={(e) => setStockFilter(e.target.value)}
                    className="bg-zinc-800 border-zinc-700"
                  />
                  {loadingStock ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                      <span className="text-xs text-zinc-500 ml-2">Carregando itens...</span>
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-800">
                      {(() => {
                        const filtered = allStockItems.filter(si =>
                          !stockFilter || si.name.toLowerCase().includes(stockFilter.toLowerCase()) ||
                          (si.identification || "").toLowerCase().includes(stockFilter.toLowerCase()) ||
                          (si.product_name || "").toLowerCase().includes(stockFilter.toLowerCase())
                        );
                        if (filtered.length === 0) {
                          return <p className="text-xs text-zinc-500 p-3 text-center">Nenhum item disponível</p>;
                        }
                        return filtered.slice(0, 30).map((si) => (
                          <button
                            key={si.id}
                            className="w-full text-left px-3 py-2 hover:bg-zinc-700 transition-colors border-b border-zinc-700/50 last:border-0"
                            onClick={() => setSelectedNewItem(si)}
                          >
                            <p className="text-sm text-zinc-300">{si.name}</p>
                            <div className="flex items-center gap-2">
                              {si.identification && <p className="text-xs text-zinc-500 font-mono">{si.identification}</p>}
                              {si.product_name && <p className="text-xs text-zinc-500">• {si.product_name}</p>}
                            </div>
                          </button>
                        ));
                      })()}
                    </div>
                  )}
                  <p className="text-[10px] text-zinc-600">{allStockItems.length} itens disponíveis (excluindo proxy)</p>
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
                className="flex-1 gap-2 bg-yellow-600 hover:bg-yellow-700 text-white"
                onClick={handleSaveReplacement}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                Fazer Reposição
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
