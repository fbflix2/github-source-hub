import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from "recharts";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Lancamento { data: string; entrada: number; saida: number; categoria: string }

export function FbRelatorios() {
  const [mesRef, setMesRef] = useState(new Date().toISOString().slice(0, 7));
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("fb_finance_lancamentos" as any)
      .select("data, entrada, saida, categoria")
      .gte("data", `${mesRef}-01`).lte("data", `${mesRef}-31`)
      .order("data")
      .then(({ data }) => {
        if (data) setLancamentos(data as any);
        setLoading(false);
      });
  }, [mesRef]);

  // Daily aggregation
  const dailyMap: Record<string, { entradas: number; saidas: number }> = {};
  lancamentos.forEach(l => {
    if (!dailyMap[l.data]) dailyMap[l.data] = { entradas: 0, saidas: 0 };
    dailyMap[l.data].entradas += Number(l.entrada);
    dailyMap[l.data].saidas += Number(l.saida);
  });
  const dailyData = Object.entries(dailyMap).map(([data, vals]) => ({
    data: new Date(data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit" }),
    ...vals,
  }));

  // Category aggregation
  const catMap: Record<string, { entradas: number; saidas: number }> = {};
  lancamentos.forEach(l => {
    if (!catMap[l.categoria]) catMap[l.categoria] = { entradas: 0, saidas: 0 };
    catMap[l.categoria].entradas += Number(l.entrada);
    catMap[l.categoria].saidas += Number(l.saida);
  });
  const catData = Object.entries(catMap).map(([name, vals]) => ({ name, ...vals })).sort((a, b) => b.saidas - a.saidas);

  const totalEntradas = lancamentos.reduce((s, l) => s + Number(l.entrada), 0);
  const totalSaidas = lancamentos.reduce((s, l) => s + Number(l.saida), 0);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" /></div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Relatórios</h1>
        <Input type="month" value={mesRef} onChange={e => setMesRef(e.target.value)} className="bg-[#0a1420] border-blue-900/30 text-white text-sm w-48" />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-[#0c1929] border-blue-900/30">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-blue-300/50">Total Entradas</p>
            <p className="text-xl font-bold text-emerald-400">{formatBRL(totalEntradas)}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0c1929] border-blue-900/30">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-blue-300/50">Total Saídas</p>
            <p className="text-xl font-bold text-red-400">{formatBRL(totalSaidas)}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0c1929] border-blue-900/30">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-blue-300/50">Saldo Período</p>
            <p className={`text-xl font-bold ${totalEntradas - totalSaidas >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatBRL(totalEntradas - totalSaidas)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Entradas vs Saídas por dia */}
        <Card className="bg-[#0c1929] border-blue-900/30">
          <CardHeader><CardTitle className="text-sm text-blue-200">Entradas vs Saídas (diário)</CardTitle></CardHeader>
          <CardContent>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                  <XAxis dataKey="data" tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Line type="monotone" dataKey="entradas" stroke="#10b981" strokeWidth={2} dot={false} name="Entradas" />
                  <Line type="monotone" dataKey="saidas" stroke="#ef4444" strokeWidth={2} dot={false} name="Saídas" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-blue-400/40 text-sm">Sem dados no período</div>
            )}
          </CardContent>
        </Card>

        {/* Top despesas por categoria */}
        <Card className="bg-[#0c1929] border-blue-900/30">
          <CardHeader><CardTitle className="text-sm text-blue-200">Top Despesas por Categoria</CardTitle></CardHeader>
          <CardContent>
            {catData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={catData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                  <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} width={80} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Bar dataKey="saidas" fill="#ef4444" radius={[0, 4, 4, 0]} name="Saídas" />
                  <Bar dataKey="entradas" fill="#10b981" radius={[0, 4, 4, 0]} name="Entradas" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-blue-400/40 text-sm">Sem dados no período</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
