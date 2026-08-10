import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Recycle, Eye, RotateCcw, Trash2, FileText, Copy, Search, Download, KeyRound, Mail, Hash, Shield, Link as LinkIcon, Cookie, ClipboardList, Pencil, Save, X, StickyNote, ShoppingCart, Loader2, User as UserIcon, ExternalLink } from "lucide-react";
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
  productPrice?: number;
  replacementReason?: string | null;
  replacementNotes?: string | null;
  // BMs do mesmo pedido (fallback quando data.bmNames não foi preenchido)
  derivedBms?: { name: string; link?: string | null; matriz?: string | null }[];
  derivedMatriz?: string | null;
}

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

type LinkedBm = { name: string; link?: string | null; matriz?: string | null };

const cleanText = (value: unknown) => String(value ?? "").trim();

const parseLinkedBms = (data: any): LinkedBm[] => {
  const names = Array.isArray(data?.bmNames)
    ? data.bmNames
    : cleanText(data?.bmNames)
      ? [data.bmNames]
      : [];
  const links = Array.isArray(data?.bmLinks)
    ? data.bmLinks
    : cleanText(data?.bmLinks)
      ? [data.bmLinks]
      : [];
  const matriz = cleanText(data?.perfilMatriz || data?.perfilBackup) || null;
  const size = Math.max(names.length, links.length);
  return Array.from({ length: size }, (_, i) => ({
    name: cleanText(names[i]) || cleanText(links[i]) || "BM",
    link: cleanText(links[i]) || null,
    matriz,
  })).filter((bm) => bm.name !== "BM" || bm.link);
};

