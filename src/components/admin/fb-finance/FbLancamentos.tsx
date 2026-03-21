import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const categorias = [
  "Salário", "Venda PJ", "Aluguel", "Energia", "Internet", "Gasolina", "Mercado",
  "Transporte", "Lazer", "Educação", "Saúde", "Outros"
];

interface Caixa { id: string; nome: string; tipo: string }
interface Lancamento {
  id: string; data: string; tipo: string; categoria: string;
  descricao: string | null; entrada: number; saida: number;
  caixa_destino_id: string | null; created_at: string;
}

export function FbLancamentos() {
  const [caixas, setCaixas] = useState<Caixa[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    data: new Date().toISOString().split("T")[0],
    tipo: "empresa",
    categoria: "Outros",
    descricao: "",
    entrada: "",
    saida: "",
    caixa_destino_id: "",
  });
  const [mesFilter, setMesFilter] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    fetchAll();
  }, [mesFilter]);

  const fetchAll = async () => {
    setLoading(true);
    const [caixasRes, lancRes] = await Promise.all([
      supabase.from("fb_finance_caixas" as any).select("id, nome, tipo"),
      supabase.from("fb_finance_lancamentos" as any).select("*").gte("data", `${mesFilter}-01`).lte("data", `${mesFilter}-31`).order("data", { ascending: false }),
    ]);
    if (caixasRes.data) setCaixas(caixasRes.data as any);
    if (lancRes.data) setLancamentos(lancRes.data as any);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!form.caixa_destino_id) {
      toast({ title: "Selecione um caixa destino", variant: "destructive" });
      return;
    }
    const payload = {
      data: form.data,
      tipo: form.tipo,
      categoria: form.categoria,
      descricao: form.descricao || null,
      entrada: parseFloat(form.entrada) || 0,
      saida: parseFloat(form.saida) || 0,
      caixa_destino_id: form.caixa_destino_id,
    };

    const { error } = await supabase.from("fb_finance_lancamentos" as any).insert(payload as any);
    if (error) {
      toast({ title: "Erro ao salvar", variant: "destructive" });
      return;
    }

    // Update caixa balance
    const caixa = caixas.find(c => c.id === form.caixa_destino_id);
    if (caixa) {
      const { data: current } = await supabase.from("fb_finance_caixas" as any).select("saldo_atual").eq("id", caixa.id).single();
      const newBalance = Number((current as any)?.saldo_atual || 0) + (parseFloat(form.entrada) || 0) - (parseFloat(form.saida) || 0);
      await supabase.from("fb_finance_caixas" as any).update({ saldo_atual: newBalance } as any).eq("id", caixa.id);
    }

    toast({ title: "Lançamento adicionado!" });
    setForm({ ...form, descricao: "", entrada: "", saida: "" });
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("fb_finance_lancamentos" as any).delete().eq("id", id);
    toast({ title: "Removido" });
    fetchAll();
  };

  const totalEntradas = lancamentos.reduce((s, l) => s + Number(l.entrada), 0);
  const totalSaidas = lancamentos.reduce((s, l) => s + Number(l.saida), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-white">Lançamentos Diários</h1>

      {/* Form */}
      <Card className="bg-[#0c1929] border-blue-900/30">
        <CardHeader><CardTitle className="text-sm text-blue-200">Novo Lançamento</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-blue-300/60 text-xs">Data</Label>
              <Input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})} className="bg-[#0a1420] border-blue-900/30 text-white text-sm" />
            </div>
            <div>
              <Label className="text-blue-300/60 text-xs">Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm({...form, tipo: v})}>
                <SelectTrigger className="bg-[#0a1420] border-blue-900/30 text-white text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pessoal">Pessoal</SelectItem>
                  <SelectItem value="empresa">Empresa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-blue-300/60 text-xs">Categoria</Label>
              <Select value={form.categoria} onValueChange={v => setForm({...form, categoria: v})}>
                <SelectTrigger className="bg-[#0a1420] border-blue-900/30 text-white text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-blue-300/60 text-xs">Caixa Destino</Label>
              <Select value={form.caixa_destino_id} onValueChange={v => setForm({...form, caixa_destino_id: v})}>
                <SelectTrigger className="bg-[#0a1420] border-blue-900/30 text-white text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {caixas.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-blue-300/60 text-xs">Descrição</Label>
              <Input value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} placeholder="Descrição..." className="bg-[#0a1420] border-blue-900/30 text-white text-sm" />
            </div>
            <div>
              <Label className="text-blue-300/60 text-xs">Entrada (R$)</Label>
              <Input type="number" step="0.01" value={form.entrada} onChange={e => setForm({...form, entrada: e.target.value})} placeholder="0,00" className="bg-[#0a1420] border-blue-900/30 text-emerald-400 text-sm" />
            </div>
            <div>
              <Label className="text-blue-300/60 text-xs">Saída (R$)</Label>
              <Input type="number" step="0.01" value={form.saida} onChange={e => setForm({...form, saida: e.target.value})} placeholder="0,00" className="bg-[#0a1420] border-blue-900/30 text-red-400 text-sm" />
            </div>
          </div>
          <Button onClick={handleSubmit} className="mt-4 bg-gradient-to-r from-blue-600 to-cyan-500 text-white">
            <Plus className="size-4 mr-1" /> Adicionar
          </Button>
        </CardContent>
      </Card>

      {/* Filter + Summary */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
        <Input type="month" value={mesFilter} onChange={e => setMesFilter(e.target.value)} className="bg-[#0a1420] border-blue-900/30 text-white text-sm w-48" />
        <div className="flex gap-4 text-sm">
          <span className="text-emerald-400 font-semibold">Entradas: {formatBRL(totalEntradas)}</span>
          <span className="text-red-400 font-semibold">Saídas: {formatBRL(totalSaidas)}</span>
          <span className={`font-bold ${totalEntradas - totalSaidas >= 0 ? "text-emerald-300" : "text-red-300"}`}>
            Saldo: {formatBRL(totalEntradas - totalSaidas)}
          </span>
        </div>
      </div>

      {/* Table */}
      <Card className="bg-[#0c1929] border-blue-900/30">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-blue-900/20 hover:bg-transparent">
                <TableHead className="text-blue-300/60">Data</TableHead>
                <TableHead className="text-blue-300/60">Tipo</TableHead>
                <TableHead className="text-blue-300/60">Categoria</TableHead>
                <TableHead className="text-blue-300/60">Descrição</TableHead>
                <TableHead className="text-blue-300/60 text-right">Entrada</TableHead>
                <TableHead className="text-blue-300/60 text-right">Saída</TableHead>
                <TableHead className="text-blue-300/60">Caixa</TableHead>
                <TableHead className="text-blue-300/60 w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-blue-400/40 py-8">Carregando...</TableCell></TableRow>
              ) : lancamentos.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-blue-400/40 py-8">Nenhum lançamento neste mês</TableCell></TableRow>
              ) : lancamentos.map((l) => (
                <TableRow key={l.id} className="border-blue-900/10 hover:bg-blue-900/10">
                  <TableCell className="text-white text-xs">{new Date(l.data + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-xs"><span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${l.tipo === "empresa" ? "bg-cyan-500/10 text-cyan-400" : "bg-blue-500/10 text-blue-400"}`}>{l.tipo}</span></TableCell>
                  <TableCell className="text-blue-200 text-xs">{l.categoria}</TableCell>
                  <TableCell className="text-blue-300/60 text-xs max-w-[200px] truncate">{l.descricao || "-"}</TableCell>
                  <TableCell className="text-right text-emerald-400 text-xs font-medium">{Number(l.entrada) > 0 ? formatBRL(Number(l.entrada)) : "-"}</TableCell>
                  <TableCell className="text-right text-red-400 text-xs font-medium">{Number(l.saida) > 0 ? formatBRL(Number(l.saida)) : "-"}</TableCell>
                  <TableCell className="text-blue-300/60 text-xs">{caixas.find(c => c.id === l.caixa_destino_id)?.nome || "-"}</TableCell>
                  <TableCell>
                    <button onClick={() => handleDelete(l.id)} className="text-red-400/40 hover:text-red-400 transition-colors">
                      <Trash2 className="size-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
