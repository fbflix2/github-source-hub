import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Lancamento {
  id: string;
  data: string;
  entrada: number;
  saida: number;
  categoria: string;
  descricao: string | null;
  tipo: string;
}

const ITEMS_PER_PAGE = 10;

const periodOptions = [
  { label: "Últimos 12 meses", value: "12m" },
  { label: "Este Ano", value: "year" },
  { label: "Mês Anterior", value: "lastMonth" },
  { label: "Últimos 3 meses", value: "3m" },
];

const categoryColors: Record<string, { bg: string; text: string; icon: string }> = {
  vendas: { bg: "bg-[#1976d2]/10", text: "text-[#1976d2]", icon: "trending_up" },
  salario: { bg: "bg-[#40e56c]/10", text: "text-[#40e56c]", icon: "payments" },
  servicos: { bg: "bg-[#1976d2]/10", text: "text-[#1976d2]", icon: "work" },
  investimentos: { bg: "bg-[#1976d2]/10", text: "text-[#1976d2]", icon: "trending_up" },
  alimentacao: { bg: "bg-[#8b919e]/10", text: "text-[#8b919e]", icon: "shopping_cart" },
  moradia: { bg: "bg-[#e71a0e]/10", text: "text-[#e71a0e]", icon: "home" },
  transporte: { bg: "bg-[#e71a0e]/10", text: "text-[#e71a0e]", icon: "directions_car" },
  energia: { bg: "bg-[#e71a0e]/10", text: "text-[#e71a0e]", icon: "bolt" },
  outros: { bg: "bg-[#8b919e]/10", text: "text-[#8b919e]", icon: "more_horiz" },
};

