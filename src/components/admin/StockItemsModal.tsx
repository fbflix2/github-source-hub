import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Loader2, Package, Eye, EyeOff, Trash2 } from "lucide-react";
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
};

export function StockItemsModal({ open, onOpenChange, productId, productName }: StockItemsModalProps) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replacementItem, setReplacementItem] = useState<StockItem | null>(null);

  const fetchItems = () => {
    setLoading(true);
    supabase
      .from("stock_items")
      .select("id, name, status, identification, identification_link, data, order_item_id, created_at")
      .eq("product_id", productId)
      .is("deleted_at", null)
      .is("parent_id", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setItems((data as unknown as StockItem[]) ?? []);
        setLoading(false);
      });
  };

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
  const other = items.filter(i => !["revisado", "vendido", "bloqueado"].includes(i.status) && !i.order_item_id);

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
            {/* Summary */}
            <div className="flex gap-3 flex-wrap">
              <Badge className="bg-green-500/20 text-green-400">{available.length} disponível</Badge>
              <Badge className="bg-blue-500/20 text-blue-400">{sold.length} vendido(s)</Badge>
              {blocked.length > 0 && <Badge className="bg-red-500/20 text-red-400">{blocked.length} bloqueado(s)</Badge>}
              {other.length > 0 && <Badge className="bg-yellow-500/20 text-yellow-400">{other.length} aguardando</Badge>}
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400 text-xs">NOME</TableHead>
                    <TableHead className="text-zinc-400 text-xs">ID</TableHead>
                    <TableHead className="text-zinc-400 text-xs">STATUS</TableHead>
                    <TableHead className="text-zinc-400 text-xs">AÇÕES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const st = statusLabels[item.status] || { label: item.status, color: "bg-zinc-600 text-zinc-400" };
                    const hasData = item.data && Object.keys(item.data).length > 0;
                    const isExpanded = expandedId === item.id;
                    
                    return (
                      <>
                        <TableRow key={item.id} className="border-zinc-800 hover:bg-zinc-800/30">
                          <TableCell className="text-white text-sm font-medium">{item.name}</TableCell>
                          <TableCell className="text-zinc-400 text-xs font-mono">
                            {item.identification || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${st.color}`}>● {st.label}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
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
                            <TableCell colSpan={4}>
                              <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono p-2 bg-zinc-900/80 rounded-lg max-h-60 overflow-y-auto">
                                {generateTxt(item)}
                              </pre>
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
