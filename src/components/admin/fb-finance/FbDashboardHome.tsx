import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, DollarSign, Building2, Landmark } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { FbPage } from "./FbFinanceDashboard";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface CaixaRow { id: string; nome: string; saldo_atual: number; tipo: string; alvo_percent: number }

export function FbDashboardHome({ onNavigate }: { onNavigate: (p: FbPage) => void }) {
  const [caixas, setCaixas] = useState<CaixaRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data } = await supabase.from("fb_finance_caixas" as any).select("*");
    if (data) setCaixas(data as any);
    setLoading(false);
  };

  const pessoal = caixas.filter(c => c.tipo === "pessoal");
  const empresa = caixas.filter(c => c.tipo === "empresa");
  const saldoPessoal = pessoal.reduce((s, c) => s + Number(c.saldo_atual), 0);
  const saldoEmpresa = empresa.reduce((s, c) => s + Number(c.saldo_atual), 0);
  const patrimonio = saldoPessoal + saldoEmpresa;

  const pieData = caixas.filter(c => Number(c.saldo_atual) > 0).map(c => ({
    name: c.nome,
    value: Number(c.saldo_atual),
  }));
  const COLORS = ["#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1"];

  // Mock line data for Capital de Giro evolution
  const capitalGiro = caixas.find(c => c.nome === "Capital de Giro");
  const mockLineData = Array.from({ length: 30 }, (_, i) => ({
    dia: `D${i + 1}`,
    valor: Number(capitalGiro?.saldo_atual || 0) + Math.random() * 500 - 200,
  }));

  const orcamentoPessoalUsado = 45; // placeholder

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" /></div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-white">Dashboard Financeiro</h1>

      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[#0c1929] border-blue-900/30 shadow-lg">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-600/20"><DollarSign className="size-5 text-blue-400" /></div>
              <div>
                <p className="text-xs text-blue-300/50">Saldo Pessoal</p>
                <p className="text-xl font-bold text-white">{formatBRL(saldoPessoal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0c1929] border-blue-900/30 shadow-lg">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-600/20"><Building2 className="size-5 text-cyan-400" /></div>
              <div>
                <p className="text-xs text-blue-300/50">Saldo Empresa</p>
                <p className="text-xl font-bold text-white">{formatBRL(saldoEmpresa)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0c1929] border-blue-900/30 shadow-lg">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-600/20"><Landmark className="size-5 text-emerald-400" /></div>
              <div>
                <p className="text-xs text-blue-300/50">Patrimônio Total</p>
                <p className="text-xl font-bold text-white">{formatBRL(patrimonio)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie Chart */}
        <Card className="bg-[#0c1929] border-blue-900/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-200">Alocação dos Caixas</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name.substring(0, 12)} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-blue-400/40 text-sm">
                Adicione saldos aos caixas para visualizar
              </div>
            )}
          </CardContent>
        </Card>

        {/* Line Chart */}
        <Card className="bg-[#0c1929] border-blue-900/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-200">Evolução Capital de Giro (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={mockLineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                <XAxis dataKey="dia" tick={{ fill: "#64748b", fontSize: 10 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Line type="monotone" dataKey="valor" stroke="#06b6d4" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[#0c1929] border-blue-900/30">
          <CardContent className="p-5">
            <p className="text-xs text-blue-300/50 mb-2">Orçamento Pessoal Usado</p>
            <Progress value={orcamentoPessoalUsado} className="h-2.5 bg-blue-950" />
            <p className="text-right text-xs text-blue-300/60 mt-1">{orcamentoPessoalUsado}%</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0c1929] border-blue-900/30">
          <CardContent className="p-5 flex items-center gap-3">
            <TrendingUp className="size-5 text-emerald-400" />
            <div>
              <p className="text-xs text-blue-300/50">Crescimento Giro (mês)</p>
              <p className="text-lg font-bold text-emerald-400">+0,0%</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0c1929] border-blue-900/30">
          <CardContent className="p-5 flex items-center gap-3">
            <DollarSign className="size-5 text-amber-400" />
            <div>
              <p className="text-xs text-blue-300/50">Dividendos Acumulados</p>
              <p className="text-lg font-bold text-amber-400">{formatBRL(caixas.find(c => c.nome === "Dividendos")?.saldo_atual || 0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Nav */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Lançamentos", page: "lancamentos" as FbPage, color: "from-blue-600 to-blue-500" },
          { label: "Caixas", page: "caixas" as FbPage, color: "from-cyan-600 to-cyan-500" },
          { label: "Distribuição PJ", page: "distribuicao" as FbPage, color: "from-emerald-600 to-emerald-500" },
          { label: "Relatórios", page: "relatorios" as FbPage, color: "from-purple-600 to-purple-500" },
        ].map((item) => (
          <button
            key={item.page}
            onClick={() => onNavigate(item.page)}
            className={`p-4 rounded-xl bg-gradient-to-br ${item.color} text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