function getDateRange(period: string): { from: string; to: string } {
  const now = new Date();
  let from: Date;
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  switch (period) {
    case "year":
      from = new Date(now.getFullYear(), 0, 1);
      break;
    case "lastMonth":
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      break;
    case "3m":
      from = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      break;
    default: // 12m
      from = new Date(now.getFullYear(), now.getMonth() - 12, 1);
  }

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function getCatStyle(cat: string) {
  return categoryColors[cat.toLowerCase()] || categoryColors.outros;
}

export function FbRelatorios() {
  const [period, setPeriod] = useState("12m");
  const [catFilter, setCatFilter] = useState("all");
  const [flowType, setFlowType] = useState<"all" | "receitas" | "despesas">("all");
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
    const { from, to } = getDateRange(period);
    supabase
      .from("fb_finance_lancamentos" as any)
      .select("id, data, entrada, saida, categoria, descricao, tipo")
      .gte("data", from)
      .lte("data", to)
      .order("data", { ascending: false })
      .then(({ data }) => {
        if (data) setLancamentos(data as any);
        setLoading(false);
      });
  }, [period]);

  // Filter
  let filtered = lancamentos;
  if (catFilter !== "all") filtered = filtered.filter((l) => l.categoria === catFilter);
  if (flowType === "receitas") filtered = filtered.filter((l) => Number(l.entrada) > 0);
  if (flowType === "despesas") filtered = filtered.filter((l) => Number(l.saida) > 0);

  const totalEntradas = filtered.reduce((s, l) => s + Number(l.entrada), 0);
  const totalSaidas = filtered.reduce((s, l) => s + Number(l.saida), 0);
  const saldoPeriodo = totalEntradas - totalSaidas;
  const growthPercent = totalSaidas > 0 ? ((totalEntradas / totalSaidas - 1) * 100).toFixed(1) : "0";

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // Monthly aggregation for bar chart
  const monthlyMap: Record<string, { entradas: number; saidas: number }> = {};
  lancamentos.forEach((l) => {
    const m = l.data.slice(0, 7);
    if (!monthlyMap[m]) monthlyMap[m] = { entradas: 0, saidas: 0 };
    monthlyMap[m].entradas += Number(l.entrada);
    monthlyMap[m].saidas += Number(l.saida);
  });
  const monthlyData = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([m, v]) => ({
      label: new Date(m + "-15").toLocaleDateString("pt-BR", { month: "short" }),
      ...v,
    }));
  const maxMonthly = Math.max(...monthlyData.map((d) => Math.max(d.entradas, d.saidas)), 1);

  // Category aggregation for donut
  const catMap: Record<string, number> = {};
  filtered.forEach((l) => {
    const cat = l.categoria || "outros";
    catMap[cat] = (catMap[cat] || 0) + Number(l.saida) + Number(l.entrada);
  });
  const catTotal = Object.values(catMap).reduce((a, b) => a + b, 0) || 1;
  const catEntries = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const donutColors = ["#1976d2", "#40e56c", "#e71a0e", "#a5c8ff", "#8b919e"];
  let cumulativePercent = 0;
  const circumference = 2 * Math.PI * 40;

  // Unique categories for filter
  const allCats = [...new Set(lancamentos.map((l) => l.categoria))].sort();

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1976d2]" />
      </div>
    );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-['Manrope'] font-extrabold tracking-tight text-[#d5e4fa] mb-2">
            Relatórios / Histórico
          </h1>
          <p className="text-[#c1c6d4] max-w-2xl text-sm">
            Analise sua performance financeira com visões detalhadas de fluxo de caixa e distribuição de ativos.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="px-5 py-2.5 bg-[#1d2b3c] text-[#d5e4fa] rounded-xl flex items-center gap-2 hover:bg-[#283647] transition-colors border border-[#414752]/20">
            <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
            <span className="text-sm font-semibold">PDF</span>
          </button>
          <button className="px-5 py-2.5 bg-[#1d2b3c] text-[#d5e4fa] rounded-xl flex items-center gap-2 hover:bg-[#283647] transition-colors border border-[#414752]/20">
            <span className="material-symbols-outlined text-sm">table_view</span>
            <span className="text-sm font-semibold">Excel</span>
          </button>
        </div>
      </header>

      {/* Filters */}
      <section className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 bg-[#0e1c2d] rounded-xl p-6 flex flex-wrap items-center gap-6 border border-white/5 shadow-inner">
          {/* Period */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-[#8b919e]">Período</label>
            <div className="flex items-center gap-2 bg-[#283647] px-3 py-2 rounded-lg">
              <span className="material-symbols-outlined text-[#a5c8ff] text-sm">calendar_month</span>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="bg-transparent border-none text-sm font-medium focus:ring-0 text-[#d5e4fa] pr-8 outline-none"
              >
                {periodOptions.map((o) => (
                  <option key={o.value} value={o.value} className="bg-[#122031]">
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {/* Category */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-[#8b919e]">Categoria</label>
            <div className="flex items-center gap-2 bg-[#283647] px-3 py-2 rounded-lg">
              <span className="material-symbols-outlined text-[#40e56c] text-sm">category</span>
              <select
                value={catFilter}
                onChange={(e) => { setCatFilter(e.target.value); setPage(1); }}
                className="bg-transparent border-none text-sm font-medium focus:ring-0 text-[#d5e4fa] pr-8 outline-none"
              >
                <option value="all" className="bg-[#122031]">Todas Categorias</option>
                {allCats.map((c) => (
                  <option key={c} value={c} className="bg-[#122031]">{c}</option>
                ))}
              </select>
            </div>
          </div>
          {/* Flow type */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-[#8b919e]">Tipo de Fluxo</label>
            <div className="flex items-center gap-4 py-2">
              {(["all", "receitas", "despesas"] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer group" onClick={() => { setFlowType(t); setPage(1); }}>
                  <div className={`w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center ${
                    flowType === t ? "border-[#a5c8ff]" : "border-[#8b919e] group-hover:border-[#a5c8ff]"
                  }`}>
                    {flowType === t && <div className="w-2 h-2 rounded-full bg-[#a5c8ff]" />}
                  </div>
                  <span className={`text-xs font-semibold ${flowType === t ? "text-[#d5e4fa]" : "text-[#8b919e]"}`}>
                    {t === "all" ? "Todos" : t === "receitas" ? "Receitas" : "Despesas"}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
        {/* Saldo card */}
        <div className="bg-[#1976d2]/10 border border-[#1976d2]/20 rounded-xl p-6 flex flex-col justify-center">
          <span className="text-[10px] uppercase tracking-widest font-bold text-[#1976d2] mb-1">Saldo do Período</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-['Manrope'] font-bold text-[#d5e4fa]">{formatBRL(saldoPeriodo)}</span>
            <span className={`text-xs font-bold ${saldoPeriodo >= 0 ? "text-[#40e56c]" : "text-[#e71a0e]"}`}>
              {saldoPeriodo >= 0 ? "+" : ""}{growthPercent}%
            </span>
          </div>
        </div>
      </section>

      {/* Charts Grid */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Bar Chart */}
        <div className="xl:col-span-8 bg-[#0e1c2d] rounded-xl p-8 border border-white/5">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-lg font-['Manrope'] font-bold text-[#d5e4fa]">Fluxo de Caixa Anual</h3>
              <p className="text-xs text-[#c1c6d4]">Comparativo de Entradas vs Saídas</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-[#1976d2]" />
                <span className="text-[10px] font-bold text-[#8b919e] uppercase">Receitas</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-sm bg-[#e71a0e]" />
                <span className="text-[10px] font-bold text-[#8b919e] uppercase">Despesas</span>
              </div>
            </div>
          </div>
          <div className="h-64 flex items-end justify-between gap-4 px-2">
            {monthlyData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end gap-1 h-full">
                  <div
                    className="w-1/2 bg-[#1976d2] rounded-t-sm transition-all"
                    style={{ height: `${(d.entradas / maxMonthly) * 100}%`, opacity: 0.7 }}
                  />
                  <div
                    className="w-1/2 bg-[#e71a0e] rounded-t-sm transition-all"
                    style={{ height: `${(d.saidas / maxMonthly) * 100}%`, opacity: 0.7 }}
                  />
                </div>
                <span className="text-[10px] font-medium text-[#8b919e] capitalize">{d.label}</span>
              </div>
            ))}
            {monthlyData.length === 0 && (
              <div className="w-full h-full flex items-center justify-center text-[#414752] text-sm">
                Sem dados no período
              </div>
            )}
          </div>
        </div>

        {/* Donut Chart */}
        <div className="xl:col-span-4 bg-[#122031] rounded-xl p-8 border border-white/5 flex flex-col">
          <h3 className="text-lg font-['Manrope'] font-bold text-[#d5e4fa] mb-1">Categorias</h3>
          <p className="text-xs text-[#c1c6d4] mb-8">Distribuição de despesas</p>
          <div className="relative flex-1 flex items-center justify-center">
            <svg className="w-48 h-48 transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="transparent" stroke="#1d2b3c" strokeWidth="12" />
              {catEntries.map(([, val], i) => {
                const pct = val / catTotal;
                const dashLen = pct * circumference;
                const offset = -cumulativePercent * circumference;
                cumulativePercent += pct;
                return (
                  <circle
                    key={i}
                    cx="50" cy="50" r="40"
                    fill="transparent"
                    stroke={donutColors[i]}
                    strokeWidth="12"
                    strokeDasharray={`${dashLen} ${circumference}`}
                    strokeDashoffset={offset}
                  />
                );
              })}
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-xs font-bold text-[#8b919e]">Total</span>
              <span className="text-xl font-['Manrope'] font-bold text-[#d5e4fa]">100%</span>
            </div>
          </div>
          <div className="mt-8 space-y-3">
            {catEntries.map(([cat, val], i) => (
              <div key={cat} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: donutColors[i] }} />
                  <span className="text-xs font-medium text-[#c1c6d4] capitalize">{cat}</span>
                </div>
                <span className="text-xs font-bold text-[#d5e4fa]">{((val / catTotal) * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* History Table */}
      <section className="bg-[#0e1c2d] rounded-xl border border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-lg font-['Manrope'] font-bold text-[#d5e4fa]">Histórico de Transações</h3>
          <div className="flex gap-2">
            <button className="p-2 hover:bg-white/5 rounded-lg text-[#8b919e]">
              <span className="material-symbols-outlined">filter_list</span>
            </button>
            <button className="p-2 hover:bg-white/5 rounded-lg text-[#8b919e]">
              <span className="material-symbols-outlined">more_vert</span>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#122031]/30">
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-[#8b919e]">Data</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-[#8b919e]">Descrição</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-[#8b919e]">Categoria</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-[#8b919e]">Tipo</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-[#8b919e] text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paginated.map((l) => {
                const isReceita = Number(l.entrada) > 0;
                const valor = isReceita ? Number(l.entrada) : Number(l.saida);
                const style = getCatStyle(l.categoria);
                return (
                  <tr key={l.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-[#c1c6d4]">
                      {new Date(l.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg ${isReceita ? "bg-[#40e56c]/10" : "bg-[#e71a0e]/10"} flex items-center justify-center`}>
                          <span
                            className={`material-symbols-outlined text-sm ${isReceita ? "text-[#40e56c]" : "text-[#e71a0e]"}`}
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            {style.icon}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-[#d5e4fa]">{l.descricao || l.categoria}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 ${style.bg} ${style.text} text-[10px] font-bold rounded-full uppercase`}>
                        {l.categoria}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#8b919e] capitalize">{l.tipo}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-sm font-bold ${isReceita ? "text-[#40e56c]" : "text-[#e71a0e]"}`}>
                        {isReceita ? "+" : "-"} {formatBRL(valor)}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[#414752] text-sm">
                    Nenhum lançamento encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="p-4 border-t border-white/5 flex items-center justify-between">
          <p className="text-[10px] text-[#8b919e] font-medium">
            Exibindo {Math.min(paginated.length, ITEMS_PER_PAGE)} de {filtered.length} registros
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-white/10 text-[#8b919e] hover:text-[#d5e4fa] hover:border-[#1976d2] transition-all disabled:opacity-30"
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg border text-xs font-bold transition-all ${
                  page === p
                    ? "border-[#1976d2] bg-[#1976d2]/10 text-[#1976d2]"
                    : "border-white/10 text-[#8b919e] hover:text-[#d5e4fa] hover:border-[#1976d2]"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-white/10 text-[#8b919e] hover:text-[#d5e4fa] hover:border-[#1976d2] transition-all disabled:opacity-30"
            >
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
