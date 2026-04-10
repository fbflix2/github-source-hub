import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildDisplayCaixaBalanceMap, getOperationalTotals } from "@/lib/fb-finance";
import type { FbPage } from "./FbFinanceDashboard";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface CaixaRow { id: string; nome: string; saldo_atual: number; tipo: string; alvo_percent: number }
interface LancamentoRow { id: string; data: string; tipo: string; categoria: string; descricao: string | null; entrada: number; saida: number; caixa_destino_id: string | null }
interface DespesaRow { id: string; nome: string; valor: number; pago: boolean; mes_ref: string; categoria: string }
interface CustoPessoalRow { id: string; nome: string; valor: number; ativo: boolean; categoria: string }
interface ConfigRow { distribution_percentages: Record<string, number> }

export function FbDashboardHome({ onNavigate }: { onNavigate: (p: FbPage) => void }) {
  const [caixas, setCaixas] = useState<CaixaRow[]>([]);
  const [lancamentos, setLancamentos] = useState<LancamentoRow[]>([]);
  const [allLancamentos, setAllLancamentos] = useState<LancamentoRow[]>([]);
  const [despesas, setDespesas] = useState<DespesaRow[]>([]);
  const [custosPessoais, setCustosPessoais] = useState<CustoPessoalRow[]>([]);
  const [config, setConfig] = useState<ConfigRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [capitalGiroPeriod, setCapitalGiroPeriod] = useState<"30" | "90">("30");

  const mesAtual = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const now = new Date();
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const [caixasRes, allLancRes, lancMesRes, despesasRes, configRes, custosRes] = await Promise.all([
      supabase.from("fb_finance_caixas").select("*"),
      supabase.from("fb_finance_lancamentos").select("*"),
      supabase.from("fb_finance_lancamentos").select("*").gte("data", startOfMonth),
      supabase.from("fb_finance_despesas_planejadas").select("*").eq("mes_ref", mesAtual),
      supabase.from("fb_finance_config").select("*").limit(1).single(),
      supabase.from("fb_finance_custos_pessoais").select("*").eq("ativo", true),
    ]);

    if (caixasRes.data) setCaixas(caixasRes.data as any);
    if (allLancRes.data) setAllLancamentos(allLancRes.data as any);
    if (lancMesRes.data) setLancamentos(lancMesRes.data as any);
    if (despesasRes.data) setDespesas(despesasRes.data as any);
    if (configRes.data) setConfig(configRes.data as any);
    if (custosRes.data) setCustosPessoais(custosRes.data as any);


    setLoading(false);
  };

  // Real calculations
  const caixaBalanceMap = buildDisplayCaixaBalanceMap(caixas, allLancamentos);
  const pessoal = caixas.filter(c => c.tipo === "pessoal");
  const empresa = caixas.filter(c => c.tipo === "empresa");
  const saldoPessoal = pessoal.reduce((s, c) => s + (caixaBalanceMap[c.id] ?? Number(c.saldo_atual)), 0);
  const saldoEmpresa = empresa.reduce((s, c) => s + (caixaBalanceMap[c.id] ?? Number(c.saldo_atual)), 0);
  const patrimonio = saldoPessoal + saldoEmpresa;

  // Receita mensal: apenas lançamentos de "Distribuição PJ" contam como receita real
  const lancDistPJ = lancamentos.filter(l => l.categoria === "Distribuição PJ");
  const receitaMensal = lancDistPJ.reduce((s, l) => s + Number(l.entrada || 0), 0);
  // Despesa mensal: todas as saídas do mês
  const despesaMensal = lancamentos.reduce((s, l) => s + Number(l.saida || 0), 0);
  // Saldo do mês: total entradas - total saídas (fluxo de caixa, não lucro)
  const totalEntradasMes = lancamentos.reduce((s, l) => s + Number(l.entrada || 0), 0);
  const saldoMes = totalEntradasMes - despesaMensal;

  // Growth vs last month
  const lastMonthLancs = allLancamentos.filter(l => {
    const lm = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const end = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const d = new Date(l.data);
    return d >= lm && d < end;
  });
  const lastMonthReceitaVal = lastMonthLancs.filter(l => l.categoria === "Distribuição PJ").reduce((s, l) => s + Number(l.entrada || 0), 0);
  const lastMonthDespesaVal = lastMonthLancs.reduce((s, l) => s + Number(l.saida || 0), 0);
  const receitaGrowth = lastMonthReceitaVal > 0 ? (((receitaMensal - lastMonthReceitaVal) / lastMonthReceitaVal) * 100).toFixed(1) : "0.0";
  const despesaDiff = despesaMensal - lastMonthDespesaVal;
  const patrimonioGrowth = lastMonthReceitaVal > 0 ? (((patrimonio - (patrimonio - saldoMes)) / Math.max(patrimonio - saldoMes, 1)) * 100).toFixed(1) : "0.0";

  // Allocation from config - dynamic
  const distPerc = config?.distribution_percentages || { operacional: 80, fundos_reserva: 15, capital_giro: 2, dia_a_dia: 2, dividendos: 1 };
  const allocColorMap: Record<string, string> = {
    capital_giro: "#93c5fd", fundos_reserva: "#1976d2", dividendos: "#eab308", operacional: "#40e56c",
    pro_labore: "#f5c542", dia_a_dia: "#94a3b8",
  };
  const fallbackColors = ["#c084fc", "#f97316", "#22d3ee", "#fb7185", "#a3e635", "#e879f9"];
  const keyToLabel = (key: string): string => {
    const map: Record<string, string> = { capital_giro: "Capital Giro", fundos_reserva: "Fundos", dividendos: "Dividendos", operacional: "Operacional", pro_labore: "Pro Labore", dia_a_dia: "Dia a Dia" };
    return map[key] || key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };
  let colorIdx = 0;
  const allocations = Object.entries(distPerc)
    .filter(([_, v]) => Number(v) > 0)
    .sort(([, a], [, b]) => Number(b) - Number(a))
    .map(([key, val]) => ({
      name: keyToLabel(key),
      percent: Number(val) || 0,
      color: allocColorMap[key] || fallbackColors[colorIdx++ % fallbackColors.length],
    }));

  // Capital de Giro chart - real daily data
  const days = capitalGiroPeriod === "30" ? 30 : 90;
  const today = new Date();
  const dayLabels: string[] = [];
  const dayValues: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    dayLabels.push(dateStr);
    const dayLancs = allLancamentos.filter(l => l.data === dateStr);
    const dayNet = dayLancs.reduce((s, l) => s + Number(l.entrada) - Number(l.saida), 0);
    dayValues.push(dayNet);
  }
  // Cumulative
  let cumulative = 0;
  const cumulativeValues = dayValues.map(v => { cumulative += v; return cumulative; });
  const maxCum = Math.max(...cumulativeValues.map(Math.abs), 1);
  const barHeights = cumulativeValues.map(v => Math.max(10, ((v + maxCum) / (2 * maxCum)) * 95));

  // Personal budget: Salário = saldo do Pro Labore (same as Planejamento Pessoal)
  const proLaboreCaixa = caixas.find(c => c.nome.toLowerCase().includes("pro labore") || c.nome.toLowerCase().includes("prolabore"));
  const salario = proLaboreCaixa ? Number(proLaboreCaixa.saldo_atual) : 0;

  // Despesas = custos pessoais ativos (same as Planejamento Pessoal)
  const totalDespPessoal = custosPessoais.reduce((s, d) => s + Number(d.valor), 0);

  // Pago/Pendente from despesas_planejadas do mês
  const despPago = despesas.filter(d => d.pago).reduce((s, d) => s + Number(d.valor), 0);
  const despPendente = despesas.filter(d => !d.pago).reduce((s, d) => s + Number(d.valor), 0);

  const disponivel = salario - totalDespPessoal;
  const percentUsado = salario > 0 ? ((totalDespPessoal / salario) * 100).toFixed(0) : "0";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1976d2]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs Centrais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Saldo Total */}
        <div className="p-4 rounded-xl border-l-4 border-[#1976d2] relative overflow-hidden" style={{ background: "#0e1c2d" }}>
          <p className="text-[10px] font-medium tracking-wide mb-1 uppercase text-[#c1c6d4]">Saldo Total</p>
          <h3 className="text-xl font-['Manrope'] font-extrabold text-[#d5e4fa]">{formatBRL(patrimonio)}</h3>
          <div className="mt-2 flex items-center gap-1">
            <span className={`text-[10px] font-bold flex items-center ${Number(patrimonioGrowth) >= 0 ? "text-[#40e56c]" : "text-[#ffb4a8]"}`}>
              <span className="material-symbols-outlined text-xs">{Number(patrimonioGrowth) >= 0 ? "trending_up" : "trending_down"}</span> {patrimonioGrowth}%
            </span>
            <span className="text-slate-500 text-[9px]">vs. mês anterior</span>
          </div>
        </div>

        {/* Receita Mensal */}
        <div className="p-4 rounded-xl border-l-4 border-[#40e56c] relative overflow-hidden" style={{ background: "#0e1c2d" }}>
          <p className="text-[10px] font-medium tracking-wide mb-1 uppercase text-[#c1c6d4]">Receita Mensal</p>
          <h3 className="text-xl font-['Manrope'] font-extrabold text-[#d5e4fa]">{formatBRL(receitaMensal)}</h3>
          <div className="mt-2 flex items-center gap-1">
            <span className={`text-[10px] font-bold flex items-center ${Number(receitaGrowth) >= 0 ? "text-[#40e56c]" : "text-[#ffb4a8]"}`}>
              <span className="material-symbols-outlined text-xs">{Number(receitaGrowth) >= 0 ? "arrow_upward" : "arrow_downward"}</span> {receitaGrowth}%
            </span>
            <span className="text-slate-500 text-[9px]">vs. mês anterior</span>
          </div>
        </div>

        {/* Despesa Mensal */}
        <div className="p-4 rounded-xl border-l-4 border-[#e71a0e] relative overflow-hidden" style={{ background: "#0e1c2d" }}>
          <p className="text-[10px] font-medium tracking-wide mb-1 uppercase text-[#c1c6d4]">Despesa Mensal</p>
          <h3 className="text-xl font-['Manrope'] font-extrabold text-[#d5e4fa]">{formatBRL(despesaMensal)}</h3>
          <div className="mt-2 flex items-center gap-1">
            <span className={`text-[10px] font-bold flex items-center ${despesaDiff <= 0 ? "text-[#40e56c]" : "text-[#ffb4a8]"}`}>
              <span className="material-symbols-outlined text-xs">{despesaDiff <= 0 ? "trending_down" : "warning"}</span> {formatBRL(Math.abs(despesaDiff))}
            </span>
            <span className="text-slate-500 text-[9px]">vs. mês anterior</span>
          </div>
        </div>

        {/* Saldo do Mês */}
        <div className="p-4 rounded-xl border-l-4 border-[#a5c8ff] relative overflow-hidden" style={{ background: "linear-gradient(to bottom right, #0e1c2d, rgba(25, 118, 210, 0.1))" }}>
          <p className="text-[10px] font-medium tracking-wide mb-1 uppercase text-[#c1c6d4]">Saldo do Mês</p>
          <h3 className={`text-xl font-['Manrope'] font-extrabold ${saldoMes >= 0 ? "text-[#40e56c]" : "text-[#ffb4a8]"}`}>{formatBRL(saldoMes)}</h3>
          <div className="mt-2">
            <span className="px-2 py-0.5 text-[9px] font-bold rounded-full uppercase" style={{ background: saldoMes >= 0 ? "rgba(64, 229, 108, 0.1)" : "rgba(255, 180, 168, 0.1)", color: saldoMes >= 0 ? "#40e56c" : "#ffb4a8" }}>
              Entradas − Saídas
            </span>
          </div>
        </div>
      </div>

      {/* Bento Grid: Alocação + Evolução */}
      <div className="grid grid-cols-12 gap-3">
        {/* Alocação Total */}
        <div className="col-span-12 lg:col-span-5 rounded-xl p-5 shadow-lg" style={{ background: "#0e1c2d" }}>
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-['Manrope'] font-bold text-sm text-[#d5e4fa]">Alocação Total</h4>
            <span className="material-symbols-outlined text-slate-500 cursor-pointer text-lg">more_vert</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-32 h-32 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-32 h-32">
                {(() => {
                  let offset = 0;
                  return allocations.map((a) => {
                    const dash = a.percent;
                    const gap = 100 - dash;
                    const el = (
                      <circle
                        key={a.name}
                        cx="18" cy="18" r="15.9155"
                        fill="none"
                        stroke={a.color}
                        strokeWidth="3.5"
                        strokeDasharray={`${dash} ${gap}`}
                        strokeDashoffset={-offset}
                        className="transition-all duration-500"
                      />
                    );
                    offset += dash;
                    return el;
                  });
                })()}
              </svg>
              <div className="absolute text-center">
                <span className="block text-lg font-black text-[#d5e4fa]">{allocations[0]?.percent}%</span>
                <span className="text-[8px] text-slate-500 uppercase font-bold">{allocations[0]?.name}</span>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              {allocations.map((a) => (
                <div key={a.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm" style={{ background: a.color }}></span>
                    <span className="text-xs font-medium text-[#d5e4fa]">{a.name}</span>
                  </div>
                  <span className="text-xs font-bold text-[#d5e4fa]">{a.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Evolução Capital de Giro */}
        <div className="col-span-12 lg:col-span-7 rounded-xl p-5 shadow-lg" style={{ background: "#0e1c2d" }}>
          <div className="flex justify-between items-center mb-3">
            <div>
              <h4 className="font-['Manrope'] font-bold text-sm text-[#d5e4fa]">Evolução do Capital de Giro</h4>
              <p className="text-[10px] text-slate-500">Últimos {capitalGiroPeriod} dias de performance</p>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setCapitalGiroPeriod("30")}
                className={`px-2 py-0.5 text-[9px] rounded-md border border-white/5 font-bold uppercase tracking-widest ${capitalGiroPeriod === "30" ? "text-[#c1c6d4]" : "text-slate-600"}`}
                style={{ background: "#122031" }}
              >30D</button>
              <button
                onClick={() => setCapitalGiroPeriod("90")}
                className={`px-2 py-0.5 text-[9px] rounded-md border border-white/5 font-bold uppercase tracking-widest ${capitalGiroPeriod === "90" ? "text-[#c1c6d4]" : "text-slate-600"}`}
                style={{ background: "#122031" }}
              >90D</button>
            </div>
          </div>
          <div className="h-28 w-full mt-4 relative flex items-end justify-between px-1">
            <div className="absolute bottom-0 left-0 w-full h-[60%]" style={{ background: "linear-gradient(to top, rgba(25, 118, 210, 0.2), transparent)" }}></div>
            {barHeights.map((h, i) => (
              <div
                key={i}
                className="rounded-t-sm"
                style={{
                  height: `${h}%`,
                  width: `${90 / barHeights.length}%`,
                  background: h > 75 ? "rgba(25, 118, 210, 1)" : h > 60 ? "rgba(25, 118, 210, 0.8)" : h > 50 ? "rgba(25, 118, 210, 0.6)" : "rgba(25, 118, 210, 0.4)",
                  borderTop: h > 70 ? "2px solid #a5c8ff" : "none",
                }}
              ></div>
            ))}
          </div>
          <div className="flex justify-between text-[9px] text-slate-600 mt-2 px-1 uppercase font-bold tracking-widest">
            <span>01 {new Date().toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
            <span>10 {new Date().toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
            <span>20 {new Date().toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
            <span>Hoje</span>
          </div>
        </div>
      </div>

      {/* Orçamento Mensal Pessoal */}
      <div className="rounded-xl p-5 shadow-lg" style={{ background: "#0e1c2d" }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center border" style={{ background: "rgba(165, 200, 255, 0.1)", borderColor: "rgba(165, 200, 255, 0.2)", color: "#a5c8ff" }}>
              <span className="material-symbols-outlined text-xl">person</span>
            </div>
            <div>
              <h4 className="font-['Manrope'] font-bold text-sm text-[#d5e4fa]">Orçamento Mensal Pessoal</h4>
              <p className="text-[10px] text-[#c1c6d4]">Gestão de Salário e Gastos Fixos</p>
            </div>
          </div>
          <div className="flex-1 max-w-xl px-2">
            <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest mb-1">
              <span className="text-[#40e56c]">Receita Pessoal: {formatBRL(salario)}</span>
              <span className="text-[#ffb4a8]">Despesas: {formatBRL(totalDespPessoal)} ({percentUsado}%)</span>
            </div>
            <div className="h-3 w-full rounded-full overflow-hidden flex" style={{ background: "#283647" }}>
              <div className="h-full bg-[#e71a0e]" style={{ width: `${Math.min(Number(percentUsado), 100)}%` }}></div>
            </div>
            <div className="flex gap-3 mt-1">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#40e56c]"></span>
                <span className="text-[9px] text-slate-500 uppercase font-bold">Pago: {formatBRL(despPago)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#e71a0e]"></span>
                <span className="text-[9px] text-slate-500 uppercase font-bold">Pendente: {formatBRL(despPendente)}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-lg font-['Manrope'] font-black ${disponivel >= 0 ? "text-[#40e56c]" : "text-[#ffb4a8]"}`}>{formatBRL(disponivel)}</span>
            <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Saldo Livre</p>
          </div>
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { page: "lancamentos" as FbPage, icon: "receipt_long", label: "Lançamentos", desc: "Registrar entradas/saídas" },
          { page: "caixas" as FbPage, icon: "account_balance_wallet", label: "Caixas", desc: "Gestão de envelopes" },
          { page: "distribuicao" as FbPage, icon: "pie_chart", label: "Distribuição", desc: "Alocação automática" },
          { page: "planejamento" as FbPage, icon: "event_note", label: "Planejamento", desc: "Orçamento pessoal" },
        ].map((item) => (
          <button
            key={item.page}
            onClick={() => onNavigate(item.page)}
            className="p-3 rounded-xl border border-white/5 text-left hover:border-[#1976d2]/30 hover:translate-y-[-2px] transition-all group"
            style={{ background: "#0e1c2d" }}
          >
            <span className="material-symbols-outlined text-[#1976d2] text-xl mb-2 block group-hover:scale-110 transition-transform">{item.icon}</span>
            <h5 className="font-['Manrope'] font-bold text-[#d5e4fa] text-xs">{item.label}</h5>
            <p className="text-[9px] text-slate-500 mt-0.5">{item.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
