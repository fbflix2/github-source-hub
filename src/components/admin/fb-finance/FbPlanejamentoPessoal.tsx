import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Despesa {
  id: string; nome: string; valor: number; dia_vencimento: number;
  categoria: string; pago: boolean; mes_ref: string;
}

export function FbPlanejamentoPessoal() {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesRef, setMesRef] = useState(new Date().toISOString().slice(0, 7));
  const [form, setForm] = useState({ nome: "", valor: "", dia_vencimento: "1", categoria: "fixo" });

  useEffect(() => { fetchDespesas(); }, [mesRef]);

  const fetchDespesas = async () => {
    setLoading(true);
    const { data } = await supabase.from("fb_finance_despesas_planejadas" as any).select("*").eq("mes_ref", mesRef).order("dia_vencimento");
    if (data) setDespesas(data as any);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!form.nome || !form.valor) { toast({ title: "Preencha nome e valor", variant: "destructive" }); return; }
    const { error } = await supabase.from("fb_finance_despesas_planejadas" as any).insert({
      nome: form.nome, valor: parseFloat(form.valor), dia_vencimento: parseInt(form.dia_vencimento),
      categoria: form.categoria, mes_ref: mesRef,
    } as any);
    if (error) { toast({ title: "Erro", variant: "destructive" }); return; }
    setForm({ nome: "", valor: "", dia_vencimento: "1", categoria: "fixo" });
    fetchDespesas();
    toast({ title: "Despesa adicionada" });
  };

  const togglePago = async (id: string, pago: boolean) => {
    await supabase.from("fb_finance_despesas_planejadas" as any).update({ pago: !pago } as any).eq("id", id);
    fetchDespesas();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("fb_finance_despesas_planejadas" as any).delete().eq("id", id);
    fetchDespesas();
    toast({ title: "Removida" });
  };

  const total = despesas.reduce((s, d) => s + Number(d.valor), 0);
  const pago = despesas.filter(d => d.pago).reduce((s, d) => s + Number(d.valor), 0);
  const pendente = total - pago;
  const percentUsado = total > 0 ? (pago / total) * 100 : 0;

  // Chart data by categoria
  const catMap: Record<string, number> = {};
  despesas.forEach(d => { catMap[d.categoria] = (catMap[d.categoria] || 0) + Number(d.valor); });
  const chartData = Object.entries(catMap).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-white">Planejamento Mensal Pessoal</h1>

      <div className="flex items-center gap-4">
        <Input type="month" value={mesRef} onChange={e => setMesRef(e.target.value)} className="bg-[#0a1420] border-blue-900/30 text-white text-sm w-48" />
        <div className="flex gap-4 text-sm">
          <span className="text-blue-200">Total: <span className="font-bold">{formatBRL(total)}</span></span>
          <span className="text-emerald-400">Pago: <span className="font-bold">{formatBRL(pago)}</span></span>
          <span className="text-amber-400">Pendente: <span className="font-bold">{formatBRL(pendente)}</span></span>
          <span className="text-blue-300/60">{percentUsado.toFixed(0)}% pago</span>
        </div>
      </div>

      {/* Add Form */}
      <Card className="bg-[#0c1929] border-blue-900/30">
        <CardHeader><CardTitle className="text-sm text-blue-200">Nova Despesa</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="col-span-2">
              <Label className="text-blue-300/60 text-xs">Nome</Label>
              <Input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: Aluguel" className="bg-[#0a1420] border-blue-900/30 text-white text-sm" />
            </div>
            <div>
              <Label className="text-blue-300/60 text-xs">Valor (R$)</Label>
              <Input type="number" step="0.01" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} className="bg-[#0a1420] border-blue-900/30 text-white text-sm" />
            </div>
            <div>
              <Label className="text-blue-300/60 text-xs">Dia Vencimento</Label>
              <Input type="number" min="1" max="31" value={form.dia_vencimento} onChange={e => setForm({...form, dia_vencimento: e.target.value})} className="bg-[#0a1420] border-blue-900/30 text-white text-sm" />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAdd} className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white w-full">
                <Plus className="size-4 mr-1" /> Adicionar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Table */}
        <div className="lg:col-span-2">
          <Card className="bg-[#0c1929] border-blue-900/30">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-blue-900/20 hover:bg-transparent">
                    <TableHead className="text-blue-300/60 w-10">Pago</TableHead>
                    <TableHead className="text-blue-300/60">Nome</TableHead>
                    <TableHead className="text-blue-300/60 text-right">Valor</TableHead>
                    <TableHead className="text-blue-300/60 text-center">Dia</TableHead>
                    <TableHead className="text-blue-300/60">Categoria</TableHead>
                    <TableHead className="text-blue-300/60 w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-blue-400/40 py-8">Carregando...</TableCell></TableRow>
                  ) : despesas.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-blue-400/40 py-8">Nenhuma despesa</TableCell></TableRow>
                  ) : despesas.map((d) => (
                    <TableRow key={d.id} className={`border-blue-900/10 hover:bg-blue-900/10 ${d.pago ? "opacity-50" : ""}`}>
                      <TableCell>
                        <Checkbox checked={d.pago} onCheckedChange={() => togglePago(d.id, d.pago)} className="border-blue-700" />
                      </TableCell>
                      <TableCell className={`text-sm ${d.pago ? "line-through text-blue-400/40" : "text-white"}`}>{d.nome}</TableCell>
                      <TableCell className="text-right text-red-400 text-sm font-medium">{formatBRL(Number(d.valor))}</TableCell>
                      <TableCell className="text-center text-blue-300/60 text-sm">{d.dia_vencimento}</TableCell>
                      <TableCell className="text-blue-300/60 text-xs">{d.categoria}</TableCell>
                      <TableCell>
                        <button onClick={() => handleDelete(d.id)} className="text-red-400/40 hover:text-red-400"><Trash2 className="size-3.5" /></button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card className="bg-[#0c1929] border-blue-900/30">
          <CardHeader><CardTitle className="text-sm text-blue-200">Por Categoria</CardTitle></CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                  <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={v => `R$${v}`} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-blue-400/40 text-sm">Sem dados</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
