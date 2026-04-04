import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { buildDisplayCaixaBalanceMap } from "@/lib/fb-finance";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatCompact = (v: number) => formatBRL(v);

interface Caixa { id: string; nome: string; saldo_atual: number; alvo_percent: number; tipo: string; meta: number }
interface Lancamento { id: string; data: string; descricao: string | null; entrada: number; saida: number; categoria: string; caixa_destino_id: string | null }

const caixaIcons: Record<string, { icon: string; color: string; bg: string }> = {
  "Fundo Emergência": { icon: "security", color: "text-[#a5c8ff]", bg: "bg-blue-500/10" },
  "Estilo de Vida": { icon: "flight_takeoff", color: "text-yellow-500", bg: "bg-yellow-500/10" },
  "Investimentos": { icon: "monitoring", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  "Capital de Giro": { icon: "account_balance", color: "text-[#a5c8ff]", bg: "bg-blue-500/10" },
  "Fundos Reserva": { icon: "shield", color: "text-[#40e56c]", bg: "bg-green-500/10" },
  "Fundos Reserva/Colchão": { icon: "shield", color: "text-[#40e56c]", bg: "bg-green-500/10" },
  "Fundos Reserva/Crise": { icon: "shield", color: "text-[#40e56c]", bg: "bg-green-500/10" },
  "Dividendos": { icon: "payments", color: "text-yellow-400", bg: "bg-yellow-500/10" },
  "Operacional": { icon: "business_center", color: "text-cyan-400", bg: "bg-cyan-500/10" },
  "Dia a Dia": { icon: "shopping_cart", color: "text-orange-400", bg: "bg-orange-500/10" },
  "Dia a Dia/Emergências": { icon: "shopping_cart", color: "text-orange-400", bg: "bg-orange-500/10" },
  "Conta Corrente Pessoal": { icon: "account_balance_wallet", color: "text-[#a5c8ff]", bg: "bg-blue-500/10" },
  "Janela Oportunidade": { icon: "trending_up", color: "text-purple-400", bg: "bg-purple-500/10" },
};

const defaultIcon = { icon: "savings", color: "text-[#ffb4a8]", bg: "bg-red-500/10" };

const ModalOverlay = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="bg-[#0e1c2d] rounded-2xl w-full max-w-lg shadow-2xl border border-[#414752]/20">
      {children}
    </div>
  </div>
);

