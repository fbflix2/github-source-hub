import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const formatBRL = (v: number) => {
  const safe = Number(v) || 0;
  return safe.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

interface Distribuicao {
  id: string; data: string; entrada_dia: number; percentuais: Record<string, number>;
  valores_alocados: Record<string, number>; aplicado: boolean; created_at: string;
}

interface CaixaInfo {
  id: string; nome: string; saldo_atual: number; meta: number; tipo: string;
}

const COLORS = [
  "#a5c8ff", "#40e56c", "#ffb4a8", "#93c5fd", "#f5c542", "#8b919e",
  "#c084fc", "#f97316", "#22d3ee", "#fb7185", "#a3e635", "#e879f9",
];

const getColor = (index: number) => COLORS[index % COLORS.length];

const defaultPerc: Record<string, number> = {
  capital_giro: 2, fundos_reserva: 13, dividendos: 1, operacional: 72, dia_a_dia: 2, pro_labore: 10,
};

const defaultLabels: Record<string, string> = {
  capital_giro: "Capital Giro",
  fundos_reserva: "Fundos",
  dividendos: "Dividendos",
  operacional: "Operacional",
  pro_labore: "Pro Labore",
  dia_a_dia: "Dia a Dia",
};

const caixaMap: Record<string, string> = {
  capital_giro: "Capital de Giro",
  fundos_reserva: "Fundos Reserva/Crise",
  dividendos: "Dividendos",
  operacional: "Operacional",
  pro_labore: "Pro Labore",
  dia_a_dia: "Dia a Dia/Emergências",
};

const keyToLabel = (key: string): string => defaultLabels[key] || key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

export function FbDistribuicaoPJ() {
  const [percentuais, setPercentuais] = useState<Record<string, number>>(defaultPerc);
  const [entradaHoje, setEntradaHoje] = useState("1000");
  const [distribuicoes, setDistribuicoes] = useState<Distribuicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailDist, setDetailDist] = useState<Distribuicao | null>(null);
  const [redirectPopup, setRedirectPopup] = useState<{ excedente: number; valores: Record<string, number> } | null>(null);
  const [redirectTarget, setRedirectTarget] = useState("");
  const [caixasList, setCaixasList] = useState<CaixaInfo[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCardName, setNewCardName] = useState("");
  const [newCardPerc, setNewCardPerc] = useState("0");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data: config } = await supabase.from("fb_finance_config" as any).select("distribution_percentages").limit(1).single();
    if (config && (config as any).distribution_percentages) {
      const saved = (config as any).distribution_percentages;
      const clean: Record<string, number> = {};
      for (const [k, v] of Object.entries(saved)) {
        clean[k] = Number(v) || 0;
      }
      setPercentuais(clean);
    }
    const { data: dist } = await supabase.from("fb_finance_distribuicoes" as any).select("*").order("data", { ascending: false }).limit(30);
    if (dist) setDistribuicoes(dist as any);
    const { data: caixas } = await supabase.from("fb_finance_caixas" as any).select("id, nome, saldo_atual, meta, tipo");
    if (caixas) setCaixasList(caixas as any);
    setLoading(false);
  };

  const keys = Object.keys(percentuais);
  const somaPerc = Object.values(percentuais).reduce((s, v) => s + (Number(v) || 0), 0);
  const isValid = Math.abs(somaPerc - 100) < 0.01;
  const entradaNum = parseFloat(entradaHoje) || 0;

  const adjustPerc = (key: string, delta: number) => {
    const current = Number(percentuais[key]) || 0;
    setPercentuais({ ...percentuais, [key]: Math.max(0, current + delta) });
  };

  const handleRemoveCard = (key: string) => {
    if (keys.length <= 1) return;
    const next = { ...percentuais };
    delete next[key];
    setPercentuais(next);
  };

  const handleAddCard = () => {
    if (!newCardName.trim()) { toast({ title: "Informe o nome", variant: "destructive" }); return; }
    const key = newCardName.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (percentuais[key] !== undefined) { toast({ title: "Já existe um card com esse nome", variant: "destructive" }); return; }
    setPercentuais({ ...percentuais, [key]: Number(newCardPerc) || 0 });
    // Also save label mapping
    defaultLabels[key] = newCardName.trim();
    caixaMap[key] = newCardName.trim();
    setNewCardName("");
    setNewCardPerc("0");
    setShowAddModal(false);
  };

  const handleResetDefaults = () => setPercentuais({ ...defaultPerc });

  const handleSavePerc = async () => {
    if (!isValid) { toast({ title: "A soma dos % deve ser 100%", variant: "destructive" }); return; }
    await supabase.from("fb_finance_config" as any).update({ distribution_percentages: percentuais } as any).neq("id", "00000000-0000-0000-0000-000000000000");
    toast({ title: "Percentuais salvos!" });
  };

  const handleDistribuir = async () => {
    if (!entradaNum || entradaNum <= 0) { toast({ title: "Informe a entrada do dia", variant: "destructive" }); return; }
    if (!isValid) { toast({ title: "A soma dos % deve ser 100%", variant: "destructive" }); return; }

    const valores: Record<string, number> = {};
    for (const key of keys) {
      valores[key] = entradaNum * ((Number(percentuais[key]) || 0) / 100);
    }

    // Check Pro Labore meta
    const proLaboreCaixa = caixasList.find(c => c.nome === "Pro Labore");
    if (proLaboreCaixa && proLaboreCaixa.meta > 0 && valores.pro_labore) {
      const saldoAtual = Number(proLaboreCaixa.saldo_atual) || 0;
      const novoSaldo = saldoAtual + valores.pro_labore;
      if (novoSaldo > proLaboreCaixa.meta) {
        const excedente = novoSaldo - proLaboreCaixa.meta;
        valores.pro_labore = Math.max(0, proLaboreCaixa.meta - saldoAtual);
        setRedirectPopup({ excedente, valores });
        return;
      }
    }

    await executeDistribution(valores);
  };

  const executeDistribution = async (valores: Record<string, number>) => {
    const hoje = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("fb_finance_distribuicoes" as any).insert({
      data: hoje, entrada_dia: entradaNum, percentuais, valores_alocados: valores, aplicado: true,
    } as any);
    if (error) { toast({ title: "Erro ao distribuir", variant: "destructive" }); return; }

    const { data: caixas } = await supabase.from("fb_finance_caixas" as any).select("id, nome, saldo_atual");
    if (caixas) {
      await Promise.all(
        Object.entries(valores).map(async ([key, val]) => {
          const nome = caixaMap[key] || keyToLabel(key);
          const caixa = (caixas as any[]).find((c: any) => c.nome === nome);
          if (!caixa || !val) return;
          const newBalance = Number(caixa.saldo_atual) + Number(val);
          await supabase.from("fb_finance_caixas" as any).update({ saldo_atual: newBalance } as any).eq("id", caixa.id);
        })
      );
    }

    toast({ title: "Distribuição aplicada com sucesso!" });
    setEntradaHoje("1000");
    setRedirectPopup(null);
    fetchData();
  };

  const handleRedirectConfirm = async () => {
    if (!redirectPopup || !redirectTarget) {
      toast({ title: "Selecione o caixa destino", variant: "destructive" });
      return;
    }
    const valores = { ...redirectPopup.valores };
    const targetKey = Object.entries(caixaMap).find(([_, nome]) => nome === redirectTarget)?.[0];
    if (targetKey) {
      valores[targetKey] = (valores[targetKey] || 0) + redirectPopup.excedente;
    }
    await executeDistribution(valores);
  };

  const handleDeleteDist = async (id: string) => {
    if (!confirm("Excluir esta distribuição?")) return;
    const dist = distribuicoes.find((item) => item.id === id);
    if (!dist) return;

    const { data: caixas } = await supabase.from("fb_finance_caixas" as any).select("id, nome, saldo_atual");
    if (caixas) {
      await Promise.all(
        Object.entries(dist.valores_alocados || {}).map(async ([key, val]) => {
          const nome = caixaMap[key] || keyToLabel(key);
          const caixa = (caixas as any[]).find((c: any) => c.nome === nome);
          const valorAlocado = Number(val) || 0;
          if (!caixa || !valorAlocado) return;
          await supabase.from("fb_finance_caixas" as any).update({ saldo_atual: Math.max(Number(caixa.saldo_atual) - valorAlocado, 0) } as any).eq("id", caixa.id);
        })
      );
    }

    await supabase.from("fb_finance_distribuicoes" as any).delete().eq("id", id);
    toast({ title: "Distribuição removida" });
    fetchData();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#a5c8ff]" /></div>;

  const otherCaixas = caixasList.filter(c => c.nome !== "Pro Labore" && c.tipo === "empresa");

  return (
    <section className="p-8 max-w-7xl mx-auto space-y-12">
      {/* Configuração de Percentuais */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-['Manrope'] text-xl font-bold tracking-tight text-[#d5e4fa] flex items-center gap-3">
            <span className="w-1.5 h-6 bg-[#1976d2] rounded-full"></span>
            Configuração de Percentuais
          </h3>
          <div className="flex items-center gap-4">
            <button onClick={handleResetDefaults} className="text-[#a5c8ff] text-sm font-medium hover:underline">
              Redefinir Padrões
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {keys.map((key, i) => (
            <div key={key} className="bg-[#0e1c2d] p-6 rounded-xl border-l-4 shadow-lg transition-transform hover:-translate-y-1 duration-300 relative group/card" style={{ borderLeftColor: getColor(i) }}>
              <button
                onClick={() => handleRemoveCard(key)}
                className="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 transition-opacity text-[#8b919e] hover:text-[#e71a0e]"
                title="Remover"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
              <p className="text-xs uppercase tracking-widest text-[#8b919e] mb-4">{keyToLabel(key)}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-['Manrope'] font-extrabold text-[#d5e4fa]">{Number(percentuais[key]) || 0}</span>
                <span className="text-xl font-['Manrope'] font-bold" style={{ color: getColor(i) }}>%</span>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => adjustPerc(key, -1)} className="p-1 rounded bg-white/5 hover:bg-white/10 text-[#d5e4fa]">
                  <span className="material-symbols-outlined text-sm">remove</span>
                </button>
                <button onClick={() => adjustPerc(key, 1)} className="p-1 rounded bg-white/5 hover:bg-white/10 text-[#d5e4fa]">
                  <span className="material-symbols-outlined text-sm">add</span>
                </button>
              </div>
            </div>
          ))}

          {/* Add Card Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-[#0e1c2d]/50 p-6 rounded-xl border-2 border-dashed border-white/10 hover:border-[#a5c8ff]/40 flex flex-col items-center justify-center gap-2 transition-all hover:-translate-y-1 duration-300 min-h-[140px]"
          >
            <span className="material-symbols-outlined text-2xl text-[#a5c8ff]/60">add_circle</span>
            <span className="text-xs text-[#8b919e] font-medium">Adicionar</span>
          </button>
        </div>

        <div className="flex items-center gap-4 mt-4">
          <div className={`flex items-center gap-2 text-sm font-medium ${isValid ? "text-[#40e56c]" : "text-[#e71a0e]"}`}>
            <span className="material-symbols-outlined text-sm">{isValid ? "check_circle" : "warning"}</span>
            Soma: {somaPerc.toFixed(1)}%
          </div>
          <button onClick={handleSavePerc} className="text-[#a5c8ff] text-sm font-bold hover:underline">Salvar Percentuais</button>
        </div>
      </div>

      {/* Prova Real + Histórico */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-1 bg-[#0e1c2d]/80 backdrop-blur-xl p-8 rounded-2xl border border-white/5 shadow-2xl">
          <h3 className="font-['Manrope'] text-lg font-bold mb-6 flex items-center gap-2 text-[#d5e4fa]">
            <span className="material-symbols-outlined text-[#a5c8ff]">calculate</span>
            Prova Real
          </h3>
          <div className="space-y-6">
            <div>
              <label className="block text-xs uppercase tracking-widest text-[#8b919e] mb-2">Valor de Entrada (R$)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a5c8ff] font-bold">R$</span>
                <input
                  type="text"
                  value={Number(entradaHoje).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  onChange={e => {
                    const raw = e.target.value.replace(/\D/g, "");
                    setEntradaHoje(String(Number(raw) / 100));
                  }}
                  className="w-full bg-[#283647] border-none focus:ring-2 focus:ring-[#a5c8ff]/20 rounded-lg pl-12 py-4 text-xl font-['Manrope'] font-bold text-[#d5e4fa] outline-none"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 space-y-3">
              {keys.map((key, i) => (
                <div key={key} className="flex justify-between items-center group">
                  <span className="text-sm text-[#8b919e] group-hover:text-[#d5e4fa] transition-colors">{keyToLabel(key)}</span>
                  <span className="font-['Manrope'] font-bold" style={{ color: getColor(i) }}>
                    {formatBRL(entradaNum * (Number(percentuais[key]) || 0) / 100)}
                  </span>
                </div>
              ))}
            </div>

            <button onClick={handleDistribuir}
              className="w-full mt-6 py-4 bg-[#40e56c] text-[#003912] font-black rounded-lg uppercase tracking-widest text-xs hover:brightness-110 active:scale-95 transition-all">
              Confirmar Distribuição
            </button>
          </div>
        </div>

        {/* Histórico */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="font-['Manrope'] text-xl font-bold tracking-tight text-[#d5e4fa]">Histórico Recente</h3>
          <div className="bg-[#0e1c2d] rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#122031] text-[#8b919e]">
                  <th className="px-6 py-4 text-xs uppercase tracking-widest font-semibold">Data</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-widest font-semibold text-right">Entrada</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-widest font-semibold">Status</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-widest font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {distribuicoes.length === 0 ? (
                  <tr><td colSpan={4} className="text-center text-[#8b919e]/40 py-12">Nenhuma distribuição realizada</td></tr>
                ) : distribuicoes.map((d) => (
                  <tr key={d.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-[#d5e4fa]">
                          {new Date(d.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                        <span className="text-xs text-[#8b919e]">
                          {new Date(d.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right font-['Manrope'] font-bold text-[#d5e4fa]">
                      {formatBRL(Number(d.entrada_dia))}
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${d.aplicado ? "bg-[#40e56c]/10 text-[#40e56c]" : "bg-[#e71a0e]/20 text-[#ffb4a8]"}`}>
                        {d.aplicado ? "Processado" : "Pendente"}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right flex items-center justify-end gap-2">
                      <button onClick={() => setDetailDist(d)} className="text-[#8b919e] hover:text-[#a5c8ff] transition-colors" title="Ver detalhes">
                        <span className="material-symbols-outlined">visibility</span>
                      </button>
                      <button onClick={() => handleDeleteDist(d.id)} className="text-[#8b919e] hover:text-[#e71a0e] transition-colors opacity-0 group-hover:opacity-100" title="Excluir">
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {detailDist && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDetailDist(null)}>
          <div className="bg-[#0e1c2d] rounded-2xl w-full max-w-md shadow-2xl border border-[#414752]/20 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-['Manrope'] font-bold text-xl text-[#d5e4fa]">Detalhes da Distribuição</h3>
              <button onClick={() => setDetailDist(null)} className="text-[#8b919e] hover:text-white"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-[#051424] p-4 rounded-lg">
                <span className="text-xs text-[#8b919e] uppercase">Data</span>
                <span className="text-sm font-bold text-[#d5e4fa]">{new Date(detailDist.data + "T12:00:00").toLocaleDateString("pt-BR")}</span>
              </div>
              <div className="flex justify-between items-center bg-[#051424] p-4 rounded-lg">
                <span className="text-xs text-[#8b919e] uppercase">Entrada Total</span>
                <span className="text-lg font-bold text-[#40e56c]">{formatBRL(Number(detailDist.entrada_dia))}</span>
              </div>
              <div className="border-t border-white/10 pt-4 space-y-3">
                <p className="text-xs text-[#8b919e] uppercase tracking-widest font-bold">Alocações</p>
                {Object.entries(detailDist.valores_alocados || {}).map(([key, val], i) => {
                  const perc = (detailDist.percentuais as any)?.[key] || 0;
                  return (
                    <div key={key} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: getColor(i) }}></span>
                        <span className="text-sm text-[#c1c6d4]">{keyToLabel(key)}</span>
                        <span className="text-[10px] text-[#8b919e]">({perc}%)</span>
                      </div>
                      <span className="text-sm font-bold text-[#d5e4fa]">{formatBRL(Number(val))}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Card Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <div className="bg-[#0e1c2d] rounded-2xl w-full max-w-sm shadow-2xl border border-[#414752]/20 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-['Manrope'] font-bold text-lg text-[#d5e4fa]">Novo Percentual</h3>
              <button onClick={() => setShowAddModal(false)} className="text-[#8b919e] hover:text-white"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-widest text-[#8b919e] mb-2">Nome do Caixa</label>
                <input
                  type="text"
                  value={newCardName}
                  onChange={e => setNewCardName(e.target.value)}
                  placeholder="Ex: Investimentos"
                  className="w-full bg-[#283647] border-none focus:ring-2 focus:ring-[#a5c8ff]/20 rounded-lg px-4 py-3 text-sm text-[#d5e4fa] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-[#8b919e] mb-2">Percentual Inicial (%)</label>
                <input
                  type="number"
                  value={newCardPerc}
                  onChange={e => setNewCardPerc(e.target.value)}
                  min="0" max="100"
                  className="w-full bg-[#283647] border-none focus:ring-2 focus:ring-[#a5c8ff]/20 rounded-lg px-4 py-3 text-sm text-[#d5e4fa] outline-none"
                />
              </div>
              <button onClick={handleAddCard} className="w-full py-3 bg-[#a5c8ff] text-[#0a1929] font-bold rounded-lg hover:brightness-110 transition-all">
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Redirect Pro Labore Popup */}
      {redirectPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setRedirectPopup(null)}>
          <div className="bg-[#0e1c2d] rounded-2xl w-full max-w-md shadow-2xl border border-[#f5c542]/30 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-[#f5c542] text-2xl">account_balance_wallet</span>
              <h3 className="font-['Manrope'] font-bold text-lg text-[#d5e4fa]">Meta Pro Labore Atingida!</h3>
            </div>
            <p className="text-sm text-[#8b919e] mb-4">
              O excedente de <span className="font-bold text-[#f5c542]">{formatBRL(redirectPopup.excedente)}</span> precisa ser redirecionado para outro caixa.
            </p>
            <div className="space-y-2 mb-6">
              <label className="text-xs uppercase tracking-widest text-[#8b919e] font-bold">Enviar excedente para:</label>
              <div className="grid grid-cols-1 gap-2">
                {otherCaixas.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setRedirectTarget(c.nome)}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                      redirectTarget === c.nome
                        ? "border-[#f5c542] bg-[#f5c542]/10 text-[#f5c542]"
                        : "border-white/10 bg-[#051424] text-[#8b919e] hover:border-white/20"
                    }`}
                  >
                    <span className="text-sm font-medium">{c.nome}</span>
                    <span className="text-xs">{formatBRL(Number(c.saldo_atual))}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRedirectPopup(null)} className="flex-1 py-3 rounded-lg border border-white/10 text-[#8b919e] text-sm font-medium hover:bg-white/5">Cancelar</button>
              <button onClick={handleRedirectConfirm} className="flex-1 py-3 rounded-lg bg-[#f5c542] text-[#1a1400] text-sm font-black hover:brightness-110">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