const mergeLinkedBms = (...groups: LinkedBm[][]): LinkedBm[] => {
  const seen = new Set<string>();
  return groups.flat().filter((bm) => {
    const key = `${bm.name.toLowerCase()}|${bm.link || ""}|${bm.matriz || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export default function AdminReciclagem() {
  const [items, setItems] = useState<BlockedItem[]>([]);
  const [recycledRaw, setRecycledRaw] = useState<{ price: number; recycledAt: string | null }[]>([]);
  const [period, setPeriod] = useState<"all" | "week" | "month" | "year">("all");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<BlockedItem | null>(null);
  const [blocoContent, setBlocoContent] = useState("");
  const [blocoTemplate, setBlocoTemplate] = useState<string>("");
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [sellItem, setSellItem] = useState<BlockedItem | null>(null);

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
        ? supabase.from("products").select("id, name, price").in("id", productIds)
        : Promise.resolve({ data: [] }),
      orderItemIds.length > 0
        ? supabase.from("order_items").select("id, order_id, delivery_data").in("id", orderItemIds)
        : Promise.resolve({ data: [] }),
      stockItemIds.length > 0
        ? supabase.from("replacements").select("stock_item_id, order_item_id, order_id, reason, notes, created_at").in("stock_item_id", stockItemIds).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    const replacementRows = (replacementsRes.data || []) as any[];
    const replacedStockIds = new Set(replacementRows.map(r => r.stock_item_id));
    const replacementInfoByStock = new Map<string, { reason: string | null; notes: string | null }>();
    for (const r of replacementRows) {
      if (r.stock_item_id && !replacementInfoByStock.has(r.stock_item_id)) {
        replacementInfoByStock.set(r.stock_item_id, { reason: r.reason ?? null, notes: r.notes ?? null });
      }
    }
    const replacementOrderItemIds = [...new Set(replacementRows.map(r => r.order_item_id).filter(Boolean))];
    const missingReplacementOrderItemIds = replacementOrderItemIds.filter((id) => !orderItemIds.includes(id));
    const { data: replacementOrderItems } = missingReplacementOrderItemIds.length > 0
      ? await supabase.from("order_items").select("id, order_id, delivery_data").in("id", missingReplacementOrderItemIds)
      : { data: [] };
    const allOrderItems = [...((orderItemsRes.data || []) as any[]), ...((replacementOrderItems || []) as any[])];
    const replacementOrderItemByStock = new Map(
      replacementRows
        .filter(r => r.stock_item_id && r.order_item_id)
        .map(r => [r.stock_item_id, allOrderItems.find((oi: any) => oi.id === r.order_item_id) || null])
    );

    const productRows = (productsRes.data || []) as any[];
    const productMap = new Map(productRows.map((p: any) => [p.id, p.name]));
    const productPriceMap = new Map((productsRes.data || []).map((p: any) => [p.id, Number(p.price) || 0]));

    // Get order codes and user ids
    const orderIds = [...new Set(allOrderItems.filter(oi => oi.order_id).map(oi => oi.order_id))];
    const { data: orders } = orderIds.length > 0
      ? await supabase.from("orders").select("id, code, user_id").in("id", orderIds)
      : { data: [] };

    const orderMap = new Map((orders || []).map(o => [o.id, o]));
    const orderItemToOrder = new Map(allOrderItems.map(oi => [oi.id, orderMap.get(oi.order_id)]));
    const orderItemDataMap = new Map(allOrderItems.map(oi => [oi.id, oi.delivery_data as any]));

    // Get client names
    const userIds = [...new Set((orders || []).filter(o => o.user_id).map(o => o.user_id))];
    const { data: profiles } = userIds.length > 0
      ? await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
      : { data: [] };
    const profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name]));

    // Fetch all BMs (from bm_tracking + their stock_items) to derive BMs vinculadas a cada perfil
    const allOrderIds = [...new Set((orders || []).map(o => o.id))];
    const [bmTracksRes, allBmStocksRes] = await Promise.all([
      allOrderIds.length > 0
        ? supabase.from("bm_tracking").select("order_id, stock_item_id, product_name, bm_link").in("order_id", allOrderIds)
        : Promise.resolve({ data: [] as any[] }),
      // BM stock_items with a perfilMatriz set (used to match by matriz ILIKE)
      supabase.from("stock_items").select("id, name, identification, identification_link, data").eq("type", "bm").not("data->>perfilMatriz", "is", null),
    ]);

    const bmStockMap = new Map<string, any>();
    const bmsByMatrizText: { matriz: string; bm: LinkedBm }[] = [];
    for (const bm of ((allBmStocksRes.data || []) as any[])) {
      bmStockMap.set(bm.id, bm);
      const matriz = bm.data?.perfilMatriz?.trim?.();
      if (matriz) {
        bmsByMatrizText.push({
          matriz: matriz.toLowerCase(),
          bm: { name: bm.name || bm.identification || "BM", link: bm.identification_link, matriz },
        });
      }
    }

    const bmsByOrder = new Map<string, LinkedBm[]>();
    for (const bt of (((bmTracksRes as any).data) || []) as any[]) {
      if (!bt.order_id) continue;
      const stk = bt.stock_item_id ? bmStockMap.get(bt.stock_item_id) : null;
      const name = stk?.name || stk?.identification || bt.product_name || "BM";
      const link = stk?.identification_link || bt.bm_link;
      const matriz = stk?.data?.perfilMatriz || stk?.data?.perfilBackup || null;
      const arr = bmsByOrder.get(bt.order_id) || [];
      arr.push({ name, link, matriz });
      bmsByOrder.set(bt.order_id, arr);
    }

    const enriched: BlockedItem[] = stockItems.map(item => {
      const directOrder = item.order_item_id ? orderItemToOrder.get(item.order_item_id) : null;
      const replacementOrderItem = replacementOrderItemByStock.get(item.id) as any;
      const replacementOrder = replacementOrderItem?.order_id ? orderMap.get(replacementOrderItem.order_id) : null;
      const order = directOrder || replacementOrder || null;
      let derivedBms: LinkedBm[] = [];
      let derivedMatriz: string | null = null;
      // Only profile-type items aggregate child BMs — BM items don't list other BMs
      if (item.type !== "bm") {
        const fromOrder = order ? (bmsByOrder.get(order.id) || []) : [];
        const fromDelivery = item.order_item_id ? parseLinkedBms(orderItemDataMap.get(item.order_item_id)) : [];
        const fromReplacementDelivery = replacementOrderItem?.id ? parseLinkedBms(orderItemDataMap.get(replacementOrderItem.id)) : [];
        // Also match BMs whose perfilMatriz text contains this profile's name or identification
        const itemData = item.data as any;
        const snapshotBms = parseLinkedBms(itemData);
        const needles = [item.name, item.identification, itemData?.nomePerfil]
          .filter(Boolean).map((s: any) => String(s).toLowerCase().trim()).filter(s => s.length > 2);
        const fromMatriz = bmsByMatrizText
          .filter(({ matriz }) => needles.some(n => matriz.includes(n)))
          .map(({ bm }) => bm);
        derivedBms = snapshotBms.length ? [] : mergeLinkedBms(fromDelivery, fromReplacementDelivery, fromOrder, fromMatriz);
        const productName = item.product_id ? cleanText(productMap.get(item.product_id)) : "";
        const combinedProductText = [productName, itemData?.nomeProduto, ...(itemData?.tags || [])].join(" ").toLowerCase();
        const expectedBmCount = Number(combinedProductText.match(/(?:com|\+)\s*(\d+)\s*bm/i)?.[1] || 0);
        if (!snapshotBms.length && expectedBmCount > derivedBms.length) {
          const missingCount = expectedBmCount - derivedBms.length;
          derivedBms = [
            ...derivedBms,
            ...Array.from({ length: missingCount }, (_, idx) => ({
              name: `BM vinculada não registrada #${derivedBms.length + idx + 1}`,
              link: null,
              matriz: null,
            })),
          ];
        }
        derivedMatriz = cleanText(itemData?.perfilMatriz || itemData?.perfilBackup)
          || cleanText(orderItemDataMap.get(item.order_item_id || "")?.perfilMatriz)
          || cleanText(orderItemDataMap.get(replacementOrderItem?.id || "")?.perfilMatriz)
          || cleanText(derivedBms.find(b => b.matriz)?.matriz)
          || null;
      }
      return {
        ...item,
        data: item.data as Record<string, any> | null,
        productName: item.product_id ? productMap.get(item.product_id) || "—" : "—",
        productPrice: item.product_id ? (productPriceMap.get(item.product_id) || 0) : 0,
        clientName: order ? profileMap.get(order.user_id) || "—" : "—",
        orderCode: order ? order.code : "—",
        blockedAt: item.updated_at,
        hasReplacement: replacedStockIds.has(item.id),
        replacementReason: replacementInfoByStock.get(item.id)?.reason ?? null,
        replacementNotes: replacementInfoByStock.get(item.id)?.notes ?? null,
        derivedBms,
        derivedMatriz,
      };
    });

    setItems(enriched);
    setLoading(false);

    // Recycled KPI: items previously blocked and now returned to store
    const { data: recycled } = await supabase
      .from("stock_items")
      .select("product_id, data")
      .not("data->>_recycled_at", "is", null);

    const recycledList = (recycled || []) as any[];
    const recycledProductIds = [...new Set(recycledList.filter(r => r.product_id).map(r => r.product_id))];
    const { data: recycledProducts } = recycledProductIds.length > 0
      ? await supabase.from("products").select("id, price").in("id", recycledProductIds)
      : { data: [] };
    const priceMap = new Map((recycledProducts || []).map((p: any) => [p.id, Number(p.price) || 0]));
    setRecycledRaw(recycledList.map((r) => ({
      price: priceMap.get(r.product_id) || 0,
      recycledAt: r.data?._recycled_at ?? null,
    })));
  }

  const handleViewDetails = async (item: BlockedItem) => {
    setSelectedItem(item);
    setEditMode(false);
    setNoteOpen(false);
    setNoteDraft(item.data?._observation_note ?? "");
    setEditData({
      nomePerfil: item.data?.nomePerfil ?? "",
      emailAcesso: item.data?.emailAcesso ?? "",
      emailAlternativo: item.data?.emailAlternativo ?? "",
      senha: item.data?.senha ?? item.data?.senhaFB ?? "",
      senhaEmail: item.data?.senhaEmail ?? "",
      token2fa: item.data?.token2fa ?? "",
      dataNascimento: item.data?.dataNascimento ?? "",
      genero: item.data?.genero ?? "",
      cookies: item.data?.cookies ?? "",
      idPerfil: item.identification ?? item.data?.idPerfil ?? "",
      linkPerfil: item.identification_link ?? item.data?.linkPerfil ?? "",
    });

    // Fetch block template and generate content
    const { data: tpl } = await supabase
      .from("block_templates")
      .select("content")
      .eq("is_default", true)
      .maybeSingle();

    if (tpl?.content && item.data) {
      setBlocoTemplate(tpl.content);
      setBlocoContent(renderTemplate(tpl.content, item.data, item));
    } else {
      setBlocoTemplate("");
      setBlocoContent("Template padrão não encontrado ou item sem dados.");
    }
  };

  function renderTemplate(tpl: string, d: any, item: BlockedItem): string {
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
    let content = tpl;
    for (const [key, val] of Object.entries(replacements)) {
      content = content.split(key).join(val);
    }
    return content;
  }

  async function handleSaveEdit() {
    if (!selectedItem) return;
    setSavingEdit(true);
    const newData = { ...(selectedItem.data || {}), ...editData };
    // Keep legacy field in sync
    if (editData.senha) (newData as any).senhaFB = editData.senha;
    const updates: any = { data: newData };
    if (editData.idPerfil !== (selectedItem.identification ?? "")) {
      updates.identification = editData.idPerfil || null;
    }
    if (editData.linkPerfil !== (selectedItem.identification_link ?? "")) {
      updates.identification_link = editData.linkPerfil || null;
    }
    const { error } = await supabase.from("stock_items").update(updates).eq("id", selectedItem.id);
    setSavingEdit(false);
    if (error) {
      toast.error("Erro ao salvar alterações");
      return;
    }
    const updatedItem: BlockedItem = {
      ...selectedItem,
      data: newData,
      identification: updates.identification ?? selectedItem.identification,
      identification_link: updates.identification_link ?? selectedItem.identification_link,
    };
    setSelectedItem(updatedItem);
    setItems((prev) => prev.map((i) => (i.id === updatedItem.id ? updatedItem : i)));
    if (blocoTemplate) setBlocoContent(renderTemplate(blocoTemplate, newData, updatedItem));
    setEditMode(false);
    toast.success("Bloco atualizado");
  }

  const handleRecycle = async (item: BlockedItem) => {
    const confirmed = window.confirm(
      "Liberar este item para venda novamente?\n\n" +
      "Isso irá:\n" +
      "• Desvincular do pedido anterior\n" +
      "• Voltar para o estoque como 'revisado'\n" +
      "• Limpar a trava de credenciais acessadas (item volta a ser vendável na loja)\n\n" +
      "Confirme que a senha/2FA já foram trocados antes de prosseguir."
    );
    if (!confirmed) return;

    // Clean compromised-stock flag so the item can actually be sold again
    const cleanedData = { ...(item.data || {}) };
    delete (cleanedData as any)._credentials_accessed_at;
    delete (cleanedData as any)._blocked_at;
    delete (cleanedData as any)._blocked_by;
    delete (cleanedData as any)._blocked_reason;
    (cleanedData as any)._recycled_at = new Date().toISOString();

    // Reset item: unlink from order, set status back to 'revisado' so it can be resold
    const { error } = await supabase
      .from("stock_items")
      .update({ status: "revisado", order_item_id: null, data: cleanedData })
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

    toast.success("Item liberado! Disponível para nova venda na loja.");
    setSelectedItem(null);
    fetchItems();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("bm_tracking").update({ stock_item_id: null }).eq("stock_item_id", id);
    await supabase.from("replacements").update({ stock_item_id: null }).eq("stock_item_id", id);
    await supabase.from("replacements").update({ new_stock_item_id: null }).eq("new_stock_item_id", id);
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

  const periodStart = (() => {
    const now = new Date();
    if (period === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === "week") { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
    if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
    if (period === "year") return new Date(now.getFullYear(), 0, 1);
    return null;
  })();

  const inPeriod = (dateStr?: string | null) => {
    if (!periodStart) return true;
    if (!dateStr) return false;
    return new Date(dateStr) >= periodStart;
  };

  const periodItems = items.filter(i => inPeriod(i.blockedAt));
  const periodRecycled = recycledRaw.filter(r => inPeriod(r.recycledAt));
  const recycledStats = {
    count: periodRecycled.length,
    value: periodRecycled.reduce((s, r) => s + r.price, 0),
  };

  const filtered = periodItems.filter(i =>
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

      {/* Period filter */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs text-muted-foreground">Período:</span>
        {([
          { k: "all", l: "Tudo" },
          { k: "today", l: "Hoje" },
          { k: "week", l: "Semana" },
          { k: "month", l: "Mês" },
          { k: "year", l: "Ano" },
        ] as const).map(({ k, l }) => (
          <button
            key={k}
            onClick={() => setPeriod(k)}
            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
              period === k
                ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-card border border-border">
          <p className="text-xs text-muted-foreground">Total Bloqueados</p>
          <p className="text-2xl font-bold text-foreground">{periodItems.length}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            R$ {periodItems.reduce((s, i) => s + (i.productPrice || 0), 0).toFixed(2).replace(".", ",")}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <p className="text-xs text-muted-foreground">Com Produto Vinculado</p>
          <p className="text-2xl font-bold text-foreground">{periodItems.filter(i => i.product_id).length}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            R$ {periodItems.filter(i => i.product_id).reduce((s, i) => s + (i.productPrice || 0), 0).toFixed(2).replace(".", ",")}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <p className="text-xs text-muted-foreground">Sem Produto</p>
          <p className="text-2xl font-bold text-foreground">{periodItems.filter(i => !i.product_id).length}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Sem valor estimado
          </p>
        </div>
        <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <p className="text-xs text-emerald-400">Reciclados (volta p/ loja)</p>
          <p className="text-2xl font-bold text-emerald-300">{recycledStats.count}</p>
          <p className="text-[11px] text-emerald-400/80 mt-0.5">
            R$ {recycledStats.value.toFixed(2).replace(".", ",")}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
          <p className="text-xs text-red-400">Não Reciclados (perda)</p>
          <p className="text-2xl font-bold text-red-300">{periodItems.length}</p>
          <p className="text-[11px] text-red-400/80 mt-0.5">
            R$ {periodItems.reduce((s, i) => s + (i.productPrice || 0), 0).toFixed(2).replace(".", ",")} preso em estoque
          </p>
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
                     {item.data?._under_analysis && (
                       <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] gap-1">
                         <ClipboardList className="size-3" /> EM ANÁLISE
                       </Badge>
                     )}
                      {item.data?._under_observation && (
                        <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/30 text-[10px] gap-1">
                          <Eye className="size-3" /> EM OBSERVAÇÃO
                        </Badge>
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
                  {item.replacementReason && (
                    <p className="text-[11px] text-amber-400/90 mt-0.5">
                      Motivo: <span className="text-amber-300">{item.replacementReason}</span>
                    </p>
                  )}
                  {item.replacementNotes && (
                    <p className="text-[11px] text-muted-foreground italic mt-0.5">
                      Obs: {item.replacementNotes}
                    </p>
                  )}
                  {(() => {
                    const bms = mergeLinkedBms(parseLinkedBms(item.data), item.derivedBms || []);
                    const matriz = cleanText(item.data?.perfilMatriz || item.data?.perfilBackup) || item.derivedMatriz;
                    if (!bms.length && !matriz) return null;
                    return (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {bms.map((bm, i: number) => (
                          <Badge key={i} className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] gap-1">
                            <span className="material-symbols-outlined text-[11px]">business_center</span>
                            {bm.name}
                            {bm.matriz && !matriz && <span className="text-blue-300/70">• {bm.matriz}</span>}
                          </Badge>
                        ))}
                        {matriz && (
                          <Badge className="bg-purple-500/10 text-purple-300 border-purple-500/20 text-[10px] gap-1">
                            <Shield className="size-3" /> Matriz: {matriz}
                          </Badge>
                        )}
                      </div>
                    );
                  })()}
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
                  onClick={() => setSellItem(item)}
                  className="text-emerald-500 hover:text-emerald-400"
                  title="Vender este perfil para um cliente"
                  disabled={!item.product_id}
                >
                  <ShoppingCart className="size-4" />
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
              {selectedItem?.data?._under_analysis && (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] gap-1">
                  <ClipboardList className="size-3" /> EM ANÁLISE
                </Badge>
              )}
              {selectedItem?.data?._under_observation && (
                <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/30 text-[10px] gap-1">
                  <Eye className="size-3" /> EM OBSERVAÇÃO
                </Badge>
              )}
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

              {/* BMs atribuídas e Perfil Matriz */}
              {(() => {
                const bms = mergeLinkedBms(parseLinkedBms(selectedItem.data), selectedItem.derivedBms || []);
                const matriz = cleanText(selectedItem.data?.perfilMatriz || selectedItem.data?.perfilBackup) || selectedItem.derivedMatriz;
                if (!bms.length && !matriz) return null;
                return (
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 space-y-2">
                    <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="size-3.5" /> BMs vinculadas a este perfil
                    </h4>
                    {bms.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {bms.map((bm, i) => (
                          <Badge key={i} className="bg-blue-500/15 text-blue-300 border-blue-500/30 text-[11px] gap-1 cursor-pointer" onClick={() => copyToClipboard(bm.link || bm.name)} title="Copiar BM">
                            <span className="material-symbols-outlined text-[11px]">business_center</span>
                            {bm.name}
                            {bm.matriz && <span className="text-purple-200/80">• Matriz: {bm.matriz}</span>}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {matriz && (
                      <div className="flex items-center gap-2 text-xs text-foreground">
                        <span className="text-muted-foreground">Perfil matriz das BMs:</span>
                        <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/30 text-[11px] cursor-pointer" onClick={() => copyToClipboard(matriz)} title="Copiar matriz">
                          {matriz}
                        </Badge>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Block Template Content */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="size-3.5" />
                    Bloco de Notas
                  </h4>
                  <div className="flex items-center gap-1">
                    <Button
                      variant={editMode ? "default" : "outline"}
                      size="sm"
                      onClick={() => setEditMode((v) => !v)}
                      className="text-xs h-7"
                    >
                      {editMode ? (<><X className="size-3 mr-1" /> Cancelar</>) : (<><Pencil className="size-3 mr-1" /> Editar</>)}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(blocoContent)} className="text-xs h-7">
                      <Copy className="size-3 mr-1" /> Copiar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const safeName = (selectedItem.name || "perfil").replace(/[^\w.-]+/g, "_");
                        const blob = new Blob([blocoContent], { type: "text/plain;charset=utf-8" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${safeName}.txt`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="text-xs h-7"
                    >
                      <Download className="size-3 mr-1" /> Baixar .txt
                    </Button>
                  </div>
                </div>

                {/* Quick copy shortcuts */}
                {(() => {
                  const d: any = selectedItem.data || {};
                  const chips: { label: string; value?: string; icon: any }[] = [
                    { label: "Senha", value: d.senhaFB || d.senha, icon: KeyRound },
                    { label: "2FA", value: d.token2fa || d.tokenFb, icon: Shield },
                    { label: "Email", value: d.emailAcesso || d.email, icon: Mail },
                    { label: "Senha Email", value: d.senhaEmail, icon: KeyRound },
                    { label: "ID", value: selectedItem.identification || d.idPerfil, icon: Hash },
                    { label: "Link", value: selectedItem.identification_link || d.linkPerfil, icon: LinkIcon },
                    { label: "Cookies", value: d.cookies || d.cookie || d.cookieFb, icon: Cookie },
                  ].filter(c => c.value);
                  if (!chips.length) return null;
                  return (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {chips.map((c) => {
                        const Icon = c.icon;
                        return (
                          <Button
                            key={c.label}
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(String(c.value))}
                            className="h-7 text-xs gap-1.5"
                            title={`Copiar ${c.label}`}
                          >
                            <Icon className="size-3" /> {c.label}
                          </Button>
                        );
                      })}
                      <Button
                        variant={selectedItem.data?._under_analysis ? "default" : "outline"}
                        size="sm"
                        onClick={async () => {
                          const newFlag = !selectedItem.data?._under_analysis;
                          const newData = { ...(selectedItem.data || {}), _under_analysis: newFlag };
                          const { error } = await supabase
                            .from("stock_items")
                            .update({ data: newData })
                            .eq("id", selectedItem.id);
                          if (error) {
                            toast.error("Erro ao atualizar status");
                            return;
                          }
                          toast.success(newFlag ? "Marcado em análise" : "Análise removida");
                          setSelectedItem({ ...selectedItem, data: newData });
                          setItems((prev) => prev.map((i) => (i.id === selectedItem.id ? { ...i, data: newData } : i)));
                        }}
                        className={`h-7 text-xs gap-1.5 ml-auto ${selectedItem.data?._under_analysis ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}`}
                        title="Marcar este perfil como em análise interna"
                      >
                        <ClipboardList className="size-3" />
                        {selectedItem.data?._under_analysis ? "Em Análise" : "Marcar em Análise"}
                      </Button>
                      <Button
                        variant={selectedItem.data?._under_observation ? "default" : "outline"}
                        size="sm"
                        onClick={async () => {
                          const newFlag = !selectedItem.data?._under_observation;
                          const newData = { ...(selectedItem.data || {}), _under_observation: newFlag };
                          const { error } = await supabase
                            .from("stock_items")
                            .update({ data: newData })
                            .eq("id", selectedItem.id);
                          if (error) {
                            toast.error("Erro ao atualizar observação");
                            return;
                          }
                          toast.success(newFlag ? "Marcado em observação" : "Observação removida");
                          setSelectedItem({ ...selectedItem, data: newData });
                          setItems((prev) => prev.map((i) => (i.id === selectedItem.id ? { ...i, data: newData } : i)));
                        }}
                        className={`h-7 text-xs gap-1.5 ${selectedItem.data?._under_observation ? "bg-sky-500 hover:bg-sky-600 text-white" : ""}`}
                        title="Item revisado, mas mantido em observação interna"
                      >
                        <Eye className="size-3" />
                        {selectedItem.data?._under_observation ? "Em Observação" : "Marcar Observação"}
                      </Button>
                      <Button
                        variant={selectedItem.data?._observation_note ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setNoteDraft(selectedItem.data?._observation_note ?? "");
                          setNoteOpen((v) => !v);
                        }}
                        className={`h-7 text-xs gap-1.5 ${selectedItem.data?._observation_note ? "bg-violet-500 hover:bg-violet-600 text-white" : ""}`}
                        title="Adicionar nota de observação"
                      >
                        <StickyNote className="size-3" />
                        {selectedItem.data?._observation_note ? "Nota" : "Adicionar Nota"}
                      </Button>
                    </div>
                  );
                })()}

                {noteOpen && selectedItem && (
                  <div className="space-y-2 bg-violet-500/5 border border-violet-500/20 rounded-lg p-3">
                    <label className="text-xs font-bold text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
                      <StickyNote className="size-3" /> Nota de Observação Interna
                    </label>
                    <textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="Descreva o motivo da observação (ex: perfil instável, aguardando verificação...)"
                      className="w-full min-h-[80px] p-2 rounded-md bg-black/30 border border-white/5 text-sm text-zinc-200 placeholder:text-zinc-600 resize-y outline-none focus:border-violet-500/40 transition-colors"
                    />
                    <div className="flex gap-2 justify-end">
                      {selectedItem.data?._observation_note && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-red-400 hover:text-red-300"
                          disabled={savingNote}
                          onClick={async () => {
                            setSavingNote(true);
                            const newData = { ...(selectedItem.data || {}) };
                            delete newData._observation_note;
                            const { error } = await supabase
                              .from("stock_items")
                              .update({ data: newData })
                              .eq("id", selectedItem.id);
                            setSavingNote(false);
                            if (error) { toast.error("Erro ao remover nota"); return; }
                            toast.success("Nota removida");
                            setNoteDraft("");
                            setNoteOpen(false);
                            setSelectedItem({ ...selectedItem, data: newData });
                            setItems((prev) => prev.map((i) => (i.id === selectedItem.id ? { ...i, data: newData } : i)));
                          }}
                        >
                          Remover
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1.5 bg-violet-500 hover:bg-violet-600 text-white"
                        disabled={savingNote}
                        onClick={async () => {
                          setSavingNote(true);
                          const newData = { ...(selectedItem.data || {}), _observation_note: noteDraft.trim() };
                          const { error } = await supabase
                            .from("stock_items")
                            .update({ data: newData })
                            .eq("id", selectedItem.id);
                          setSavingNote(false);
                          if (error) { toast.error("Erro ao salvar nota"); return; }
                          toast.success("Nota salva");
                          setNoteOpen(false);
                          setSelectedItem({ ...selectedItem, data: newData });
                          setItems((prev) => prev.map((i) => (i.id === selectedItem.id ? { ...i, data: newData } : i)));
                        }}
                      >
                        <Save className="size-3" /> Salvar Nota
                      </Button>
                    </div>
                  </div>
                )}

                {editMode ? (
                  <div className="space-y-2 bg-muted/30 border border-border rounded-lg p-3 max-h-80 overflow-y-auto">
                    {([
                      ["nomePerfil", "Nome do Perfil"],
                      ["idPerfil", "ID do Perfil"],
                      ["linkPerfil", "Link do Perfil"],
                      ["emailAcesso", "Email"],
                      ["senha", "Senha FB"],
                      ["token2fa", "Token 2FA"],
                      ["senhaEmail", "Senha Email"],
                      ["emailAlternativo", "Email Alternativo"],
                      ["dataNascimento", "Data Nascimento"],
                      ["genero", "Gênero"],
                    ] as const).map(([key, label]) => (
                      <div key={key} className="grid grid-cols-3 gap-2 items-center">
                        <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
                        <Input
                          value={editData[key] ?? ""}
                          onChange={(e) => setEditData((p) => ({ ...p, [key]: e.target.value }))}
                          className="col-span-2 h-7 text-xs font-mono"
                        />
                      </div>
                    ))}
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground">Cookies</label>
                      <textarea
                        value={editData.cookies ?? ""}
                        onChange={(e) => setEditData((p) => ({ ...p, cookies: e.target.value }))}
                        className="w-full mt-1 p-2 rounded-md border border-border bg-background text-xs font-mono min-h-[80px]"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditMode(false)} className="h-7 text-xs">
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={handleSaveEdit} disabled={savingEdit} className="h-7 text-xs">
                        <Save className="size-3 mr-1" />
                        {savingEdit ? "Salvando..." : "Salvar alterações"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap text-xs font-mono text-foreground bg-muted/30 border border-border rounded-lg p-4 max-h-60 overflow-y-auto">
                    {blocoContent}
                  </pre>
                )}
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

      <SellModal
        item={sellItem}
        onClose={() => setSellItem(null)}
        onSold={() => {
          setSellItem(null);
          fetchItems();
        }}
      />
    </div>
  );
}

function SellModal({ item, onClose, onSold }: { item: BlockedItem | null; onClose: () => void; onSold: () => void }) {
  const [clientSearch, setClientSearch] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [price, setPrice] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setPrice(Number(item.productPrice || 0));
      setSelectedClient(null);
      setClientSearch("");
      setClients([]);
      setShareLink(null);
    }
  }, [item]);

  useEffect(() => {
    if (clientSearch.trim().length < 2) { setClients([]); return; }
    const t = setTimeout(async () => {
      const q = clientSearch.trim();
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, cpf")
        .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,cpf.ilike.%${q}%`)
        .limit(8);
      setClients(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [clientSearch]);

  if (!item) return null;

  const handleSell = async () => {
    if (!selectedClient) { toast.error("Selecione um cliente"); return; }
    if (!price || price < 1) { toast.error("Defina um preço válido (mín. R$1)"); return; }
    if (!item.product_id) { toast.error("Item sem produto vinculado"); return; }

    setSubmitting(true);
    try {
      // 1. Generate new order code (always new, even if same client owned profile before)
      const code = `ORD-${Date.now().toString(36).toUpperCase()}`;

      // 2. Create order (pending_payment)
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          code,
          user_id: selectedClient.user_id,
          subtotal: price,
          total: price,
          discount: 0,
          status: "pending_payment",
          payment_method: "pix",
        })
        .select("id, code")
        .single();
      if (orderErr) throw orderErr;

      // 3. Create order item
      const { data: orderItem, error: itemErr } = await supabase
        .from("order_items")
        .insert({
          order_id: order.id,
          name: item.productName || item.name,
          price,
          quantity: 1,
          product_id: item.product_id,
          description: `Venda de perfil reciclado: ${item.name}`,
        })
        .select("id")
        .single();
      if (itemErr) throw itemErr;

      // 4. Recycle this specific stock_item AND force it to be the first picked by FIFO
      const cleanedData = { ...(item.data || {}) };
      delete (cleanedData as any)._credentials_accessed_at;
      delete (cleanedData as any)._blocked_at;
      delete (cleanedData as any)._blocked_by;
      delete (cleanedData as any)._blocked_reason;
      (cleanedData as any)._recycled_at = new Date().toISOString();
      (cleanedData as any)._resold_to = selectedClient.user_id;
      (cleanedData as any)._resold_order_code = order.code;
      // Set created_at to epoch so fulfill_order_item (ORDER BY created_at ASC) picks THIS item first
      const { error: stockErr } = await supabase
        .from("stock_items")
        .update({
          status: "revisado",
          order_item_id: null,
          data: cleanedData,
          created_at: "1970-01-01T00:00:00Z",
        })
        .eq("id", item.id);
      if (stockErr) throw stockErr;

      // 5. Bump product stock so fulfill_order_item passes the stock check
      const { data: product } = await supabase
        .from("products")
        .select("stock")
        .eq("id", item.product_id)
        .maybeSingle();
      if (product) {
        await supabase
          .from("products")
          .update({ stock: (product.stock || 0) + 1, available: true })
          .eq("id", item.product_id);
      }

      // 6. Generate PIX payment linked to this order
      const { data: pixData, error: pixErr } = await supabase.functions.invoke("create-pix-payment", {
        body: { amount: price, order_id: order.id },
      });
      if (pixErr) throw new Error(pixErr.message || "Erro ao gerar PIX");
      if (pixData?.error) throw new Error(pixData.error);

      // 7. Create invoice link for sharing
      const invoiceCode = `INV-${Date.now().toString(36).toUpperCase()}`;
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const { data: authData } = await supabase.auth.getUser();
      const { data: inv } = await supabase
        .from("invoice_links" as any)
        .insert({
          code: invoiceCode,
          client_user_id: selectedClient.user_id,
          client_name: selectedClient.full_name || null,
          product_name: item.productName || item.name,
          product_id: item.product_id,
          amount: price,
          reference_date: new Date().toISOString().split("T")[0],
          description: `Recuperação perfil: ${item.name} (Pedido ${order.code})`,
          status: "pending",
          payment_id: pixData.payment_id,
          mp_payment_id: pixData.openpix_charge_id || null,
          qr_code: pixData.qr_code || null,
          qr_code_base64: pixData.qr_code_base64 || null,
          expires_at: expiresAt,
          created_by: authData.user?.id,
        })
        .select("code")
        .single();

      const origin = window.location.origin.includes("lovable") || window.location.origin.includes("supabase.co")
        ? "https://fbflix.com.br"
        : window.location.origin;
      const link = inv ? `${origin}/pagar/${(inv as any).code}` : (pixData.payment_link || null);
      setShareLink(link);
      if (link) {
        try { await navigator.clipboard.writeText(link); } catch {}
        toast.success(`Pedido ${order.code} criado! Link copiado.`);
      } else {
        toast.success(`Pedido ${order.code} criado!`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Erro: " + (err.message || "falha ao vender"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="size-5 text-emerald-500" />
            Vender perfil recuperado
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
            <p className="text-muted-foreground">Perfil</p>
            <p className="font-semibold text-foreground">{item.name}</p>
            <p className="text-muted-foreground mt-1">Produto: <span className="text-foreground">{item.productName}</span></p>
          </div>

          {!shareLink && (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Cliente</label>
                {selectedClient ? (
                  <div className="flex items-center justify-between p-2 rounded-md border border-emerald-500/30 bg-emerald-500/5">
                    <div className="flex items-center gap-2 text-sm">
                      <UserIcon className="size-4 text-emerald-400" />
                      <div>
                        <p className="font-medium text-foreground">{selectedClient.full_name || "Sem nome"}</p>
                        <p className="text-[11px] text-muted-foreground">{selectedClient.phone || selectedClient.cpf || ""}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedClient(null)}>
                      <X className="size-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, telefone ou CPF..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="pl-10"
                      autoFocus
                    />
                    {clients.length > 0 && (
                      <div className="absolute z-10 left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                        {clients.map((c) => (
                          <button
                            key={c.user_id}
                            onClick={() => { setSelectedClient(c); setClients([]); setClientSearch(""); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent border-b border-border/40 last:border-0"
                          >
                            <p className="font-medium text-foreground">{c.full_name || "Sem nome"}</p>
                            <p className="text-[11px] text-muted-foreground">{c.phone || c.cpf || ""}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Preço (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="1"
                  value={price || ""}
                  onChange={(e) => setPrice(Number(e.target.value))}
                />
                <p className="text-[10px] text-muted-foreground mt-1">Sugerido pela categoria do produto: R$ {Number(item.productPrice || 0).toFixed(2).replace(".", ",")}</p>
              </div>

              <Button
                onClick={handleSell}
                disabled={submitting || !selectedClient || !price}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {submitting ? (<><Loader2 className="size-4 mr-2 animate-spin" /> Gerando...</>) : (<><ShoppingCart className="size-4 mr-2" /> Gerar pedido e link de pagamento</>)}
              </Button>
            </>
          )}

          {shareLink && (
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
                <p className="text-xs text-emerald-300 font-semibold">Pedido criado! Compartilhe o link com o cliente:</p>
                <div className="flex items-center gap-1">
                  <Input value={shareLink} readOnly className="text-xs font-mono" />
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(shareLink); toast.success("Link copiado!"); }}>
                    <Copy className="size-3" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => window.open(shareLink, "_blank")}>
                    <ExternalLink className="size-3" />
                  </Button>
                </div>
              </div>
              <Button onClick={onSold} className="w-full">Fechar e atualizar lista</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