export function FbCaixas() {
  const [caixas, setCaixas] = useState<Caixa[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCaixa, setSelectedCaixa] = useState<Caixa | null>(null);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loadingLanc, setLoadingLanc] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editCaixa, setEditCaixa] = useState<Caixa | null>(null);
  const [editSaldoCaixa, setEditSaldoCaixa] = useState<Caixa | null>(null);
  const [editSaldoValue, setEditSaldoValue] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  const [newForm, setNewForm] = useState({ nome: "", tipo: "empresa", alvo_percent: "0" });
  const [transferForm, setTransferForm] = useState({ from: "", to: "", valor: "" });
  const [editForm, setEditForm] = useState({ nome: "", tipo: "empresa", alvo_percent: "0", meta: "0" });

  useEffect(() => { fetchCaixas(); }, []);

  const fetchCaixas = async () => {
    const [{ data: caixasData }, { data: lancamentosData }] = await Promise.all([
      supabase.from("fb_finance_caixas" as any).select("*").order("tipo").order("nome"),
      supabase.from("fb_finance_lancamentos" as any).select("id, caixa_destino_id, entrada, saida"),
    ]);

    const caixaRows = (caixasData as any[]) || [];
    const saldoMap = buildDisplayCaixaBalanceMap(caixaRows, (lancamentosData as any[]) || []);

    setCaixas(
      caixaRows.map((caixa) => ({
        ...caixa,
        saldo_atual: saldoMap[caixa.id] ?? Number(caixa.saldo_atual || 0),
      })) as any
    );
    setLoading(false);
  };

  const openDetails = async (c: Caixa) => {
    setSelectedCaixa(c);
    setLoadingLanc(true);
    const { data } = await supabase
      .from("fb_finance_lancamentos" as any)
      .select("*")
      .eq("caixa_destino_id", c.id)
      .order("data", { ascending: false })
      .limit(50);
    setLancamentos((data as any) || []);
    setLoadingLanc(false);
  };

  const handleCreateCaixa = async () => {
    if (!newForm.nome.trim()) { toast({ title: "Informe o nome", variant: "destructive" }); return; }
    const { error } = await supabase.from("fb_finance_caixas" as any).insert({
      nome: newForm.nome, tipo: newForm.tipo, alvo_percent: parseFloat(newForm.alvo_percent) || 0, saldo_atual: 0,
    } as any);
    if (error) { toast({ title: "Erro ao criar caixa", variant: "destructive" }); return; }
    toast({ title: "Caixa criada com sucesso!" });
    setNewForm({ nome: "", tipo: "empresa", alvo_percent: "0" });
    setShowNewModal(false);
    fetchCaixas();
  };

  const handleTransfer = async () => {
    const valor = parseFloat(transferForm.valor);
    if (!transferForm.from || !transferForm.to || !valor || valor <= 0) {
      toast({ title: "Preencha todos os campos", variant: "destructive" }); return;
    }
    if (transferForm.from === transferForm.to) {
      toast({ title: "Origem e destino devem ser diferentes", variant: "destructive" }); return;
    }
    const fromCaixa = caixas.find(c => c.id === transferForm.from);
    const toCaixa = caixas.find(c => c.id === transferForm.to);
    if (!fromCaixa || !toCaixa) return;
    if (Number(fromCaixa.saldo_atual) < valor) {
      toast({ title: "Saldo insuficiente na caixa de origem", variant: "destructive" }); return;
    }

    await Promise.all([
      supabase.from("fb_finance_caixas" as any).update({ saldo_atual: Number(fromCaixa.saldo_atual) - valor } as any).eq("id", fromCaixa.id),
      supabase.from("fb_finance_caixas" as any).update({ saldo_atual: Number(toCaixa.saldo_atual) + valor } as any).eq("id", toCaixa.id),
    ]);

    const hoje = new Date().toISOString().split("T")[0];
    await supabase.from("fb_finance_lancamentos" as any).insert([
      { data: hoje, tipo: "empresa", categoria: "Transferência", descricao: `Transferência para ${toCaixa.nome}`, saida: valor, entrada: 0, caixa_destino_id: fromCaixa.id },
      { data: hoje, tipo: "empresa", categoria: "Transferência", descricao: `Transferência de ${fromCaixa.nome}`, entrada: valor, saida: 0, caixa_destino_id: toCaixa.id },
    ] as any);

    toast({ title: `${formatBRL(valor)} transferido com sucesso!` });
    setTransferForm({ from: "", to: "", valor: "" });
    setShowTransferModal(false);
    fetchCaixas();
  };

  const handleEditCaixa = async () => {
    if (!editCaixa || !editForm.nome.trim()) return;
    await supabase.from("fb_finance_caixas" as any).update({
      nome: editForm.nome, tipo: editForm.tipo, alvo_percent: parseFloat(editForm.alvo_percent) || 0, meta: parseFloat(editForm.meta) || 0,
    } as any).eq("id", editCaixa.id);
    toast({ title: "Caixa atualizada!" });
    setEditCaixa(null);
    fetchCaixas();
  };

  const handleDeleteCaixa = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta caixa?")) return;
    await supabase.from("fb_finance_caixas" as any).delete().eq("id", id);
    toast({ title: "Caixa removida" });
    setMenuOpenId(null);
    fetchCaixas();
  };

  const totalPatrimonio = caixas.reduce((s, c) => s + Number(c.saldo_atual), 0);
  const totalAlvo = caixas.reduce((s, c) => s + (Number(c.alvo_percent) > 0 ? Number(c.saldo_atual) / (Number(c.alvo_percent) / 100) : 0), 0);
  const healthPercent = totalAlvo > 0 ? Math.min((totalPatrimonio / totalAlvo) * 100, 100) : 85;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#a5c8ff]" /></div>;

  // ModalOverlay extracted as stable function to avoid re-mount on every render
  const renderModalOverlay = (onClose: () => void, children: React.ReactNode) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#0e1c2d] rounded-2xl w-full max-w-lg shadow-2xl border border-[#414752]/20">
        {children}
      </div>
    </div>
  );

  return (
    <section className="p-6 md:p-10 max-w-7xl mx-auto">
      {/* Hero Header */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <nav className="flex items-center gap-2 text-xs text-[#8b919e] uppercase tracking-widest mb-4" style={{ fontFamily: "Inter" }}>
            <span>Início</span>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <span className="text-[#a5c8ff]">Caixas / Envelopes</span>
          </nav>
          <h2 className="font-['Manrope'] font-extrabold text-4xl md:text-5xl text-[#d5e4fa] tracking-tight">
            Gestão de <span className="text-[#a5c8ff]">Envelopes</span>
          </h2>
          <p className="text-[#c1c6d4] max-w-lg text-sm md:text-base leading-relaxed">
            Organize sua vida financeira separando seu capital em caixas estratégicas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowTransferModal(true)} className="bg-[#1d2b3c] text-[#d5e4fa] hover:bg-[#283647] border border-[#414752]/20 px-5 py-3 rounded-md text-sm font-semibold flex items-center gap-2 transition-all">
            <span className="material-symbols-outlined text-lg">swap_horiz</span>
            Transferir entre Caixas
          </button>
          <button onClick={() => setShowNewModal(true)} className="bg-[#1976d2] text-white px-6 py-3 rounded-md text-sm font-bold flex items-center gap-2 shadow-lg shadow-[#1976d2]/20 active:scale-95 transition-all">
            <span className="material-symbols-outlined text-lg">add</span>
            Nova Caixa
          </button>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="md:col-span-2 bg-gradient-to-br from-[#1976d2] to-blue-900 p-8 rounded-xl shadow-2xl relative overflow-hidden">
          <div className="relative z-10">
            <span className="text-xs uppercase tracking-[0.2em] text-blue-100/70 font-bold mb-2 block">Patrimônio Reservado</span>
            <h3 className="text-5xl font-['Manrope'] font-black text-white mb-6 tracking-tighter">{formatBRL(totalPatrimonio)}</h3>
            <span className="text-blue-200/60 text-xs">{caixas.length} caixas ativas</span>
          </div>
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
          <div className="absolute right-8 top-8 opacity-20">
            <span className="material-symbols-outlined text-7xl text-white" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance</span>
          </div>
        </div>
        <div className="bg-[#0e1c2d] p-6 rounded-xl border-l-4 border-[#40e56c] flex flex-col justify-between">
          <div>
            <span className="text-xs text-[#8b919e] uppercase tracking-wider block mb-1">Saúde das Reservas</span>
            <p className="text-2xl font-['Manrope'] font-bold text-[#40e56c]">{healthPercent >= 80 ? "Excelente" : healthPercent >= 50 ? "Bom" : "Atenção"}</p>
          </div>
          <div className="h-1.5 bg-[#283647] rounded-full w-full overflow-hidden my-3">
            <div className="h-full bg-[#40e56c] rounded-full" style={{ width: `${healthPercent}%` }}></div>
          </div>
          <p className="text-xs text-[#c1c6d4]">{healthPercent.toFixed(0)}% do planejado.</p>
        </div>
      </div>

      {/* PJ Section */}
      {(() => {
        const pjNames = ["Capital de Giro", "Dividendos", "Fundos Reserva/Crise", "Fundos Reserva", "Fundos Reserva/Colchão", "Operacional"];
        const pjCaixas = caixas.filter(c => pjNames.some(n => c.nome.toLowerCase().includes(n.toLowerCase())) || (c.tipo === "empresa" && !["Dia a Dia", "Dia a Dia/Emergências", "Estilo de Vida", "Fundo Emergência", "Investimentos", "Janela Oportunidade", "Conta Corrente Pessoal"].some(n => c.nome.toLowerCase().includes(n.toLowerCase()))));
        const pessoalCaixas = caixas.filter(c => !pjCaixas.includes(c));

        const renderCard = (c: Caixa) => {
          const saldo = Number(c.saldo_atual);
          const iconCfg = caixaIcons[c.nome] || defaultIcon;
          const meta = Number(c.meta) > 0 ? Number(c.meta) : (c.alvo_percent > 0 ? saldo / (c.alvo_percent / 100) : saldo * 1.5);
          const progress = meta > 0 ? Math.min((saldo / meta) * 100, 100) : 0;
          const metaAtingida = progress >= 100;

          return (
            <div key={c.id} className="bg-[#0e1c2d] group hover:bg-[#122031] transition-all duration-300 p-6 rounded-xl relative">
              <div className="flex justify-between items-start mb-6">
                <div className={`w-12 h-12 rounded-lg ${iconCfg.bg} flex items-center justify-center ${iconCfg.color}`}>
                  <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>{iconCfg.icon}</span>
                </div>
                <div className="relative">
                  <button onClick={() => setMenuOpenId(menuOpenId === c.id ? null : c.id)} className="text-[#8b919e] hover:text-[#d5e4fa] transition-colors">
                    <span className="material-symbols-outlined">more_vert</span>
                  </button>
                  {menuOpenId === c.id && (
                    <div ref={menuRef} className="absolute right-0 top-8 bg-[#122031] border border-[#414752]/30 rounded-lg shadow-2xl py-1 z-50 min-w-[140px]">
                      <button onClick={() => { setEditCaixa(c); setEditForm({ nome: c.nome, tipo: c.tipo, alvo_percent: String(c.alvo_percent), meta: String(Number(c.meta) || 0) }); setMenuOpenId(null); }}
                        className="w-full text-left px-4 py-2 text-xs text-[#d5e4fa] hover:bg-white/5 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">edit</span> Editar
                      </button>
                      <button onClick={() => { setEditSaldoCaixa(c); setEditSaldoValue(String(Number(c.saldo_atual))); setMenuOpenId(null); }}
                        className="w-full text-left px-4 py-2 text-xs text-[#d5e4fa] hover:bg-white/5 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">attach_money</span> Editar Saldo
                      </button>
                      <button onClick={() => handleDeleteCaixa(c.id)}
                        className="w-full text-left px-4 py-2 text-xs text-[#e71a0e] hover:bg-white/5 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">delete</span> Excluir
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <h4 className="font-['Manrope'] font-bold text-lg text-[#d5e4fa] mb-1">{c.nome}</h4>
              <p className="text-xs text-[#8b919e] mb-4">
                {c.tipo === "pessoal" ? "Envelope pessoal" : "Envelope empresarial"}
                {c.alvo_percent > 0 && ` • ${c.alvo_percent}% alvo`}
              </p>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-[#c1c6d4] font-medium">Saldo Atual</span>
                    <span className="text-[#40e56c] font-bold">{formatCompact(saldo)}</span>
                  </div>
                  <div className="h-2 bg-[#283647] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${metaAtingida ? "bg-[#40e56c] shadow-[0_0_10px_rgba(64,229,108,0.4)]" : "bg-[#40e56c]"}`} style={{ width: `${progress}%` }}></div>
                  </div>
                  <div className="flex justify-between text-[10px] mt-2 text-[#8b919e]">
                    {metaAtingida ? (
                      <span className="text-[#40e56c] font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[10px]">check_circle</span> META ATINGIDA
                      </span>
                    ) : (
                      <span>{progress.toFixed(0)}% concluído</span>
                    )}
                    <span>Meta: {formatCompact(meta)}</span>
                  </div>
                </div>
              </div>

              <button onClick={() => openDetails(c)} className="mt-6 w-full py-2 border border-[#414752]/30 rounded text-xs font-bold text-[#c1c6d4] group-hover:bg-[#1976d2] group-hover:text-white group-hover:border-transparent transition-all">
                Ver Detalhes
              </button>
            </div>
          );
        };

        return (
          <>
            {pjCaixas.length > 0 && (
              <>
                <h3 className="font-['Manrope'] font-bold text-xl text-[#d5e4fa] mb-6 flex items-center gap-3">
                  <span className="w-8 h-[2px] bg-[#1976d2]"></span>
                  <span className="material-symbols-outlined text-[#1976d2]" style={{ fontVariationSettings: "'FILL' 1" }}>business</span>
                  Caixas PJ
                  <span className="text-xs font-medium text-[#8b919e] ml-2">({pjCaixas.length})</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                  {pjCaixas.map(renderCard)}
                </div>
              </>
            )}

            {pessoalCaixas.length > 0 && (
              <>
                <h3 className="font-['Manrope'] font-bold text-xl text-[#d5e4fa] mb-6 flex items-center gap-3">
                  <span className="w-8 h-[2px] bg-[#40e56c]"></span>
                  <span className="material-symbols-outlined text-[#40e56c]" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
                  Caixas Pessoal
                  <span className="text-xs font-medium text-[#8b919e] ml-2">({pessoalCaixas.length})</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {pessoalCaixas.map(renderCard)}
                </div>
              </>
            )}
          </>
        );
      })()}

      {/* Detail Modal */}
      {selectedCaixa && (
        {renderModalOverlay(() => setSelectedCaixa(null),
          <div className="max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-[#414752]/20 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {(() => {
                  const ic = caixaIcons[selectedCaixa.nome] || defaultIcon;
                  return (
                    <div className={`w-12 h-12 rounded-lg ${ic.bg} flex items-center justify-center ${ic.color}`}>
                      <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>{ic.icon}</span>
                    </div>
                  );
                })()}
                <div>
                  <h3 className="font-['Manrope'] font-bold text-xl text-[#d5e4fa]">{selectedCaixa.nome}</h3>
                  <p className="text-xs text-[#8b919e]">
                    {selectedCaixa.tipo === "pessoal" ? "Envelope pessoal" : "Envelope empresarial"}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedCaixa(null)} className="text-[#8b919e] hover:text-white p-2 rounded-lg hover:bg-white/5">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4 p-6 pb-4">
              <div className="bg-[#051424] rounded-lg p-4">
                <span className="text-[10px] text-[#8b919e] uppercase tracking-wider block mb-1">Saldo Atual</span>
                <span className="text-lg font-bold text-[#40e56c]">{formatBRL(Number(selectedCaixa.saldo_atual))}</span>
              </div>
              <div className="bg-[#051424] rounded-lg p-4">
                <span className="text-[10px] text-[#8b919e] uppercase tracking-wider block mb-1">Total Entradas</span>
                <span className="text-lg font-bold text-emerald-400">{formatBRL(lancamentos.reduce((s, l) => s + Number(l.entrada), 0))}</span>
              </div>
              <div className="bg-[#051424] rounded-lg p-4">
                <span className="text-[10px] text-[#8b919e] uppercase tracking-wider block mb-1">Total Saídas</span>
                <span className="text-lg font-bold text-red-400">{formatBRL(lancamentos.reduce((s, l) => s + Number(l.saida), 0))}</span>
              </div>
            </div>
            <div className="px-6 pb-6 overflow-y-auto flex-1" style={{ maxHeight: "400px" }}>
              <h4 className="text-xs text-[#8b919e] uppercase tracking-wider mb-3 font-bold">Últimos Lançamentos</h4>
              {loadingLanc ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#a5c8ff]" /></div>
              ) : lancamentos.length === 0 ? (
                <div className="text-center py-12">
                  <span className="material-symbols-outlined text-4xl text-[#414752] mb-2 block">receipt_long</span>
                  <p className="text-[#8b919e] text-sm">Nenhum lançamento vinculado a esta caixa.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {lancamentos.map(l => {
                    const isEntrada = Number(l.entrada) > 0;
                    return (
                      <div key={l.id} className="flex items-center justify-between bg-[#051424] rounded-lg px-4 py-3 hover:bg-[#0a1a2e] transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isEntrada ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                            <span className="material-symbols-outlined text-base">{isEntrada ? "arrow_downward" : "arrow_upward"}</span>
                          </div>
                          <div>
                            <p className="text-sm text-[#d5e4fa] font-medium">{l.descricao || l.categoria}</p>
                            <p className="text-[10px] text-[#8b919e]">{new Date(l.data).toLocaleDateString("pt-BR")} • {l.categoria}</p>
                          </div>
                        </div>
                        <span className={`text-sm font-bold ${isEntrada ? "text-emerald-400" : "text-red-400"}`}>
                          {isEntrada ? "+" : "-"} {formatBRL(isEntrada ? Number(l.entrada) : Number(l.saida))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      )}

      {/* Nova Caixa Modal */}
      {showNewModal && (
        {renderModalOverlay(() => setShowNewModal(false),
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-['Manrope'] font-bold text-xl text-[#d5e4fa]">Nova Caixa</h3>
              <button onClick={() => setShowNewModal(false)} className="text-[#8b919e] hover:text-white"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-[#8b919e] uppercase tracking-widest block mb-1">Nome</label>
                <input value={newForm.nome} onChange={e => setNewForm({ ...newForm, nome: e.target.value })} placeholder="Ex: Fundo de Emergência"
                  className="w-full bg-[#051424] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#d5e4fa] outline-none focus:ring-2 focus:ring-[#1976d2]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-[#8b919e] uppercase tracking-widest block mb-1">Tipo</label>
                  <select value={newForm.tipo} onChange={e => setNewForm({ ...newForm, tipo: e.target.value })}
                    className="w-full bg-[#051424] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#d5e4fa] outline-none">
                    <option value="empresa">Empresarial</option>
                    <option value="pessoal">Pessoal</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-[#8b919e] uppercase tracking-widest block mb-1">Alvo (%)</label>
                  <input type="number" value={newForm.alvo_percent} onChange={e => setNewForm({ ...newForm, alvo_percent: e.target.value })}
                    className="w-full bg-[#051424] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#d5e4fa] outline-none" />
                </div>
              </div>
              <button onClick={handleCreateCaixa} className="w-full bg-[#1976d2] text-white py-3 rounded-lg font-bold text-sm mt-2 active:scale-[0.98] transition-transform">
                Criar Caixa
              </button>
            </div>
          </div>
        )}
      )}

      {/* Transferir Modal */}
      {showTransferModal && (
        {renderModalOverlay(() => setShowTransferModal(false),
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-['Manrope'] font-bold text-xl text-[#d5e4fa]">Transferir entre Caixas</h3>
              <button onClick={() => setShowTransferModal(false)} className="text-[#8b919e] hover:text-white"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-[#8b919e] uppercase tracking-widest block mb-1">Caixa Origem</label>
                <select value={transferForm.from} onChange={e => setTransferForm({ ...transferForm, from: e.target.value })}
                  className="w-full bg-[#051424] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#d5e4fa] outline-none">
                  <option value="">Selecione...</option>
                  {caixas.map(c => <option key={c.id} value={c.id}>{c.nome} ({formatBRL(Number(c.saldo_atual))})</option>)}
                </select>
              </div>
              <div className="flex justify-center">
                <span className="material-symbols-outlined text-[#1976d2] text-2xl">swap_vert</span>
              </div>
              <div>
                <label className="text-[10px] text-[#8b919e] uppercase tracking-widest block mb-1">Caixa Destino</label>
                <select value={transferForm.to} onChange={e => setTransferForm({ ...transferForm, to: e.target.value })}
                  className="w-full bg-[#051424] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#d5e4fa] outline-none">
                  <option value="">Selecione...</option>
                  {caixas.filter(c => c.id !== transferForm.from).map(c => <option key={c.id} value={c.id}>{c.nome} ({formatBRL(Number(c.saldo_atual))})</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[#8b919e] uppercase tracking-widest block mb-1">Valor (R$)</label>
                <input type="number" step="0.01" value={transferForm.valor} onChange={e => setTransferForm({ ...transferForm, valor: e.target.value })} placeholder="0.00"
                  className="w-full bg-[#051424] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#d5e4fa] outline-none focus:ring-2 focus:ring-[#1976d2]" />
              </div>
              <button onClick={handleTransfer} className="w-full bg-[#40e56c] text-[#003912] py-3 rounded-lg font-bold text-sm mt-2 active:scale-[0.98] transition-transform">
                Confirmar Transferência
              </button>
            </div>
          </div>
        )}
      )}

      {/* Edit Caixa Modal */}
      {editCaixa && (
        {renderModalOverlay(() => setEditCaixa(null),
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-['Manrope'] font-bold text-xl text-[#d5e4fa]">Editar Caixa</h3>
              <button onClick={() => setEditCaixa(null)} className="text-[#8b919e] hover:text-white"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-[#8b919e] uppercase tracking-widest block mb-1">Nome</label>
                <input value={editForm.nome} onChange={e => setEditForm({ ...editForm, nome: e.target.value })}
                  className="w-full bg-[#051424] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#d5e4fa] outline-none focus:ring-2 focus:ring-[#1976d2]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-[#8b919e] uppercase tracking-widest block mb-1">Tipo</label>
                  <select value={editForm.tipo} onChange={e => setEditForm({ ...editForm, tipo: e.target.value })}
                    className="w-full bg-[#051424] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#d5e4fa] outline-none">
                    <option value="empresa">Empresarial</option>
                    <option value="pessoal">Pessoal</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-[#8b919e] uppercase tracking-widest block mb-1">Alvo (%)</label>
                  <input type="number" value={editForm.alvo_percent} onChange={e => setEditForm({ ...editForm, alvo_percent: e.target.value })}
                    className="w-full bg-[#051424] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#d5e4fa] outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-[#8b919e] uppercase tracking-widest block mb-1">Meta (R$)</label>
                <input type="number" step="0.01" value={editForm.meta} onChange={e => setEditForm({ ...editForm, meta: e.target.value })} placeholder="0.00"
                  className="w-full bg-[#051424] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#d5e4fa] outline-none focus:ring-2 focus:ring-[#1976d2]" />
                <p className="text-[9px] text-[#8b919e] mt-1">Defina o valor alvo em R$ para esta caixa. Se vazio, será calculado pelo % alvo.</p>
              </div>
              <button onClick={handleEditCaixa} className="w-full bg-[#1976d2] text-white py-3 rounded-lg font-bold text-sm mt-2 active:scale-[0.98] transition-transform">
                Salvar Alterações
              </button>
            </div>
          </div>
        )}
      )}

      {/* Edit Saldo Modal */}
      {editSaldoCaixa && (
        {renderModalOverlay(() => setEditSaldoCaixa(null),
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-['Manrope'] font-bold text-xl text-[#d5e4fa]">Editar Saldo</h3>
              <button onClick={() => setEditSaldoCaixa(null)} className="text-[#8b919e] hover:text-white"><span className="material-symbols-outlined">close</span></button>
            </div>
            <p className="text-sm text-[#c1c6d4] mb-4">
              Caixa: <span className="font-bold text-[#d5e4fa]">{editSaldoCaixa.nome}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-[#8b919e] uppercase tracking-widest block mb-1">Novo Saldo (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editSaldoValue}
                  onChange={e => setEditSaldoValue(e.target.value)}
                  className="w-full bg-[#051424] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#d5e4fa] outline-none focus:ring-2 focus:ring-[#1976d2]"
                  autoFocus
                />
              </div>
              <button
                onClick={async () => {
                  const val = parseFloat(editSaldoValue);
                  if (isNaN(val)) { toast({ title: "Valor inválido", variant: "destructive" }); return; }
                  await supabase.from("fb_finance_caixas" as any).update({ saldo_atual: val } as any).eq("id", editSaldoCaixa.id);
                  toast({ title: `Saldo de "${editSaldoCaixa.nome}" atualizado para ${formatBRL(val)}` });
                  setEditSaldoCaixa(null);
                  fetchCaixas();
                }}
                className="w-full bg-[#1976d2] text-white py-3 rounded-lg font-bold text-sm mt-2 active:scale-[0.98] transition-transform"
              >
                Salvar Saldo
              </button>
            </div>
          </div>
        )}
      )}
    </section>
  );
}
