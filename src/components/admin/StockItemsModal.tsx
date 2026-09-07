import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Loader2, Package, Eye, EyeOff, Trash2, Search, Link2, CheckCircle2, AlertTriangle, ArrowRightLeft } from "lucide-react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { ReplacementDownloadModal } from "./ReplacementDownloadModal";
import JSZip from "jszip";
import { toast } from "sonner";


interface StockItem {
  id: string;
  name: string;
  status: string;
  identification: string | null;
  identification_link: string | null;
  data: Record<string, unknown> | null;
  order_item_id: string | null;
  created_at: string;
  childCount?: number;
}

interface StockItemsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  revisado: { label: "Revisado", color: "bg-green-500/20 text-green-400" },
  vendido: { label: "Vendido", color: "bg-blue-500/20 text-blue-400" },
  aguardando: { label: "Aguardando", color: "bg-yellow-500/20 text-yellow-400" },
  bloqueado: { label: "Bloqueado", color: "bg-red-500/20 text-red-400" },
  link_expirado: { label: "Link Expirado", color: "bg-orange-500/20 text-orange-400" },
};

export function StockItemsModal({ open, onOpenChange, productId, productName }: StockItemsModalProps) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replacementItem, setReplacementItem] = useState<StockItem | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "available" | "sold" | "blocked" | "expired">("all");
  const [expandedChildrenId, setExpandedChildrenId] = useState<string | null>(null);
  const [childrenMap, setChildrenMap] = useState<Record<string, StockItem[]>>({});
  const [loadingChildren, setLoadingChildren] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [destProduct, setDestProduct] = useState<string>("");
  const [moving, setMoving] = useState(false);

  const toggleSelect = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleMove = async () => {
    if (!destProduct || selected.length === 0) return;
    setMoving(true);
    const { error } = await supabase
      .from("stock_items")
      .update({ product_id: destProduct })
      .in("id", selected);
    setMoving(false);
    if (error) {
      toast.error("Erro ao mover estoque: " + error.message);
      return;
    }
    const destName = products.find(p => p.id === destProduct)?.name || "outro produto";
    toast.success(`${selected.length} item(ns) movido(s) para "${destName}"`);
    setItems(prev => prev.filter(i => !selected.includes(i.id)));
    setSelected([]);
    setDestProduct("");
  };


  const fetchItems = () => {
    setLoading(true);
    (async () => {
      const { data: parents } = await supabase
        .from("stock_items")
        .select("id, name, status, identification, identification_link, data, order_item_id, created_at")
        .eq("product_id", productId)
        .is("deleted_at", null)
        .is("parent_id", null)
        .order("created_at", { ascending: false });
      const list = (parents as unknown as StockItem[]) ?? [];
      const ids = list.map(i => i.id);
      const counts: Record<string, number> = {};
      if (ids.length) {
        const { data: kids } = await supabase
          .from("stock_items")
          .select("parent_id")
          .in("parent_id", ids)
          .is("deleted_at", null);
        (kids ?? []).forEach((k: any) => {
          counts[k.parent_id] = (counts[k.parent_id] || 0) + 1;
        });
      }
      setItems(list.map(i => ({ ...i, childCount: counts[i.id] || 0 })));
      setLoading(false);
    })();
  };

  const toggleChildren = async (item: StockItem) => {
    if (expandedChildrenId === item.id) {
      setExpandedChildrenId(null);
      return;
    }
    setExpandedChildrenId(item.id);
    if (!childrenMap[item.id]) {
      setLoadingChildren(item.id);
      const { data } = await supabase
        .from("stock_items")
        .select("id, name, status, identification, identification_link, data, order_item_id, created_at")
        .eq("parent_id", item.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      setChildrenMap(prev => ({ ...prev, [item.id]: (data as unknown as StockItem[]) ?? [] }));
      setLoadingChildren(null);
    }
  };

  useEffect(() => {
    if (!open) return;
    setSelected([]);
    setDestProduct("");
    supabase
      .from("products")
      .select("id, name")
      .order("name")
      .then(({ data }) => setProducts(((data as any[]) ?? []).filter(p => p.id !== productId)));
  }, [open, productId]);

  useEffect(() => {
    if (open && productId) fetchItems();

  }, [open, productId]);

  const handleDelete = async (item: StockItem) => {
    if (!window.confirm(`Excluir "${item.name}" do estoque?`)) return;
    await supabase.from("bm_tracking").update({ stock_item_id: null }).eq("stock_item_id", item.id);
    await supabase.from("replacements").update({ stock_item_id: null }).eq("stock_item_id", item.id);
    await supabase.from("replacements").update({ new_stock_item_id: null }).eq("new_stock_item_id", item.id);
    await supabase.from("stock_items").update({ deleted_at: new Date().toISOString() }).eq("id", item.id);
    setItems(prev => prev.filter(i => i.id !== item.id));
  };

  const handleUpdateStatus = async (item: StockItem, newStatus: string) => {
    const { error } = await supabase
      .from("stock_items")
      .update({ status: newStatus })
      .eq("id", item.id);
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i));
    toast.success(`Status atualizado para ${statusLabels[newStatus]?.label || newStatus}`);
  };

  const handleEditLink = async (item: StockItem) => {
    const current = item.identification_link || "";
    const next = window.prompt("Novo link da BM:", current);
    if (next === null) return;
    const trimmed = next.trim();
    if (trimmed === current) return;
    const { error } = await supabase
      .from("stock_items")
      .update({ identification_link: trimmed || null })
      .eq("id", item.id);
    if (error) {
      toast.error("Erro ao atualizar link");
      return;
    }
    // Sync bm_tracking if linked
    await supabase.from("bm_tracking").update({ bm_link: trimmed || null }).eq("stock_item_id", item.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, identification_link: trimmed || null } : i));
    toast.success("Link atualizado");
  };

  const generateTxtFromTemplate = (template: string | null, stockItem: StockItem) => {
    const d = (stockItem.data as Record<string, unknown>) || {};
    const alternateEmail = (d.emailAlternativo || d.alternateEmail || d.alternative_email || "—") as string;

    if (template) {
      const replacements: Record<string, string> = {
        "{{nomePerfil}}": (d.nomePerfil as string) || "—",
        "{{emailAcesso}}": (d.emailAcesso as string) || "—",
        "{{emailAlternativo}}": alternateEmail,
        "{{senha}}": (d.senha as string) || "—",
        "{{senhaEmail}}": (d.senhaEmail as string) || "—",
        "{{token2fa}}": (d.token2fa as string) || "—",
        "{{dataNascimento}}": (d.dataNascimento as string) || "—",
        "{{genero}}": (d.genero as string) || "—",
        "{{tempoPlataforma}}": (d.tempoPlataforma as string) || "—",
        "{{statusAtual}}": (d.statusAtual as string) || "—",
        "{{descricao}}": (d.descricao as string) || "—",
        "{{cookies}}": (d.cookies ? (typeof d.cookies === "string" ? d.cookies : JSON.stringify(d.cookies, null, 2)) : "—"),
        "{{linkDocumento}}": (d.linkDocumento as string) || "—",
        "{{linkPerfil}}": (stockItem.identification_link as string) || (d.linkPerfil as string) || "—",
        "{{idPerfil}}": (stockItem.identification as string) || (d.idPerfil as string) || "—",
        "{{pedido}}": "—",
        "{{data}}": "—",
        "{{nomeProduto}}": stockItem.name,
      };
      let content = template;
      for (const [key, val] of Object.entries(replacements)) {
        content = content.split(key).join(val);
      }
      return content;
    }

    // Fallback
    const lines: string[] = [];
    lines.push(`=== ${stockItem.name} ===`);
    lines.push("");
    if (d.nomePerfil) lines.push(`Nome do Perfil: ${d.nomePerfil}`);
    if (d.emailAcesso) lines.push(`Email de Acesso: ${d.emailAcesso}`);
    if (d.senhaEmail) lines.push(`Senha do Email: ${d.senhaEmail}`);
    if (d.senha) lines.push(`Senha: ${d.senha}`);
    if (d.token2fa) lines.push(`Token 2FA: ${d.token2fa}`);
    if (d.emailAlternativo) lines.push(`Email Alternativo: ${d.emailAlternativo}`);
    if (stockItem.identification) lines.push(`ID: ${stockItem.identification}`);
    if (stockItem.identification_link) lines.push(`Link: ${stockItem.identification_link}`);
    if (d.dataNascimento) lines.push(`Data de Nascimento: ${d.dataNascimento}`);
    if (d.genero) lines.push(`Gênero: ${d.genero}`);
    if (d.tempoPlataforma) lines.push(`Tempo de Plataforma: ${d.tempoPlataforma}`);
    if (d.descricao) lines.push(`\nDescrição:\n${d.descricao}`);
    if (d.cookies) {
      lines.push(`\nCookies:\n${typeof d.cookies === "string" ? d.cookies : JSON.stringify(d.cookies, null, 2)}`);
    }
    return lines.join("\n");
  };

  const generateTxt = (item: StockItem) => generateTxtFromTemplate(null, item);

  const handleDownloadTxt = async (item: StockItem) => {
    // Fetch block template
    const { data: tpl } = await supabase
      .from("block_templates")
      .select("content")
      .eq("is_default", true)
      .maybeSingle();
    const template = (tpl as any)?.content || null;

    // Check if combo (has children)
    const { data: children } = await supabase
      .from("stock_items")
      .select("id, name, status, identification, identification_link, data, order_item_id, created_at")
      .eq("parent_id", item.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (children && children.length > 0) {
      // Combo: generate ZIP with all children
      const zip = new JSZip();
      (children as unknown as StockItem[]).forEach((child, idx) => {
        const content = generateTxtFromTemplate(template, child);
        if (content) {
          const fileName = `${String(idx + 1).padStart(2, "0")}_${child.identification || child.name.replace(/\s+/g, "_")}.txt`;
          zip.file(fileName, content);
        }
      });

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${item.name.replace(/\s+/g, "_")}_combo.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`ZIP gerado com ${children.length} perfis`);
    } else {
      // Single item
      const content = generateTxtFromTemplate(template, item);
      if (!content) return;
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${item.identification || item.name.replace(/\s+/g, "_")}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const available = items.filter(i => i.status === "revisado" && !i.order_item_id);
  const sold = items.filter(i => i.status === "vendido" || i.order_item_id);
  const blocked = items.filter(i => i.status === "bloqueado");
  const expired = items.filter(i => i.status === "link_expirado");
  const other = items.filter(i => !["revisado", "vendido", "bloqueado", "link_expirado"].includes(i.status) && !i.order_item_id);

  const filteredByStatus = filter === "available" ? available
    : filter === "sold" ? sold
    : filter === "blocked" ? blocked
    : filter === "expired" ? expired
    : items;
  const q = search.trim().toLowerCase();
  const visibleItems = q
    ? filteredByStatus.filter(i =>
        (i.name?.toLowerCase().includes(q)) ||
        (i.identification?.toLowerCase().includes(q)) ||
        (i.identification_link?.toLowerCase().includes(q))
      )
    : filteredByStatus;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-zinc-900 border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-lg text-white flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Estoque — {productName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-zinc-500 text-center py-8">Nenhum item de estoque encontrado.</p>
        ) : (
          <div className="space-y-3">
            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setFilter("all")} className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${filter === "all" ? "bg-white/10 border-white/20 text-white" : "bg-transparent border-white/5 text-zinc-400 hover:text-white"}`}>Todos ({items.length})</button>
              <button onClick={() => setFilter("available")} className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${filter === "available" ? "bg-green-500/25 border-green-500/40 text-green-300" : "bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/15"}`}>Na loja ({available.length})</button>
              <button onClick={() => setFilter("sold")} className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${filter === "sold" ? "bg-blue-500/25 border-blue-500/40 text-blue-300" : "bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/15"}`}>Vendidos ({sold.length})</button>
              {blocked.length > 0 && (
                <button onClick={() => setFilter("blocked")} className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${filter === "blocked" ? "bg-red-500/25 border-red-500/40 text-red-300" : "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/15"}`}>Bloqueados ({blocked.length})</button>
              )}
              {expired.length > 0 && (
                <button onClick={() => setFilter("expired")} className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${filter === "expired" ? "bg-orange-500/25 border-orange-500/40 text-orange-300" : "bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/15"}`}>Link Expirado ({expired.length})</button>
              )}
              {other.length > 0 && (
                <Badge className="bg-yellow-500/20 text-yellow-400">{other.length} aguardando</Badge>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, ID ou link..."
                className="pl-9 bg-black/30 border-white/5 text-white placeholder:text-zinc-600"
              />
            </div>

            {/* Mover estoque */}
            {selected.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 p-2">
                <span className="text-xs text-white font-medium px-1">
                  {selected.length} item(ns) selecionado(s) — mover para:
                </span>
                <Select value={destProduct} onValueChange={setDestProduct}>
                  <SelectTrigger className="h-8 w-[240px] bg-black/40 border-white/10 text-white text-xs">
                    <SelectValue placeholder="Escolha o produto de destino" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1"
                  disabled={!destProduct || moving}
                  onClick={handleMove}
                >
                  {moving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="h-3.5 w-3.5" />}
                  Mover estoque
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs text-zinc-400" onClick={() => setSelected([])}>
                  Cancelar
                </Button>
              </div>
            )}

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="w-8">
                      <Checkbox
                        checked={visibleItems.length > 0 && visibleItems.every(i => selected.includes(i.id))}
                        onCheckedChange={(c) => {
                          const ids = visibleItems.map(i => i.id);
                          setSelected(c ? [...new Set([...selected, ...ids])] : selected.filter(id => !ids.includes(id)));
                        }}
                      />
                    </TableHead>
                    <TableHead className="text-zinc-400 text-xs">NOME</TableHead>
                    <TableHead className="text-zinc-400 text-xs">ID</TableHead>
                    <TableHead className="text-zinc-400 text-xs">STATUS</TableHead>
                    <TableHead className="text-zinc-400 text-xs">AÇÕES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleItems.length === 0 && (
                    <TableRow className="border-zinc-800">
                      <TableCell colSpan={5} className="text-center text-zinc-500 text-sm py-6">
                        Nenhum item encontrado.
                      </TableCell>
                    </TableRow>
                  )}

                  {visibleItems.map((item) => {
                    const st = statusLabels[item.status] || { label: item.status, color: "bg-zinc-600 text-zinc-400" };
                    const hasData = item.data && Object.keys(item.data).length > 0;
                    const isExpanded = expandedId === item.id;
                    
                    return (
                      <>
                        <TableRow key={item.id} className="border-zinc-800 hover:bg-zinc-800/30">
                          <TableCell className="w-8">
                            <Checkbox
                              checked={selected.includes(item.id)}
                              onCheckedChange={() => toggleSelect(item.id)}
                            />
                          </TableCell>
                          <TableCell className="text-white text-sm font-medium">

                            <div className="flex items-center gap-2">
                              {(item.childCount ?? 0) > 0 && (
                                <button
                                  onClick={() => toggleChildren(item)}
                                  className="text-zinc-400 hover:text-white"
                                  title={`Ver ${item.childCount} itens do combo`}
                                >
                                  {expandedChildrenId === item.id
                                    ? <ChevronDown className="h-4 w-4" />
                                    : <ChevronRight className="h-4 w-4" />}
                                </button>
                              )}
                              <span>{item.name}</span>
                              {(item.childCount ?? 0) > 0 && (
                                <Badge className="bg-purple-500/20 text-purple-300 text-[10px]">
                                  combo · {item.childCount} itens
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-zinc-400 text-xs font-mono">
                            {item.identification || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${st.color}`}>● {st.label}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                title="Editar link da BM"
                                className="h-7 px-2 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 gap-1 text-xs"
                                onClick={() => handleEditLink(item)}
                              >
                                <Link2 className="h-3.5 w-3.5" />
                              </Button>
                              {item.status !== "revisado" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  title="Marcar como revisado"
                                  className="h-7 px-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 gap-1 text-xs"
                                  onClick={() => handleUpdateStatus(item, "revisado")}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {item.status !== "link_expirado" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  title="Marcar link como expirado"
                                  className="h-7 px-2 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 gap-1 text-xs"
                                  onClick={() => handleUpdateStatus(item, "link_expirado")}
                                >
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {hasData && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-zinc-400 hover:text-white gap-1 text-xs"
                                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                  >
                                    {isExpanded ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                    {isExpanded ? "Ocultar" : "Ver"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-primary hover:text-primary/80 gap-1 text-xs"
                                    onClick={() => setReplacementItem(item)}
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                    TXT
                                  </Button>
                                </>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1 text-xs"
                                onClick={() => handleDelete(item)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && hasData && (
                          <TableRow key={`${item.id}-detail`} className="border-zinc-800 bg-zinc-800/20">
                            <TableCell colSpan={5}>
                              <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono p-2 bg-zinc-900/80 rounded-lg max-h-60 overflow-y-auto">
                                {generateTxt(item)}
                              </pre>
                            </TableCell>
                          </TableRow>
                        )}
                        {expandedChildrenId === item.id && (
                          <TableRow key={`${item.id}-children`} className="border-zinc-800 bg-black/30">
                            <TableCell colSpan={5} className="p-2">
                              {loadingChildren === item.id ? (
                                <div className="flex items-center gap-2 text-zinc-400 text-xs py-3 px-2">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando itens do combo...
                                </div>
                              ) : (
                                <div className="max-h-80 overflow-y-auto rounded-md border border-zinc-800">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="border-zinc-800 hover:bg-transparent">
                                        <TableHead className="text-zinc-500 text-[10px]">#</TableHead>
                                        <TableHead className="text-zinc-500 text-[10px]">NOME</TableHead>
                                        <TableHead className="text-zinc-500 text-[10px]">ID</TableHead>
                                        <TableHead className="text-zinc-500 text-[10px]">LINK</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {(childrenMap[item.id] ?? []).map((c, idx) => (
                                        <TableRow key={c.id} className="border-zinc-800/60 hover:bg-zinc-800/20">
                                          <TableCell className="text-zinc-500 text-xs">{idx + 1}</TableCell>
                                          <TableCell className="text-zinc-200 text-xs">{c.name}</TableCell>
                                          <TableCell className="text-zinc-400 text-xs font-mono">{c.identification || "—"}</TableCell>
                                          <TableCell className="text-cyan-400 text-xs truncate max-w-[240px]">
                                            {c.identification_link ? (
                                              <a href={c.identification_link} target="_blank" rel="noreferrer" className="hover:underline">
                                                {c.identification_link}
                                              </a>
                                            ) : "—"}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>

      {replacementItem && (
        <ReplacementDownloadModal
          open={!!replacementItem}
          onOpenChange={(open) => { if (!open) setReplacementItem(null); }}
          item={replacementItem}
          productName={productName}
          onDownload={() => handleDownloadTxt(replacementItem)}
        />
      )}
    </Dialog>
  );
}
