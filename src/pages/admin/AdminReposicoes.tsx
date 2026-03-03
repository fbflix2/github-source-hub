import { useState, useEffect } from "react";
import { RefreshCw, Search, Loader2, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Replacement {
  id: string;
  product_name: string;
  item_name: string;
  client_name: string | null;
  client_user_id: string;
  reason: string;
  item_value: number;
  notes: string | null;
  created_at: string;
  created_by: string;
  stock_item_id: string | null;
}

const reasonLabels: Record<string, string> = {
  bloqueado_garantia: "Bloqueado em Garantia",
  defeito: "Item com Defeito",
  erro_entrega: "Erro na Entrega",
  outro: "Outro",
};

export default function AdminReposicoes() {
  const [items, setItems] = useState<Replacement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterReason, setFilterReason] = useState("all");

  const fetchReplacements = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("replacements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar reposições");
      console.error(error);
    }
    setItems((data as any[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchReplacements(); }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Excluir este registro de reposição?")) return;
    await supabase.from("replacements").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success("Registro excluído");
  };

  const handleDownloadTxt = async (r: Replacement) => {
    if (!r.stock_item_id) {
      toast.error("Item de estoque não vinculado");
      return;
    }
    const { data: stockItem, error } = await supabase
      .from("stock_items")
      .select("name, data, identification, identification_link")
      .eq("id", r.stock_item_id)
      .single();

    if (error || !stockItem) {
      toast.error("Erro ao buscar dados do item");
      return;
    }

    const d = stockItem.data as Record<string, unknown> | null;
    const lines: string[] = [];
    lines.push(`=== ${stockItem.name} ===`);
    lines.push("");
    if (d) {
      if (d.nomePerfil) lines.push(`Nome do Perfil: ${d.nomePerfil}`);
      if (d.emailAcesso) lines.push(`Email de Acesso: ${d.emailAcesso}`);
      if (d.senhaEmail) lines.push(`Senha do Email: ${d.senhaEmail}`);
      if (d.senha) lines.push(`Senha: ${d.senha}`);
      if (d.token2fa) lines.push(`Token 2FA: ${d.token2fa}`);
      if (d.emailAlternativo) lines.push(`Email Alternativo: ${d.emailAlternativo}`);
    }
    if (stockItem.identification) lines.push(`ID: ${stockItem.identification}`);
    if (stockItem.identification_link) lines.push(`Link: ${stockItem.identification_link}`);
    if (d) {
      if (d.dataNascimento) lines.push(`Data de Nascimento: ${d.dataNascimento}`);
      if (d.genero) lines.push(`Gênero: ${d.genero}`);
      if (d.tempoPlataforma) lines.push(`Tempo de Plataforma: ${d.tempoPlataforma}`);
      if (d.descricao) lines.push(`\nDescrição:\n${d.descricao}`);
      if (d.cookies) {
        lines.push(`\nCookies:\n${typeof d.cookies === 'string' ? d.cookies : JSON.stringify(d.cookies, null, 2)}`);
      }
    }

    const content = lines.join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${r.item_name.replace(/\s+/g, "_")}_reposicao.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = items.filter(i => {
    const matchSearch = !search ||
      i.item_name.toLowerCase().includes(search.toLowerCase()) ||
      i.product_name.toLowerCase().includes(search.toLowerCase()) ||
      (i.client_name || "").toLowerCase().includes(search.toLowerCase());
    const matchReason = filterReason === "all" || i.reason === filterReason;
    return matchSearch && matchReason;
  });

  const totalValue = filtered.reduce((sum, i) => sum + Number(i.item_value), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-yellow-400" />
            Reposições
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Rastreie todas as reposições de itens para clientes</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchReplacements} className="border-zinc-700 gap-2">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="rounded-xl bg-zinc-900/50 border border-zinc-800 p-4">
          <p className="text-xs text-zinc-500">Total de Reposições</p>
          <p className="text-2xl font-bold text-white">{filtered.length}</p>
        </div>
        <div className="rounded-xl bg-zinc-900/50 border border-zinc-800 p-4">
          <p className="text-xs text-zinc-500">Valor Total</p>
          <p className="text-2xl font-bold text-yellow-400">R$ {totalValue.toFixed(2)}</p>
        </div>
        <div className="rounded-xl bg-zinc-900/50 border border-zinc-800 p-4">
          <p className="text-xs text-zinc-500">Garantia</p>
          <p className="text-2xl font-bold text-red-400">
            {filtered.filter(i => i.reason === "bloqueado_garantia").length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Buscar por item, produto ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-zinc-900 border-zinc-800"
          />
        </div>
        <Select value={filterReason} onValueChange={setFilterReason}>
          <SelectTrigger className="w-48 bg-zinc-900 border-zinc-800">
            <SelectValue placeholder="Motivo" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="all">Todos os motivos</SelectItem>
            <SelectItem value="bloqueado_garantia">Bloqueado em Garantia</SelectItem>
            <SelectItem value="defeito">Item com Defeito</SelectItem>
            <SelectItem value="erro_entrega">Erro na Entrega</SelectItem>
            <SelectItem value="outro">Outro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-zinc-500 py-12">Nenhuma reposição encontrada.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400 text-xs">DATA</TableHead>
                <TableHead className="text-zinc-400 text-xs">PRODUTO</TableHead>
                <TableHead className="text-zinc-400 text-xs">ITEM</TableHead>
                <TableHead className="text-zinc-400 text-xs">CLIENTE</TableHead>
                <TableHead className="text-zinc-400 text-xs">MOTIVO</TableHead>
                <TableHead className="text-zinc-400 text-xs">VALOR</TableHead>
                <TableHead className="text-zinc-400 text-xs">OBS</TableHead>
                <TableHead className="text-zinc-400 text-xs">AÇÕES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className="border-zinc-800 hover:bg-zinc-800/30">
                  <TableCell className="text-zinc-300 text-xs">
                    {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-white text-sm font-medium">{r.product_name}</TableCell>
                  <TableCell className="text-zinc-300 text-sm">{r.item_name}</TableCell>
                  <TableCell className="text-zinc-300 text-sm">{r.client_name || "—"}</TableCell>
                  <TableCell>
                    <Badge className="text-xs bg-yellow-500/20 text-yellow-400">
                      {reasonLabels[r.reason] || r.reason}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-yellow-400 text-sm font-mono">
                    R$ {Number(r.item_value).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-zinc-500 text-xs max-w-[150px] truncate">
                    {r.notes || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {r.stock_item_id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-primary hover:text-primary/80 hover:bg-primary/10"
                          onClick={() => handleDownloadTxt(r)}
                          title="Baixar TXT"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => handleDelete(r.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
