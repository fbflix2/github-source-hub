import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Recycle, Eye, RotateCcw, Trash2, FileText, Copy, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BlockedItem {
  id: string;
  name: string;
  identification: string | null;
  identification_link: string | null;
  data: Record<string, any> | null;
  status: string;
  created_at: string;
  updated_at: string;
  product_id: string | null;
  order_item_id: string | null;
  folder: string | null;
  type: string;
  // Enriched
  productName?: string;
  clientName?: string;
  orderCode?: string;
  blockedAt?: string;
  hasReplacement?: boolean;
}

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function AdminReciclagem() {
  const [items, setItems] = useState<BlockedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<BlockedItem | null>(null);
  const [blocoContent, setBlocoContent] = useState("");

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    setLoading(true);

    const { data: stockItems, error } = await supabase
      .from("stock_items")
      .select("*")
      .eq("status", "bloqueado")
      .order("updated_at", { ascending: false });

    if (error || !stockItems) {
      toast.error("Erro ao carregar itens bloqueados");
      setLoading(false);
      return;
    }

    // Enrich with product names, client names, order codes, replacement status
    const productIds = [...new Set(stockItems.filter(i => i.product_id).map(i => i.product_id!))];
    const orderItemIds = [...new Set(stockItems.filter(i => i.order_item_id).map(i => i.order_item_id!))];
    const stockItemIds = stockItems.map(i => i.id);

    const [productsRes, orderItemsRes, replacementsRes] = await Promise.all([
      productIds.length > 0
        ? supabase.from("products").select("id, name").in("id", productIds)
        : Promise.resolve({ data: [] }),
      orderItemIds.length > 0
        ? supabase.from("order_items").select("id, order_id").in("id", orderItemIds)
        : Promise.resolve({ data: [] }),
      stockItemIds.length > 0
        ? supabase.from("replacements").select("stock_item_id").in("stock_item_id", stockItemIds)
        : Promise.resolve({ data: [] }),
    ]);

    const replacedStockIds = new Set((replacementsRes.data || []).map(r => r.stock_item_id));

    const productMap = new Map((productsRes.data || []).map(p => [p.id, p.name]));

    // Get order codes and user ids
    const orderIds = [...new Set((orderItemsRes.data || []).filter(oi => oi.order_id).map(oi => oi.order_id))];
    const { data: orders } = orderIds.length > 0
      ? await supabase.from("orders").select("id, code, user_id").in("id", orderIds)
      : { data: [] };

    const orderMap = new Map((orders || []).map(o => [o.id, o]));
    const orderItemToOrder = new Map((orderItemsRes.data || []).map(oi => [oi.id, orderMap.get(oi.order_id)]));

    // Get client names
    const userIds = [...new Set((orders || []).filter(o => o.user_id).map(o => o.user_id))];
    const { data: profiles } = userIds.length > 0
      ? await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
      : { data: [] };
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

    const enriched: BlockedItem[] = stockItems.map(item => {
      const order = item.order_item_id ? orderItemToOrder.get(item.order_item_id) : null;
      return {
        ...item,
        data: item.data as Record<string, any> | null,
        productName: item.product_id ? productMap.get(item.product_id) || "—" : "—",
        clientName: order ? profileMap.get(order.user_id) || "—" : "—",
        orderCode: order ? order.code : "—",
        blockedAt: item.updated_at,
        hasReplacement: replacedStockIds.has(item.id),
      };
    });

    setItems(enriched);
    setLoading(false);
  }

  const handleViewDetails = async (item: BlockedItem) => {
    setSelectedItem(item);

    // Fetch block template and generate content
    const { data: tpl } = await supabase
      .from("block_templates")
      .select("content")
      .eq("is_default", true)
      .maybeSingle();

    if (tpl?.content && item.data) {
      const d = item.data;
      const replacements: Record<string, string> = {
        "{{nomePerfil}}": d.nomePerfil || "—",
        "{{emailAcesso}}": d.emailAcesso || "—",
        "{{emailAlternativo}}": d.emailAlternativo || "—",
        "{{senha}}": d.senha || "—",
        "{{senhaEmail}}": d.senhaEmail || "—",
        "{{token2fa}}": d.token2fa || "—",
        "{{dataNascimento}}": d.dataNascimento || "—",
        "{{genero}}": d.genero || "—",
        "{{tempoPlataforma}}": d.tempoPlataforma || "—",
        "{{statusAtual}}": d.statusAtual || "—",
        "{{descricao}}": d.descricao || "—",
        "{{cookies}}": d.cookies || "—",
        "{{linkDocumento}}": d.linkDocumento || "—",
        "{{linkPerfil}}": item.identification_link || d.linkPerfil || "—",
        "{{idPerfil}}": item.identification || d.idPerfil || "—",
        "{{pedido}}": "—",
        "{{data}}": "—",
        "{{nomeProduto}}": "—",
      };
      let content = tpl.content;
      for (const [key, val] of Object.entries(replacements)) {
        content = content.split(key).join(val);
      }
      setBlocoContent(content);
    } else {
      setBlocoContent("Template padrão não encontrado ou item sem dados.");
    }
  };

  const handleRecycle = async (item: BlockedItem) => {
    // Reset item: unlink from order, set status back to 'revisado' so it can be resold
    const { error } = await supabase
      .from("stock_items")
      .update({ status: "revisado", order_item_id: null })
      .eq("id", item.id);

    if (error) {
      toast.error("Erro ao reciclar item");
      return;
    }

    // Increment product stock if linked
    if (item.product_id) {
      const { data: product } = await supabase
        .from("products")
        .select("stock")
        .eq("id", item.product_id)
        .maybeSingle();

      if (product) {
        await supabase
          .from("products")
          .update({ stock: product.stock + 1, available: true })
          .eq("id", item.product_id);
      }
    }

    toast.success("Item reciclado! Voltou ao estoque para revenda.");
    setSelectedItem(null);
    fetchItems();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("stock_items").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir item");
      return;
    }
    toast.success("Item excluído permanentemente");
    setSelectedItem(null);
    fetchItems();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.clientName?.toLowerCase().includes(search.toLowerCase()) ||
    i.orderCode?.toLowerCase().includes(search.toLowerCase()) ||
    i.identification?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <Recycle className="size-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Reciclagem</h1>
            <p className="text-sm text-muted-foreground">Perfis marcados como bloqueados pelos clientes — reaproveitáveis</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, cliente, pedido..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-card border border-border">
          <p className="text-xs text-muted-foreground">Total Bloqueados</p>
          <p className="text-2xl font-bold text-foreground">{items.length}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <p className="text-xs text-muted-foreground">Com Produto Vinculado</p>
          <p className="text-2xl font-bold text-foreground">{items.filter(i => i.product_id).length}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <p className="text-xs text-muted-foreground">Sem Produto</p>
          <p className="text-2xl font-bold text-foreground">{items.filter(i => !i.product_id).length}</p>
        </div>
      </div>

      {/* Items List */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Recycle className="size-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum item bloqueado para reciclagem</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 rounded-xl bg-card border border-border hover:border-amber-500/30 transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className="flex items-center justify-center size-10 rounded-lg bg-destructive/10 shrink-0">
                  <span className="material-symbols-outlined text-destructive text-[20px]">block</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                    {item.hasReplacement && (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">REPOSTO</Badge>
                    )}
                    {item.identification && (
                      <Badge variant="outline" className="text-[10px] font-mono">{item.identification}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                    <span>Cliente: {item.clientName}</span>
                    <span>•</span>
                    <span>Pedido: {item.orderCode}</span>
                    <span>•</span>
                    <span>Bloqueado: {formatDate(item.blockedAt || item.updated_at)}</span>
                  </div>
                  {item.productName !== "—" && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Produto: {item.productName}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 ml-4">
                <Button variant="ghost" size="sm" onClick={() => handleViewDetails(item)} title="Ver detalhes">
                  <Eye className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRecycle(item)}
                  className="text-amber-500 hover:text-amber-400"
                  title="Reciclar (devolver ao estoque)"
                >
                  <RotateCcw className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(item.id)}
                  className="text-destructive hover:text-destructive"
                  title="Excluir permanentemente"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Recycle className="size-5 text-amber-500" />
              {selectedItem?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4 mt-2">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Cliente</p>
                  <p className="font-medium text-foreground">{selectedItem.clientName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Pedido</p>
                  <p className="font-medium text-foreground">{selectedItem.orderCode}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Produto</p>
                  <p className="font-medium text-foreground">{selectedItem.productName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Bloqueado em</p>
                  <p className="font-medium text-foreground">{formatDate(selectedItem.blockedAt || selectedItem.updated_at)}</p>
                </div>
                {selectedItem.identification && (
                  <div>
                    <p className="text-muted-foreground text-xs">ID do Perfil</p>
                    <p className="font-medium text-foreground font-mono">{selectedItem.identification}</p>
                  </div>
                )}
                {selectedItem.identification_link && (
                  <div>
                    <p className="text-muted-foreground text-xs">Link do Perfil</p>
                    <a href={selectedItem.identification_link} target="_blank" rel="noopener noreferrer" className="text-primary text-sm hover:underline truncate block">
                      {selectedItem.identification_link}
                    </a>
                  </div>
                )}
              </div>

              {/* Raw Data */}
              {selectedItem.data && Object.keys(selectedItem.data).length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Dados do Item</h4>
                  <div className="space-y-1.5">
                    {Object.entries(selectedItem.data).map(([key, val]) => {
                      if (!val || key === "foto_url") return null;
                      const strVal = typeof val === "string" ? val : JSON.stringify(val);
                      return (
                        <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border text-xs group">
                          <div className="min-w-0 flex-1">
                            <span className="text-muted-foreground">{key}:</span>{" "}
                            <span className="text-foreground font-mono break-all">{strVal.substring(0, 200)}</span>
                          </div>
                          <button onClick={() => copyToClipboard(strVal)} className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                            <Copy className="size-3 text-muted-foreground" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Block Template Content */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="size-3.5" />
                    Bloco de Notas
                  </h4>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(blocoContent)} className="text-xs h-7">
                    <Copy className="size-3 mr-1" /> Copiar
                  </Button>
                </div>
                <pre className="whitespace-pre-wrap text-xs font-mono text-foreground bg-muted/30 border border-border rounded-lg p-4 max-h-60 overflow-y-auto">
                  {blocoContent}
                </pre>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-border">
                <Button
                  onClick={() => handleRecycle(selectedItem)}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white gap-2"
                >
                  <RotateCcw className="size-4" />
                  Reciclar — Devolver ao Estoque
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(selectedItem.id)}
                  className="gap-2"
                >
                  <Trash2 className="size-4" />
                  Excluir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
