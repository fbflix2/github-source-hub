import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getOperationalTotals } from "@/lib/fb-finance";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const categorias = [
  "Salário", "Venda PJ", "Aluguel", "Energia", "Internet", "Gasolina", "Mercado",
  "Transporte", "Lazer", "Educação", "Saúde", "Serviços", "Vendas", "Tecnologia",
  "Suprimentos", "Fixo", "Aporte Pessoal", "Transferência", "Outros"
];

interface Caixa { id: string; nome: string; tipo: string; saldo_atual: number }
interface Lancamento {
  id: string; data: string; tipo: string; categoria: string;
  descricao: string | null; entrada: number; saida: number;
  caixa_destino_id: string | null; created_at: string;
}

interface DistPreview {
  caixaName: string;
  caixaId: string;
  percent: number;
  valor: number;
}

export function FbLancamentos() {
  const [caixas, setCaixas] = useState<Caixa[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [mesFilter, setMesFilter] = useState(new Date().toISOString().slice(0, 7));
  const [page, setPage] = useState(0);
  const perPage = 6;

  // Distribution preview state
  const [showDistPreview, setShowDistPreview] = useState(false);
  const [distPreviews, setDistPreviews] = useState<DistPreview[]>([]);
  const [pendingPayload, setPendingPayload] = useState<any>(null);
  const [distributing, setDistributing] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ data: "", tipo: "", categoria: "", descricao: "", entrada: "", saida: "", caixa_destino_id: "" });

  const [form, setForm] = useState({
    data: new Date().toISOString().split("T")[0],
    tipo: "empresa",
    categoria: "Outros",
    descricao: "",
    entrada: "",
    saida: "",
    caixa_destino_id: "",
  });

  useEffect(() => { fetchAll(); }, [mesFilter]);

  const fetchAll = async () => {
    setLoading(true);
    // Calculate last day of month correctly
    const [year, month] = mesFilter.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const startDate = `${mesFilter}-01`;
    const endDate = `${mesFilter}-${String(lastDay).padStart(2, "0")}`;
    const [caixasRes, lancRes] = await Promise.all([
      supabase.from("fb_finance_caixas" as any).select("id, nome, tipo, saldo_atual"),
      supabase.from("fb_finance_lancamentos" as any).select("*").gte("data", startDate).lte("data", endDate).order("data", { ascending: false }),
    ]);
    if (caixasRes.data) setCaixas(caixasRes.data as any);
    if (lancRes.data) setLancamentos(lancRes.data as any);
    setLoading(false);
    setPage(0);
  };

  const syncCaixaSaldo = async (caixaId: string, delta: number) => {
    const { data: caixa } = await supabase.from("fb_finance_caixas" as any).select("id, tipo, saldo_atual").eq("id", caixaId).single();
    if (!caixa) return;

    if ((caixa as any).tipo === "pessoal") {
      const { data: caixaLancamentos } = await supabase
        .from("fb_finance_lancamentos" as any)
        .select("entrada, saida")
        .eq("caixa_destino_id", caixaId);

      const saldoPessoal = ((caixaLancamentos as any[]) || []).reduce(
        (sum, lancamento) => sum + Number(lancamento.entrada || 0) - Number(lancamento.saida || 0),
        0
      );

      await supabase.from("fb_finance_caixas" as any).update({ saldo_atual: saldoPessoal } as any).eq("id", caixaId);
      return;
    }

    const novoSaldo = Number((caixa as any).saldo_atual || 0) + delta;
    await supabase.from("fb_finance_caixas" as any).update({ saldo_atual: novoSaldo } as any).eq("id", caixaId);
  };

  const handleSubmit = async () => {
    const entradaVal = parseFloat(form.entrada) || 0;
    const saidaVal = parseFloat(form.saida) || 0;

    // If it's an entrada and tipo is empresa, show distribution preview
    if (entradaVal > 0 && saidaVal === 0 && form.tipo === "empresa") {
      // Fetch distribution percentages
      const { data: config } = await supabase.from("fb_finance_config" as any).select("distribution_percentages").limit(1).single();
      const percs = config ? (config as any).distribution_percentages : null;

      if (percs && Object.keys(percs).length > 0) {
        const previews: DistPreview[] = [];
        const allCaixas = caixas;

        // Map from distribution key to caixa name
        const caixaMap: Record<string, string> = {
          capital_giro: "Capital de Giro",
          fundos_reserva: "Fundos Reserva/Crise",
          dividendos: "Dividendos",
          operacional: "Operacional",
          pro_labore: "Pro Labore",
          dia_a_dia: "Dia a Dia/Emergências",
        };

        for (const [key, percent] of Object.entries(percs)) {
          const nome = caixaMap[key] || key;
          const caixa = allCaixas.find(c => c.nome === nome);
          if (caixa && Number(percent) > 0) {
            previews.push({
              caixaName: nome,
              caixaId: caixa.id,
              percent: Number(percent),
              valor: entradaVal * Number(percent) / 100,
            });
          }
        }

        if (previews.length > 0) {
          setDistPreviews(previews);
          setPendingPayload({
            data: form.data,
            tipo: form.tipo,
            categoria: form.categoria,
            descricao: form.descricao || null,
            entrada: entradaVal,
            saida: 0,
          });
          setShowDistPreview(true);
          return;
        }
      }
    }

    // Normal flow (no distribution or saída)
    if (!form.caixa_destino_id) {
      toast({ title: "Selecione um caixa destino", variant: "destructive" });
      return;
    }

    const payload = {
      data: form.data, tipo: form.tipo, categoria: form.categoria,
      descricao: form.descricao || null,
      entrada: entradaVal,
      saida: saidaVal,
      caixa_destino_id: form.caixa_destino_id,
    };

    const { error } = await supabase.from("fb_finance_lancamentos" as any).insert(payload as any);
    if (error) { toast({ title: "Erro ao salvar", variant: "destructive" }); return; }

    await syncCaixaSaldo(form.caixa_destino_id, payload.entrada - payload.saida);

    toast({ title: "Lançamento adicionado!" });
    setForm({ ...form, descricao: "", entrada: "", saida: "" });
    setShowForm(false);
    fetchAll();
  };

  const handleConfirmDistribution = async () => {
    if (!pendingPayload || distPreviews.length === 0) return;
    setDistributing(true);

    try {
      // Create one lancamento per caixa
      for (const preview of distPreviews) {
        const lancPayload = {
          data: pendingPayload.data,
          tipo: pendingPayload.tipo,
          categoria: pendingPayload.categoria,
          descricao: `${pendingPayload.descricao || pendingPayload.categoria} → ${preview.caixaName} (${preview.percent}%)`,
          entrada: preview.valor,
          saida: 0,
          caixa_destino_id: preview.caixaId,
        };

        await supabase.from("fb_finance_lancamentos" as any).insert(lancPayload as any);

        // Update caixa balance
        const { data: caixa } = await supabase.from("fb_finance_caixas" as any).select("id, saldo_atual").eq("id", preview.caixaId).single();
        if (caixa) {
          const novoSaldo = Number((caixa as any).saldo_atual || 0) + preview.valor;
          await supabase.from("fb_finance_caixas" as any).update({ saldo_atual: novoSaldo } as any).eq("id", preview.caixaId);
        }
      }

      // Also create a distribuição record
      const percObj: Record<string, number> = {};
      const valoresObj: Record<string, number> = {};
      distPreviews.forEach(p => {
        const key = Object.entries({
          capital_giro: "Capital de Giro",
          fundos_reserva: "Fundos Reserva/Crise",
          dividendos: "Dividendos",
          operacional: "Operacional",
          pro_labore: "Pro Labore",
          dia_a_dia: "Dia a Dia/Emergências",
        }).find(([, v]) => v === p.caixaName)?.[0] || p.caixaName;
        percObj[key] = p.percent;
        valoresObj[key] = p.valor;
      });

      await supabase.from("fb_finance_distribuicoes" as any).insert({
        data: pendingPayload.data,
        entrada_dia: pendingPayload.entrada,
        percentuais: percObj,
        valores_alocados: valoresObj,
        aplicado: true,
      } as any);

      toast({ title: "Entrada distribuída entre os caixas!" });
      setShowDistPreview(false);
      setPendingPayload(null);
      setDistPreviews([]);
      setForm({ ...form, descricao: "", entrada: "", saida: "", caixa_destino_id: "" });
      setShowForm(false);
      fetchAll();
    } catch {
      toast({ title: "Erro ao distribuir", variant: "destructive" });
    } finally {
      setDistributing(false);
    }
  };

  const startEdit = (l: Lancamento) => {
    setEditingId(l.id);
    setEditForm({
      data: l.data,
      tipo: l.tipo,
      categoria: l.categoria,
      descricao: l.descricao || "",
      entrada: l.entrada > 0 ? String(l.entrada) : "",
      saida: l.saida > 0 ? String(l.saida) : "",
      caixa_destino_id: l.caixa_destino_id || "",
    });
  };

  const handleSaveEdit = async (id: string) => {
    const lancamento = lancamentos.find(l => l.id === id);
    if (!lancamento) return;

    const newEntrada = parseFloat(editForm.entrada) || 0;
    const newSaida = parseFloat(editForm.saida) || 0;

    const { error } = await supabase.from("fb_finance_lancamentos" as any).update({
      data: editForm.data,
      tipo: editForm.tipo,
      categoria: editForm.categoria,
      descricao: editForm.descricao || null,
      entrada: newEntrada,
      saida: newSaida,
      caixa_destino_id: editForm.caixa_destino_id || null,
    } as any).eq("id", id);

    if (error) { toast({ title: "Erro ao salvar", variant: "destructive" }); return; }

    // Recalculate old caixa balance
    if (lancamento.caixa_destino_id) {
      await syncCaixaSaldo(lancamento.caixa_destino_id, Number(lancamento.saida) - Number(lancamento.entrada));
    }
    // Apply new values to new caixa
    if (editForm.caixa_destino_id) {
      await syncCaixaSaldo(editForm.caixa_destino_id, newEntrada - newSaida);
    }

    toast({ title: "Lançamento atualizado!" });
    setEditingId(null);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    const lancamento = lancamentos.find((item) => item.id === id);
    await supabase.from("fb_finance_lancamentos" as any).delete().eq("id", id);
    if (lancamento?.caixa_destino_id) {
      await syncCaixaSaldo(lancamento.caixa_destino_id, Number(lancamento.saida) - Number(lancamento.entrada));
    }
    toast({ title: "Removido" });
    fetchAll();
  };

  // Use ALL lancamentos for stats (including distributions/transfers)
  const allTotalEntradas = lancamentos.reduce((s, l) => s + Number(l.entrada || 0), 0);
  const allTotalSaidas = lancamentos.reduce((s, l) => s + Number(l.saida || 0), 0);
  const saldoAtual = allTotalEntradas - allTotalSaidas;
  
  // For averages, count only real income/expenses (exclude internal distribution transfers)
  const nonTransferCategories = (l: Lancamento) => !["Distribuição PJ", "Capital de Giro", "Aportes", "Transferência"].includes(l.categoria);
  // Média Entradas: baseada apenas nos lançamentos de Distribuição PJ (entradas da distribuição diária)
  const distribuicaoPJEntradas = lancamentos.filter(l => Number(l.entrada) > 0 && l.categoria === "Distribuição PJ");
  const realEntradasDistPJ = distribuicaoPJEntradas.reduce((s, l) => s + Number(l.entrada), 0);
  const realSaidas = lancamentos.filter(l => Number(l.saida) > 0 && nonTransferCategories(l)).reduce((s, l) => s + Number(l.saida), 0);
  const diasUnicosDistPJ = Math.max(new Set(distribuicaoPJEntradas.map(l => l.data).filter(Boolean)).size, 1);
  const diasUnicos = Math.max(new Set(lancamentos.map(l => l.data).filter(Boolean)).size, 1);
  const mediaEntradas = realEntradasDistPJ > 0 ? realEntradasDistPJ / diasUnicosDistPJ : 0;
  const mediaSaidas = realSaidas > 0 ? realSaidas / diasUnicos : 0;
  // Saldo do período (all movements)
  const totalMovimentacoes = lancamentos.length;

  const paginatedLancamentos = lancamentos.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.ceil(lancamentos.length / perPage);

  const getCategoriaStyle = (cat: string) => {
    const entradaCats = ["Vendas", "Venda PJ", "Serviços", "Salário"];
    if (entradaCats.includes(cat)) return "bg-[#a5c8ff]/10 text-[#a5c8ff]";
    return "bg-[#283647] text-[#8b919e]";
  };

  return (
    <section className="p-6 md:p-10 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <nav className="flex text-xs text-[#8b919e] mb-2 gap-2" style={{ fontFamily: "Inter" }}>
            <span>Finanças</span>
            <span>/</span>
            <span className="text-[#a5c8ff]">Lançamentos</span>
          </nav>
          <h2 className="font-['Manrope'] font-extrabold text-4xl md:text-5xl text-[#d5e4fa] tracking-tighter">LANÇAMENTOS DIÁRIOS</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-[#8b919e] uppercase tracking-widest" style={{ fontFamily: "Inter" }}>Saldo Atual</p>
            <p className="font-['Manrope'] font-bold text-2xl text-[#40e56c]">{formatBRL(saldoAtual)}</p>
          </div>
          <input
            type="month"
            value={mesFilter}
            onChange={e => setMesFilter(e.target.value)}
            className="bg-[#122031] border border-white/5 rounded-lg px-3 py-2 text-xs text-[#d5e4fa] outline-none focus:ring-2 focus:ring-[#1976d2]"
          />
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-[#1976d2] text-white h-14 px-8 rounded-xl font-bold flex items-center gap-3 shadow-2xl shadow-[#1976d2]/40 active:scale-95 transition-all text-sm"
          >
            <span className="material-symbols-outlined">add_circle</span>
            Novo Lançamento
          </button>
        </div>
      </div>

      {/* New Entry Form (collapsible) */}
      {showForm && (
        <div className="bg-[#0e1c2d] rounded-3xl p-6 mb-12 border border-white/5 shadow-2xl">
          <h4 className="font-['Manrope'] font-bold text-lg text-[#d5e4fa] mb-4">Novo Lançamento</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-[10px] text-[#8b919e] uppercase tracking-widest block mb-1" style={{ fontFamily: "Inter" }}>Data</label>
              <input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })}
                className="w-full bg-[#051424] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#d5e4fa] outline-none focus:ring-2 focus:ring-[#1976d2]" />
            </div>
            <div>
              <label className="text-[10px] text-[#8b919e] uppercase tracking-widest block mb-1" style={{ fontFamily: "Inter" }}>Tipo</label>
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                className="w-full bg-[#051424] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#d5e4fa] outline-none focus:ring-2 focus:ring-[#1976d2]">
                <option value="pessoal">Pessoal</option>
                <option value="empresa">Empresa</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#8b919e] uppercase tracking-widest block mb-1" style={{ fontFamily: "Inter" }}>Categoria</label>
              <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}
                className="w-full bg-[#051424] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#d5e4fa] outline-none focus:ring-2 focus:ring-[#1976d2]">
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#8b919e] uppercase tracking-widest block mb-1" style={{ fontFamily: "Inter" }}>Caixa Destino</label>
              <select value={form.caixa_destino_id} onChange={e => setForm({ ...form, caixa_destino_id: e.target.value })}
                className="w-full bg-[#051424] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#d5e4fa] outline-none focus:ring-2 focus:ring-[#1976d2]">
                <option value="">Selecione...</option>
                {caixas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-[#8b919e] uppercase tracking-widest block mb-1" style={{ fontFamily: "Inter" }}>Descrição</label>
              <input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição do lançamento..."
                className="w-full bg-[#051424] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#d5e4fa] placeholder:text-[#8b919e]/40 outline-none focus:ring-2 focus:ring-[#1976d2]" />
            </div>
            <div>
              <label className="text-[10px] text-[#8b919e] uppercase tracking-widest block mb-1" style={{ fontFamily: "Inter" }}>Entrada (R$)</label>
              <input type="number" step="0.01" value={form.entrada} onChange={e => setForm({ ...form, entrada: e.target.value })} placeholder="0,00"
                className="w-full bg-[#051424] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#40e56c] placeholder:text-[#8b919e]/40 outline-none focus:ring-2 focus:ring-[#1976d2]" />
            </div>
            <div>
              <label className="text-[10px] text-[#8b919e] uppercase tracking-widest block mb-1" style={{ fontFamily: "Inter" }}>Saída (R$)</label>
              <input type="number" step="0.01" value={form.saida} onChange={e => setForm({ ...form, saida: e.target.value })} placeholder="0,00"
                className="w-full bg-[#051424] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#e71a0e] placeholder:text-[#8b919e]/40 outline-none focus:ring-2 focus:ring-[#1976d2]" />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={handleSubmit}
              className="bg-[#1976d2] text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-[#1976d2]/20 flex items-center gap-2 active:scale-95 transition-transform">
              <span className="material-symbols-outlined text-sm">add</span>
              Adicionar
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-6 py-3 rounded-xl font-bold text-sm border border-white/10 text-[#8b919e] hover:bg-white/5 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Stats Overview Bento-style */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-[#0e1c2d] p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#40e56c]"></div>
          <p className="text-[10px] text-[#8b919e] uppercase tracking-widest mb-1" style={{ fontFamily: "Inter" }}>Média Entradas</p>
          <h3 className="font-['Manrope'] font-extrabold text-3xl text-[#d5e4fa]">
            {formatBRL(mediaEntradas)} <span className="text-sm font-medium text-[#40e56c]">/dia</span>
          </h3>
          <div className="mt-4 flex items-center text-xs text-[#40e56c] gap-1">
            <span className="material-symbols-outlined text-xs">trending_up</span>
            <span>+12% vs mês anterior</span>
          </div>
        </div>
        <div className="bg-[#0e1c2d] p-6 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#e71a0e]"></div>
          <p className="text-[10px] text-[#8b919e] uppercase tracking-widest mb-1" style={{ fontFamily: "Inter" }}>Média Saídas</p>
          <h3 className="font-['Manrope'] font-extrabold text-3xl text-[#d5e4fa]">
            {formatBRL(mediaSaidas)} <span className="text-sm font-medium text-[#ffb4a8]">/dia</span>
          </h3>
          <div className="mt-4 flex items-center text-xs text-[#ffb4a8] gap-1">
            <span className="material-symbols-outlined text-xs">trending_down</span>
            <span>-4% em custos fixos</span>
          </div>
        </div>
        <div className="bg-[#0e1c2d] p-6 rounded-2xl border border-white/5 flex flex-col justify-center">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] text-[#8b919e] uppercase tracking-widest mb-1" style={{ fontFamily: "Inter" }}>Saldo do Período</p>
              <h3 className={`font-['Manrope'] font-extrabold text-2xl ${saldoAtual >= 0 ? "text-[#40e56c]" : "text-[#ffb4a8]"}`}>{formatBRL(saldoAtual)}</h3>
            </div>
            <div className="text-center">
              <span className="block text-lg font-bold text-[#d5e4fa]">{totalMovimentacoes}</span>
              <span className="text-[9px] text-[#8b919e] uppercase font-bold">lançamentos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Data Table */}
      <div className="bg-[#0e1c2d] rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 flex items-center justify-between border-b border-white/5">
          <h4 className="font-['Manrope'] font-bold text-lg text-[#d5e4fa]">Histórico Recente</h4>
          <div className="flex gap-2">
            <button className="p-2 rounded-lg bg-[#283647] text-[#8b919e] hover:text-[#d5e4fa] transition-colors">
              <span className="material-symbols-outlined text-xl">filter_list</span>
            </button>
            <button className="p-2 rounded-lg bg-[#283647] text-[#8b919e] hover:text-[#d5e4fa] transition-colors">
              <span className="material-symbols-outlined text-xl">download</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#010f1f]/50">
                <th className="py-4 px-6 text-[10px] font-black text-[#8b919e] uppercase tracking-widest">Data</th>
                <th className="py-4 px-6 text-[10px] font-black text-[#8b919e] uppercase tracking-widest">Descrição</th>
                <th className="py-4 px-6 text-[10px] font-black text-[#8b919e] uppercase tracking-widest">Categoria</th>
                <th className="py-4 px-6 text-[10px] font-black text-[#8b919e] uppercase tracking-widest text-center">Tipo</th>
                <th className="py-4 px-6 text-[10px] font-black text-[#8b919e] uppercase tracking-widest text-right">Valor</th>
                <th className="py-4 px-6 text-[10px] font-black text-[#8b919e] uppercase tracking-widest">Caixa</th>
                <th className="py-4 px-6 text-[10px] font-black text-[#8b919e] uppercase tracking-widest w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={7} className="text-center text-[#8b919e]/40 py-12">Carregando...</td></tr>
              ) : paginatedLancamentos.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-[#8b919e]/40 py-12">Nenhum lançamento neste mês</td></tr>
              ) : paginatedLancamentos.map((l) => {
                const isEntrada = Number(l.entrada) > 0;
                const valor = isEntrada ? Number(l.entrada) : Number(l.saida);

                if (editingId === l.id) {
                  return (
                    <tr key={l.id} className="bg-[#051424]">
                      <td className="py-3 px-4">
                        <input type="date" value={editForm.data} onChange={e => setEditForm(f => ({ ...f, data: e.target.value }))}
                          className="w-full bg-[#0e1c2d] border border-white/10 rounded px-2 py-1.5 text-xs text-[#d5e4fa] outline-none focus:ring-1 focus:ring-[#1976d2]" />
                      </td>
                      <td className="py-3 px-4">
                        <input value={editForm.descricao} onChange={e => setEditForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descrição..."
                          className="w-full bg-[#0e1c2d] border border-white/10 rounded px-2 py-1.5 text-xs text-[#d5e4fa] outline-none focus:ring-1 focus:ring-[#1976d2]" />
                      </td>
                      <td className="py-3 px-4">
                        <select value={editForm.categoria} onChange={e => setEditForm(f => ({ ...f, categoria: e.target.value }))}
                          className="w-full bg-[#0e1c2d] border border-white/10 rounded px-2 py-1.5 text-xs text-[#d5e4fa] outline-none focus:ring-1 focus:ring-[#1976d2]">
                          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <select value={editForm.tipo} onChange={e => setEditForm(f => ({ ...f, tipo: e.target.value }))}
                          className="w-full bg-[#0e1c2d] border border-white/10 rounded px-2 py-1.5 text-xs text-[#d5e4fa] outline-none focus:ring-1 focus:ring-[#1976d2]">
                          <option value="empresa">Empresa</option>
                          <option value="pessoal">Pessoal</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <input type="number" step="0.01" value={editForm.entrada} onChange={e => setEditForm(f => ({ ...f, entrada: e.target.value, saida: "" }))} placeholder="Entrada"
                            className="w-20 bg-[#0e1c2d] border border-white/10 rounded px-2 py-1.5 text-xs text-[#40e56c] outline-none focus:ring-1 focus:ring-[#1976d2]" />
                          <input type="number" step="0.01" value={editForm.saida} onChange={e => setEditForm(f => ({ ...f, saida: e.target.value, entrada: "" }))} placeholder="Saída"
                            className="w-20 bg-[#0e1c2d] border border-white/10 rounded px-2 py-1.5 text-xs text-[#e71a0e] outline-none focus:ring-1 focus:ring-[#1976d2]" />
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <select value={editForm.caixa_destino_id} onChange={e => setEditForm(f => ({ ...f, caixa_destino_id: e.target.value }))}
                          className="w-full bg-[#0e1c2d] border border-white/10 rounded px-2 py-1.5 text-xs text-[#d5e4fa] outline-none focus:ring-1 focus:ring-[#1976d2]">
                          <option value="">-</option>
                          {caixas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <button onClick={() => handleSaveEdit(l.id)} className="text-[#40e56c] hover:brightness-125 transition-colors">
                            <span className="material-symbols-outlined text-lg">check</span>
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-[#8b919e] hover:text-white transition-colors">
                            <span className="material-symbols-outlined text-lg">close</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={l.id} className="hover:bg-white/5 transition-colors group">
                    <td className="py-5 px-6 text-sm text-[#c1c6d4]" style={{ fontFamily: "Inter" }}>
                      {new Date(l.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="py-5 px-6 font-['Manrope'] font-semibold text-[#d5e4fa]">
                      {l.descricao || l.categoria}
                    </td>
                    <td className="py-5 px-6">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getCategoriaStyle(l.categoria)}`}>
                        {l.categoria}
                      </span>
                    </td>
                    <td className="py-5 px-6 text-center">
                      <span className={`text-xs font-medium capitalize ${l.tipo === 'empresa' ? 'text-[#a5c8ff]' : 'text-[#c1c6d4]'}`}>
                        {l.tipo === 'empresa' ? 'Empresa' : 'Pessoal'}
                      </span>
                    </td>
                    <td className={`py-5 px-6 text-right font-['Manrope'] font-bold ${isEntrada ? "text-[#40e56c]" : "text-[#e71a0e]"}`}>
                      {isEntrada ? "+ " : "- "}{formatBRL(valor)}
                    </td>
                    <td className="py-5 px-6">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#40e56c]"></div>
                        <span className="text-xs font-medium text-[#c1c6d4]">{caixas.find(c => c.id === l.caixa_destino_id)?.nome || "-"}</span>
                      </div>
                    </td>
                    <td className="py-5 px-6">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(l)} className="text-[#8b919e]/60 hover:text-[#a5c8ff] transition-colors">
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button onClick={() => handleDelete(l.id)} className="text-[#8b919e]/60 hover:text-[#e71a0e] transition-colors">
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-6 border-t border-white/5 flex items-center justify-between">
          <p className="text-xs text-[#8b919e]">
            Mostrando {Math.min(paginatedLancamentos.length, perPage)} de {lancamentos.length} lançamentos
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-4 py-2 text-xs font-bold border border-white/10 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-30"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-4 py-2 text-xs font-bold bg-[#1976d2] text-white rounded-lg active:scale-95 transition-transform disabled:opacity-30"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Insights */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-[#1d2b3c]/40 p-8 rounded-3xl border border-white/5 flex gap-6 items-start">
          <div className="w-14 h-14 bg-[#40e56c]/20 rounded-2xl flex items-center justify-center text-[#40e56c] shrink-0">
            <span className="material-symbols-outlined text-3xl">auto_awesome</span>
          </div>
          <div>
            <h5 className="font-['Manrope'] font-bold text-lg mb-2 text-[#d5e4fa]">Insight da Vault IA</h5>
            <p className="text-sm text-[#c1c6d4] leading-relaxed">
              {allTotalEntradas > allTotalSaidas
                ? `Suas entradas superaram as saídas em ${((allTotalEntradas - allTotalSaidas) / Math.max(allTotalSaidas, 1) * 100).toFixed(0)}% neste mês. Recomendamos alocar ${formatBRL((allTotalEntradas - allTotalSaidas) * 0.3)} excedentes na sua carteira de investimentos para otimização de rendimento.`
                : "Suas saídas estão superiores às entradas neste mês. Revise seus custos fixos para otimizar o fluxo de caixa."}
            </p>
          </div>
        </div>
        <div className="bg-[#0e1c2d] p-8 rounded-3xl border border-white/5">
          <div className="flex justify-between items-center mb-6">
            <h5 className="font-['Manrope'] font-bold text-[#d5e4fa]">Projeção de Fluxo</h5>
            <span className="text-[10px] font-black uppercase text-[#8b919e] tracking-widest">Próximos 15 dias</span>
          </div>
          <div className="flex items-end gap-1 h-24">
            {[40, 60, 45, 80, 55, 70, 90].map((h, i) => (
              <div key={i} className={`${i === 3 ? "bg-[#a5c8ff]" : "bg-[#a5c8ff]/20"} w-full rounded-t-lg`} style={{ height: `${h}%` }}></div>
            ))}
          </div>
        </div>
      </div>

      {/* Distribution Preview Modal */}
      {showDistPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setShowDistPreview(false); setPendingPayload(null); }}>
          <div className="bg-[#0e1c2d] rounded-2xl w-full max-w-lg shadow-2xl border border-[#414752]/20 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-['Manrope'] font-bold text-xl text-[#d5e4fa] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#f5c542]">account_balance_wallet</span>
                Distribuir Entrada
              </h3>
              <button onClick={() => { setShowDistPreview(false); setPendingPayload(null); }} className="text-[#8b919e] hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="bg-[#051424] p-4 rounded-lg mb-4 flex justify-between items-center">
              <span className="text-xs text-[#8b919e] uppercase tracking-widest">Valor Total</span>
              <span className="text-2xl font-['Manrope'] font-black text-[#40e56c]">{formatBRL(pendingPayload?.entrada || 0)}</span>
            </div>

            <div className="space-y-2 mb-6">
              <p className="text-[10px] text-[#8b919e] uppercase tracking-widest font-bold">Distribuição nos Caixas</p>
              {distPreviews.map(p => (
                <div key={p.caixaId} className="flex justify-between items-center bg-[#051424] px-4 py-3 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#1976d2]/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-sm text-[#a5c8ff]">account_balance</span>
                    </div>
                    <div>
                      <span className="text-sm text-[#d5e4fa] font-medium">{p.caixaName}</span>
                      <span className="text-[10px] text-[#8b919e] ml-2">({p.percent}%)</span>
                    </div>
                  </div>
                  <span className="font-['Manrope'] font-bold text-[#40e56c]">{formatBRL(p.valor)}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleConfirmDistribution}
                disabled={distributing}
                className="flex-1 py-3 bg-[#40e56c] text-[#003912] font-black rounded-lg uppercase tracking-widest text-xs hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {distributing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#003912]" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    Confirmar Distribuição
                  </>
                )}
              </button>
              <button
                onClick={() => { setShowDistPreview(false); setPendingPayload(null); }}
                className="px-6 py-3 border border-white/10 text-[#8b919e] font-bold rounded-lg text-xs hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
