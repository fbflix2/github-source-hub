import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { FbPersonalDistribution } from "./FbPersonalDistribution";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Despesa {
  id: string; nome: string; valor: number; dia_vencimento: number;
  categoria: string; pago: boolean; mes_ref: string;
}

const catIcons: Record<string, { icon: string; color: string; bg: string }> = {
  fixo: { icon: "home", color: "text-blue-400", bg: "bg-blue-500/10" },
  alimentacao: { icon: "restaurant", color: "text-orange-400", bg: "bg-orange-500/10" },
  lazer: { icon: "celebration", color: "text-purple-400", bg: "bg-purple-500/10" },
  transporte: { icon: "directions_car", color: "text-cyan-400", bg: "bg-cyan-500/10" },
  saude: { icon: "favorite", color: "text-red-400", bg: "bg-red-500/10" },
  educacao: { icon: "school", color: "text-yellow-400", bg: "bg-yellow-500/10" },
  outros: { icon: "payments", color: "text-green-400", bg: "bg-green-500/10" },
  variavel: { icon: "shopping_cart", color: "text-amber-400", bg: "bg-amber-500/10" },
};

function getCat(cat: string) {
  return catIcons[cat.toLowerCase()] || catIcons.outros;
}

export function FbPlanejamentoPessoal() {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesRef, setMesRef] = useState(new Date().toISOString().slice(0, 7));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nome: "", valor: "", dia_vencimento: "1", categoria: "fixo" });
  const [salario, setSalario] = useState(0);
  const [salarioManual, setSalarioManual] = useState<number | null>(null);
  const [totalCustosPessoais, setTotalCustosPessoais] = useState(0);
  const META_PRO_LABORE = 10000;

  useEffect(() => { fetchDespesas(); fetchProLabore(); fetchCustosPessoais(); }, [mesRef]);

  const fetchProLabore = async () => {
    const { data } = await supabase
      .from("fb_finance_caixas" as any)
      .select("saldo_atual, meta")
      .ilike("nome", "%pro labore%")
      .limit(1)
      .maybeSingle();
    if (data) {
      const saldo = Number((data as any).saldo_atual) || 0;
      setSalario(saldo);
    }
  };

  const fetchCustosPessoais = async () => {
    const { data } = await supabase
      .from("fb_finance_custos_pessoais" as any)
      .select("valor")
      .eq("ativo", true);
    if (data) {
      const total = (data as any[]).reduce((s: number, d: any) => s + Number(d.valor), 0);
      setTotalCustosPessoais(total);
    }
  };

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
    if (error) { toast({ title: "Erro ao salvar", variant: "destructive" }); return; }
    setForm({ nome: "", valor: "", dia_vencimento: "1", categoria: "fixo" });
    setShowForm(false);
    fetchDespesas();
    toast({ title: "Despesa adicionada!" });
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
  const margemLivre = salario - total;
  const percentUsado = salario > 0 ? (total / salario) * 100 : 0;
  const economiaPercent = salario > 0 ? ((salario - total) / salario * 100) : 0;

  // % comprometida do Pro Labore (meta) com custos pessoais
  const pctComprometida = META_PRO_LABORE > 0 ? (totalCustosPessoais / META_PRO_LABORE) * 100 : 0;
  const sobraParaEnvelopes = Math.max(0, META_PRO_LABORE - totalCustosPessoais);

  // Category aggregation for table
  const catMap: Record<string, { orcado: number; realizado: number }> = {};
  despesas.forEach(d => {
    const cat = d.categoria || "outros";
    if (!catMap[cat]) catMap[cat] = { orcado: 0, realizado: 0 };
    catMap[cat].orcado += Number(d.valor);
    if (d.pago) catMap[cat].realizado += Number(d.valor);
    else catMap[cat].realizado += Number(d.valor); // show full as realizado for simplicity
  });

  const catEntries = Object.entries(catMap).sort((a, b) => b[1].orcado - a[1].orcado);

  // Fixos vs variáveis
  const totalFixos = despesas.filter(d => d.categoria === "fixo").reduce((s, d) => s + Number(d.valor), 0);
  const totalVariaveis = total - totalFixos;
  const pctFixos = total > 0 ? Math.round((totalFixos / total) * 100) : 50;
  const pctVariaveis = 100 - pctFixos;

  // Best savings category
  const bestSaving = catEntries.reduce((best, [cat, v]) => {
    const diff = v.orcado - v.realizado;
    return diff > (best?.diff || 0) ? { cat, diff } : best;
  }, null as { cat: string; diff: number } | null);

  // Investimentos (soma de categoria investimentos ou 14% do salário como meta)
  const investimentoMeta = salario * 0.14;

  // Status
  const status = percentUsado <= 80 ? "Saudável" : percentUsado <= 95 ? "Atenção" : "Crítico";
  const statusColor = status === "Saudável" ? "text-[#40e56c]" : status === "Atenção" ? "text-amber-400" : "text-[#e71a0e]";
  const statusBg = status === "Saudável" ? "bg-[#40e56c]/10" : status === "Atenção" ? "bg-amber-400/10" : "bg-[#e71a0e]/10";
  const statusDot = status === "Saudável" ? "bg-[#40e56c]" : status === "Atenção" ? "bg-amber-400" : "bg-[#e71a0e]";

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1976d2]" />
      </div>
    );

  return (
    <div className="space-y-12 max-w-7xl mx-auto">
      {/* Header */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="font-['Manrope'] font-extrabold text-4xl text-[#d5e4fa] tracking-tight">
              PLANEJAMENTO MENSAL PESSOAL
            </h1>
          </div>
          <p className="text-[#c1c6d4] text-sm">Controle orçamentário e análise de fluxo de caixa em tempo real.</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={mesRef}
            onChange={e => setMesRef(e.target.value)}
            className="bg-[#283647] border-none text-sm text-[#d5e4fa] px-3 py-2 rounded-lg outline-none"
          />
          <span className={`${statusBg} ${statusColor} px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase flex items-center gap-2`}>
            <span className={`w-2 h-2 ${statusDot} rounded-full`} />
            Status: {status}
          </span>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-[#1d2b3c] p-2 rounded-lg text-[#c1c6d4] hover:bg-[#283647] transition-colors"
          >
            <span className="material-symbols-outlined">filter_list</span>
          </button>
        </div>
      </section>

      {/* Add Form (collapsible) */}
      {showForm && (
        <section className="bg-[#0e1c2d] rounded-xl p-6 border border-white/5 space-y-4">
          <h3 className="text-sm font-bold text-[#a5c8ff] uppercase tracking-widest">Nova Despesa</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="col-span-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-[#8b919e] mb-1 block">Nome</label>
              <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Aluguel"
                className="w-full bg-[#283647] border-none text-sm text-[#d5e4fa] px-3 py-2.5 rounded-lg outline-none placeholder:text-[#414752]" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-[#8b919e] mb-1 block">Valor (R$)</label>
              <input type="number" step="0.01" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })}
                className="w-full bg-[#283647] border-none text-sm text-[#d5e4fa] px-3 py-2.5 rounded-lg outline-none" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-[#8b919e] mb-1 block">Categoria</label>
              <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}
                className="w-full bg-[#283647] border-none text-sm text-[#d5e4fa] px-3 py-2.5 rounded-lg outline-none">
                <option value="fixo">Fixo</option>
                <option value="alimentacao">Alimentação</option>
                <option value="lazer">Lazer</option>
                <option value="transporte">Transporte</option>
                <option value="saude">Saúde</option>
                <option value="educacao">Educação</option>
                <option value="variavel">Variável</option>
                <option value="outros">Outros</option>
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={handleAdd}
                className="w-full bg-[#1976d2] text-white py-2.5 rounded-lg font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-sm">add</span> Adicionar
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Financial Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Balance - Pro Labore */}
        <div className="bg-gradient-to-br from-[#1976d2] to-blue-900 p-8 rounded-xl shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[220px]">
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <span className="text-[#d4e3ff] text-xs uppercase tracking-widest font-bold">Saldo Pro Labore</span>
              <span className="material-symbols-outlined text-[#d4e3ff] opacity-60">account_balance</span>
            </div>
            <h2 className="font-['Manrope'] font-bold text-5xl text-white tracking-tighter">{formatBRL(salario)}</h2>
          </div>
          <div className="relative z-10 flex gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-lg">
              <p className="text-[10px] text-white/60 uppercase font-bold">Meta Mensal</p>
              <p className="text-[#a5c8ff] font-bold">{formatBRL(META_PRO_LABORE)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-lg">
              <p className="text-[10px] text-white/60 uppercase font-bold">Após Custos</p>
              <p className={`font-bold ${sobraParaEnvelopes > 0 ? "text-[#40e56c]" : "text-[#ffb4a8]"}`}>{formatBRL(sobraParaEnvelopes)}</p>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20" />
        </div>

        {/* Total Custos Pessoais (fixos + variáveis reais) */}
        <div className="bg-[#0e1c2d] p-6 rounded-xl flex flex-col justify-between border-l-4 border-[#e71a0e] shadow-lg">
          <div>
            <span className="text-[#c1c6d4] text-xs uppercase tracking-widest font-bold">Total Custos Pessoais</span>
            <h3 className="font-['Manrope'] font-bold text-3xl text-[#d5e4fa] mt-2">{formatBRL(totalCustosPessoais)}</h3>
          </div>
          <div className="mt-4">
            <div className="w-full bg-[#283647] h-1 rounded-full overflow-hidden">
              <div className="bg-[#e71a0e] h-full transition-all" style={{ width: `${Math.min(pctComprometida, 100)}%` }} />
            </div>
            <p className="text-[11px] text-[#c1c6d4] mt-2">{pctComprometida.toFixed(0)}% da meta de Pro Labore</p>
          </div>
        </div>

        {/* Disponível para Envelopes */}
        <div className="bg-[#0e1c2d] p-6 rounded-xl flex flex-col justify-between border-l-4 border-[#40e56c] shadow-lg">
          <div>
            <span className="text-[#c1c6d4] text-xs uppercase tracking-widest font-bold">Livre p/ Envelopes</span>
            <h3 className={`font-['Manrope'] font-bold text-3xl mt-2 ${sobraParaEnvelopes > 0 ? "text-[#40e56c]" : "text-[#ffb4a8]"}`}>{formatBRL(sobraParaEnvelopes)}</h3>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#40e56c] text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>savings</span>
            <p className="text-[11px] text-[#40e56c] font-bold">{(100 - pctComprometida).toFixed(0)}% da meta disponível</p>
          </div>
        </div>
      </section>

      {/* Compromisso vs Envelopes */}
      <section className="bg-[#0e1c2d] rounded-xl p-6 border border-white/5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-['Manrope'] font-bold text-lg text-[#d5e4fa]">Comprometimento do Pro Labore</h3>
            <p className="text-[#8b919e] text-xs mt-1">Meta mensal: {formatBRL(META_PRO_LABORE)} · Custos pessoais têm prioridade sobre distribuição</p>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${pctComprometida <= 70 ? "bg-[#40e56c]/20 text-[#40e56c]" : pctComprometida <= 90 ? "bg-amber-400/20 text-amber-400" : "bg-[#e71a0e]/20 text-[#ffb4a8]"}`}>
            {pctComprometida.toFixed(1)}% comprometido
          </span>
        </div>

        {/* Visual bar */}
        <div className="space-y-2">
          <div className="h-4 rounded-full overflow-hidden flex bg-[#283647]">
            <div className="h-full bg-[#e71a0e] transition-all flex items-center justify-center" style={{ width: `${Math.min(pctComprometida, 100)}%` }}>
              {pctComprometida >= 15 && <span className="text-[9px] font-bold text-white">Custos {formatBRL(totalCustosPessoais)}</span>}
            </div>
            <div className="h-full bg-[#40e56c] transition-all flex items-center justify-center" style={{ width: `${Math.max(0, 100 - pctComprometida)}%` }}>
              {(100 - pctComprometida) >= 15 && <span className="text-[9px] font-bold text-[#003912]">Envelopes {formatBRL(sobraParaEnvelopes)}</span>}
            </div>
          </div>
          <div className="flex justify-between text-[10px] text-[#8b919e] font-bold uppercase tracking-widest">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#e71a0e]" /> Custos fixos + variáveis: {formatBRL(totalCustosPessoais)}</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#40e56c]" /> Disponível p/ envelopes: {formatBRL(sobraParaEnvelopes)}</span>
          </div>
        </div>
      </section>

      {/* Personal Distribution - uses only the remaining after costs */}
      <FbPersonalDistribution salario={sobraParaEnvelopes} />

      {/* Detailed Budget + Summary */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Category Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-['Manrope'] font-bold text-xl text-[#d5e4fa]">Detalhamento por Categoria</h3>
            <button className="text-[#a5c8ff] text-xs font-bold uppercase tracking-widest hover:underline">Exportar PDF</button>
          </div>
          <div className="bg-[#0e1c2d] rounded-xl overflow-hidden shadow-xl">
            <table className="w-full text-left">
              <thead className="bg-[#283647]/50">
                <tr>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-[#c1c6d4]">Categoria</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-[#c1c6d4]">Orçado</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-[#c1c6d4]">Realizado</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-[#c1c6d4]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {catEntries.map(([cat, vals]) => {
                  const diff = vals.orcado - vals.realizado;
                  const style = getCat(cat);
                  return (
                    <tr key={cat} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg ${style.bg} flex items-center justify-center ${style.color}`}>
                            <span className="material-symbols-outlined text-sm">{style.icon}</span>
                          </div>
                          <span className="font-medium text-sm text-[#d5e4fa] capitalize">{cat}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 font-['Manrope'] font-bold text-sm text-[#d5e4fa]">{formatBRL(vals.orcado)}</td>
                      <td className={`px-6 py-5 font-['Manrope'] font-bold text-sm ${diff < 0 ? "text-[#ffb4a8]" : diff > 0 ? "text-[#40e56c]" : "text-[#d5e4fa]"}`}>
                        {formatBRL(vals.realizado)}
                      </td>
                      <td className="px-6 py-5">
                        {diff === 0 ? (
                          <span className="bg-[#283647] text-[#c1c6d4] px-3 py-1 rounded-full text-[10px] font-bold uppercase">No Alvo</span>
                        ) : diff > 0 ? (
                          <span className="bg-[#40e56c]/20 text-[#40e56c] px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                            - {formatBRL(diff)}
                          </span>
                        ) : (
                          <span className="bg-[#e71a0e]/20 text-[#ffb4a8] px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                            + {formatBRL(Math.abs(diff))}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {catEntries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-[#414752] text-sm">Nenhuma despesa cadastrada</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Individual items list */}
          {despesas.length > 0 && (
            <div className="bg-[#0e1c2d] rounded-xl overflow-hidden shadow-xl border border-white/5">
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <h4 className="text-sm font-bold text-[#d5e4fa]">Despesas Individuais</h4>
                <button onClick={() => setShowForm(true)} className="text-[10px] text-[#1976d2] font-bold uppercase tracking-widest hover:underline">
                  + Adicionar
                </button>
              </div>
              <div className="divide-y divide-white/5">
                {despesas.map(d => {
                  const style = getCat(d.categoria);
                  return (
                    <div key={d.id} className={`px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors ${d.pago ? "opacity-50" : ""}`}>
                      <div className="flex items-center gap-3">
                        <button onClick={() => togglePago(d.id, d.pago)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${d.pago ? "bg-[#40e56c] border-[#40e56c]" : "border-[#414752] hover:border-[#a5c8ff]"}`}>
                          {d.pago && <span className="material-symbols-outlined text-white text-xs">check</span>}
                        </button>
                        <div className={`w-7 h-7 rounded-lg ${style.bg} flex items-center justify-center ${style.color}`}>
                          <span className="material-symbols-outlined text-xs">{style.icon}</span>
                        </div>
                        <div>
                          <span className={`text-sm font-medium ${d.pago ? "line-through text-[#414752]" : "text-[#d5e4fa]"}`}>{d.nome}</span>
                          <span className="text-[10px] text-[#8b919e] ml-2 capitalize">{d.categoria} · Dia {d.dia_vencimento}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-[#ffb4a8]">{formatBRL(Number(d.valor))}</span>
                        <button onClick={() => handleDelete(d.id)} className="text-[#414752] hover:text-[#e71a0e] transition-colors">
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-6">
          <h3 className="font-['Manrope'] font-bold text-xl text-[#d5e4fa]">Resumo de Fluxo</h3>

          {/* Gauge */}
          <div className="bg-[#122031] p-6 rounded-xl space-y-8 shadow-xl">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-[#c1c6d4]">
                <span>Gastos Totais</span>
                <span>{formatBRL(total)} / {formatBRL(salario)}</span>
              </div>
              <div className="h-3 bg-[#283647] rounded-full overflow-hidden flex">
                <div className="bg-[#1976d2] h-full transition-all" style={{ width: `${Math.min(percentUsado, 100)}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0e1c2d] p-4 rounded-lg">
                <p className="text-[10px] text-[#c1c6d4] uppercase font-bold mb-1">Economia</p>
                <p className="text-xl font-['Manrope'] font-bold text-[#40e56c]">{economiaPercent.toFixed(1)}%</p>
              </div>
              <div className="bg-[#0e1c2d] p-4 rounded-lg">
                <p className="text-[10px] text-[#c1c6d4] uppercase font-bold mb-1">Margem Livre</p>
                <p className="text-xl font-['Manrope'] font-bold text-[#d5e4fa]">{formatBRL(margemLivre)}</p>
              </div>
            </div>

            {/* Insight */}
            <div className="bg-[#1976d2]/10 border-l-2 border-[#1976d2] p-4 rounded-r-lg">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[#a5c8ff] text-lg">lightbulb</span>
                <div>
                  <p className="text-xs font-bold text-[#d5e4fa] mb-1">Dica do Vault</p>
                  <p className="text-[11px] text-[#c1c6d4] leading-relaxed">
                    {margemLivre > 0
                      ? `Você tem ${formatBRL(margemLivre)} disponível. Recomendamos transferir esse valor para sua carteira de investimentos para potencializar os juros compostos.`
                      : "Atenção: seus gastos ultrapassaram o orçamento. Revise as categorias com maior desvio."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Distribution Fixos vs Variáveis */}
          <div className="bg-[#0e1c2d] p-6 rounded-xl flex items-center justify-between shadow-lg">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-[#d5e4fa]">Distribuição</h4>
              <p className="text-[10px] text-[#c1c6d4] uppercase tracking-widest font-bold">Fixos vs Variáveis</p>
            </div>
            <div className="flex -space-x-2">
              <div className="w-10 h-10 rounded-full bg-[#1976d2] border-2 border-[#0e1c2d] flex items-center justify-center text-[10px] font-bold text-white">
                {pctFixos}%
              </div>
              <div className="w-10 h-10 rounded-full bg-[#40e56c] border-2 border-[#0e1c2d] flex items-center justify-center text-[10px] font-bold text-[#003912]">
                {pctVariaveis}%
              </div>
            </div>
          </div>

          {/* Salary config */}
          <div className="bg-[#0e1c2d] p-6 rounded-xl shadow-lg border border-white/5">
            <label className="text-[10px] uppercase tracking-widest font-bold text-[#8b919e] mb-2 block">
              Salário / Renda Mensal
              <span className="ml-2 text-[#40e56c] normal-case tracking-normal font-medium">• Sincronizado com Pro Labore</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[#8b919e] text-sm">R$</span>
              <input
                type="number"
                value={salario}
                readOnly
                className="bg-[#283647] border-none text-sm text-[#d5e4fa] px-3 py-2 rounded-lg outline-none flex-1 opacity-70 cursor-default"
              />
            </div>
            <p className="text-[9px] text-[#8b919e] mt-2">Atualizado automaticamente pelo saldo do caixa Pro Labore</p>
          </div>
        </div>
      </section>
    </div>
  );
}
