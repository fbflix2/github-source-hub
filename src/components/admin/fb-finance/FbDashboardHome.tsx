import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FbPage } from "./FbFinanceDashboard";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface CaixaRow { id: string; nome: string; saldo_atual: number; tipo: string; alvo_percent: number }

export function FbDashboardHome({ onNavigate }: { onNavigate: (p: FbPage) => void }) {
  const [caixas, setCaixas] = useState<CaixaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [capitalGiroPeriod, setCapitalGiroPeriod] = useState<"30" | "90">("30");

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

  // Mock data for demonstration
  const receitaMensal = 30000;
  const despesaMensal = 12400;
  const lucroLiquido = receitaMensal - despesaMensal;
  const margem = ((lucroLiquido / receitaMensal) * 100).toFixed(1);

  // Allocation percentages
  const allocations = [
    { name: "Operacional", percent: 80, color: "#40e56c" },
    { name: "Fundos", percent: 15, color: "#1976d2" },
    { name: "Capital Giro", percent: 2, color: "#93c5fd" },
    { name: "Dia a Dia", percent: 2, color: "#94a3b8" },
    { name: "Dividendos", percent: 1, color: "#eab308" },
  ];

  // Mock bar chart data
  const barCount = capitalGiroPeriod === "30" ? 15 : 30;
  const barHeights = Array.from({ length: barCount }, (_, i) => 40 + (i / barCount) * 55 + Math.random() * 5);

  // Personal budget
  const salario = 7000;
  const aluguel = 2000;
  const outrosGastos = 2200;
  const utilizado = aluguel + outrosGastos;
  const disponivel = salario - utilizado;
  const percentUsado = ((utilizado / salario) * 100).toFixed(0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1976d2]" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* KPIs Centrais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Saldo Total */}
        <div className="p-6 rounded-xl border-l-4 border-[#1976d2] relative overflow-hidden" style={{ background: "#0e1c2d" }}>
          <div className="absolute right-[-10%] top-[-10%] opacity-10">
            <span className="material-symbols-outlined text-[80px] text-[#a5c8ff]">account_balance</span>
          </div>
          <p className="text-sm font-medium tracking-wide mb-2 uppercase text-[#c1c6d4]">Saldo Total</p>
          <h3 className="text-3xl font-['Manrope'] font-extrabold text-[#d5e4fa]">{formatBRL(patrimonio || 45600)}</h3>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[#40e56c] text-xs font-bold flex items-center">
              <span className="material-symbols-outlined text-sm">trending_up</span> +2.4%
            </span>
            <span className="text-slate-500 text-[10px]">vs. mês anterior</span>
          </div>
        </div>

        {/* Receita Mensal */}
        <div className="p-6 rounded-xl border-l-4 border-[#40e56c] relative overflow-hidden" style={{ background: "#0e1c2d" }}>
          <p className="text-sm font-medium tracking-wide mb-2 uppercase text-[#c1c6d4]">Receita Mensal</p>
          <h3 className="text-3xl font-['Manrope'] font-extrabold text-[#d5e4fa]">{formatBRL(receitaMensal)}</h3>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[#40e56c] text-xs font-bold flex items-center">
              <span className="material-symbols-outlined text-sm">arrow_upward</span> Meta: 95%
            </span>
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "#283647" }}>
              <div className="h-full bg-[#40e56c]" style={{ width: "95%" }}></div>
            </div>
          </div>
        </div>

        {/* Despesa Mensal */}
        <div className="p-6 rounded-xl border-l-4 border-[#e71a0e] relative overflow-hidden" style={{ background: "#0e1c2d" }}>
          <p className="text-sm font-medium tracking-wide mb-2 uppercase text-[#c1c6d4]">Despesa Mensal</p>
          <h3 className="text-3xl font-['Manrope'] font-extrabold text-[#d5e4fa]">{formatBRL(despesaMensal)}</h3>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[#ffb4a8] text-xs font-bold flex items-center">
              <span className="material-symbols-outlined text-sm">warning</span> -R$ 1.200
            </span>
            <span className="text-slate-500 text-[10px]">Projeção excedida</span>
          </div>
        </div>

        {/* Lucro Líquido */}
        <div className="p-6 rounded-xl border-l-4 border-[#a5c8ff] relative overflow-hidden" style={{ background: "linear-gradient(to bottom right, #0e1c2d, rgba(25, 118, 210, 0.1))" }}>
          <p className="text-sm font-medium tracking-wide mb-2 uppercase text-[#c1c6d4]">Lucro Líquido</p>
          <h3 className="text-3xl font-['Manrope'] font-extrabold text-[#40e56c]">{formatBRL(lucroLiquido)}</h3>
          <div className="mt-4">
            <span className="px-2 py-1 text-[10px] font-bold rounded-full uppercase" style={{ background: "rgba(64, 229, 108, 0.1)", color: "#40e56c" }}>
              Margem: {margem}%
            </span>
          </div>
        </div>
      </div>

      {/* Bento Grid: Alocação + Evolução */}
      <div className="grid grid-cols-12 gap-6">
        {/* Alocação Total */}
        <div className="col-span-12 lg:col-span-5 rounded-2xl p-8 shadow-lg" style={{ background: "#0e1c2d" }}>
          <div className="flex justify-between items-center mb-8">
            <h4 className="font-['Manrope'] font-bold text-xl text-[#d5e4fa]">Alocação Total</h4>
            <span className="material-symbols-outlined text-slate-500 cursor-pointer">more_vert</span>
          </div>
          <div className="flex items-center justify-between gap-8">
            {/* Donut chart simulation */}
            <div className="relative w-48 h-48 flex items-center justify-center flex-shrink-0">
              <div className="absolute inset-0 rounded-full border-[16px]" style={{ borderColor: "#283647" }}></div>
              <div className="absolute inset-0 rounded-full border-[16px] border-l-transparent border-t-transparent border-r-transparent transform rotate-45" style={{ borderBottomColor: "#40e56c" }}></div>
              <div className="absolute inset-0 rounded-full border-[16px] border-b-transparent border-r-transparent border-t-transparent transform -rotate-12" style={{ borderLeftColor: "#1976d2" }}></div>
              <div className="text-center">
                <span className="block text-2xl font-black text-[#d5e4fa]">80%</span>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Operacional</span>
              </div>
            </div>
            {/* Legend */}
            <div className="flex-1 space-y-4">
              {allocations.map((a) => (
                <div key={a.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-sm" style={{ background: a.color }}></span>
                    <span className="text-sm font-medium text-[#d5e4fa]">{a.name}</span>
                  </div>
                  <span className="text-sm font-bold text-[#d5e4fa]">{a.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Evolução Capital de Giro */}
        <div className="col-span-12 lg:col-span-7 rounded-2xl p-8 shadow-lg" style={{ background: "#0e1c2d" }}>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h4 className="font-['Manrope'] font-bold text-xl text-[#d5e4fa]">Evolução do Capital de Giro</h4>
              <p className="text-xs text-slate-500">Últimos {capitalGiroPeriod} dias de performance</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCapitalGiroPeriod("30")}
                className={`px-3 py-1 text-[10px] rounded-lg border border-white/5 font-bold uppercase tracking-widest ${capitalGiroPeriod === "30" ? "text-[#c1c6d4]" : "text-slate-600"}`}
                style={{ background: "#122031" }}
              >
                30D
              </button>
              <button
                onClick={() => setCapitalGiroPeriod("90")}
                className={`px-3 py-1 text-[10px] rounded-lg border border-white/5 font-bold uppercase tracking-widest ${capitalGiroPeriod === "90" ? "text-[#c1c6d4]" : "text-slate-600"}`}
                style={{ background: "#122031" }}
              >
                90D
              </button>
            </div>
          </div>
          <div className="h-48 w-full mt-10 relative flex items-end justify-between px-2">
            <div className="absolute bottom-0 left-0 w-full h-[60%]" style={{ background: "linear-gradient(to top, rgba(25, 118, 210, 0.2), transparent)" }}></div>
            {barHeights.map((h, i) => (
              <div
                key={i}
                className="rounded-t-sm"
                style={{
                  height: `${h}%`,
                  width: `${90 / barCount}%`,
                  background: h > 75 ? "rgba(25, 118, 210, 1)" : h > 60 ? "rgba(25, 118, 210, 0.8)" : h > 50 ? "rgba(25, 118, 210, 0.6)" : "rgba(25, 118, 210, 0.4)",
                  borderTop: h > 70 ? "2px solid #a5c8ff" : "none",
                }}
              ></div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-slate-600 mt-4 px-2 uppercase font-bold tracking-widest">
            <span>01 {new Date().toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
            <span>10 {new Date().toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
            <span>20 {new Date().toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
            <span>Hoje</span>
          </div>
        </div>
      </div>

      {/* Orçamento Mensal Pessoal */}
      <div className="rounded-2xl p-8 shadow-lg" style={{ background: "#0e1c2d" }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-full flex items-center justify-center border" style={{ background: "rgba(165, 200, 255, 0.1)", borderColor: "rgba(165, 200, 255, 0.2)", color: "#a5c8ff" }}>
              <span className="material-symbols-outlined text-3xl">person</span>
            </div>
            <div>
              <h4 className="font-['Manrope'] font-bold text-xl text-[#d5e4fa]">Orçamento Mensal Pessoal</h4>
              <p className="text-sm text-[#c1c6d4]">Gestão de Salário e Gastos Fixos</p>
            </div>
          </div>
          <div className="flex-1 max-w-2xl px-4">
            <div className="flex justify-between text-xs font-bold uppercase tracking-widest mb-2">
              <span className="text-[#40e56c]">Salário: {formatBRL(salario)}</span>
              <span className="text-[#ffb4a8]">Utilizado: {formatBRL(utilizado)} ({percentUsado}%)</span>
            </div>
            <div className="h-4 w-full rounded-full overflow-hidden flex" style={{ background: "#283647" }}>
              <div className="h-full bg-blue-400" style={{ width: `${(aluguel / salario) * 100}%` }} title={`Aluguel: ${formatBRL(aluguel)}`}></div>
              <div className="h-full bg-blue-600" style={{ width: `${(outrosGastos / salario) * 100}%` }} title={`Outros: ${formatBRL(outrosGastos)}`}></div>
              <div className="h-full flex-1" style={{ background: "#283647" }}></div>
            </div>
            <div className="flex gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Aluguel ({formatBRL(aluguel).replace("R$\u00a0", "R$ ")})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Outros Gastos ({formatBRL(outrosGastos).replace("R$\u00a0", "R$ ")})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: "#283647" }}></span>
                <span className="text-[10px] text-slate-500 uppercase font-bold">Disponível ({formatBRL(disponivel).replace("R$\u00a0", "R$ ")})</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-['Manrope'] font-black text-[#d5e4fa]">{formatBRL(disponivel)}</span>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Saldo Livre Estimado</p>
          </div>
        </div>
      </div>
    </div>
  );
}
