import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface CustoPessoal {
  id: string;
  nome: string;
  valor: number;
  tipo: string;
  categoria: string;
  dia_vencimento: number;
  ativo: boolean;
  notas: string | null;
}

const defaultCategorias = [
  { value: "moradia", label: "Moradia", icon: "home", color: "text-blue-400", bg: "bg-blue-500/10" },
  { value: "transporte", label: "Transporte", icon: "directions_car", color: "text-cyan-400", bg: "bg-cyan-500/10" },
  { value: "alimentacao", label: "Alimentação", icon: "restaurant", color: "text-orange-400", bg: "bg-orange-500/10" },
  { value: "saude", label: "Saúde", icon: "favorite", color: "text-red-400", bg: "bg-red-500/10" },
  { value: "educacao", label: "Educação", icon: "school", color: "text-yellow-400", bg: "bg-yellow-500/10" },
  { value: "lazer", label: "Lazer", icon: "celebration", color: "text-purple-400", bg: "bg-purple-500/10" },
  { value: "financeiro", label: "Financeiro", icon: "account_balance", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { value: "assinaturas", label: "Assinaturas", icon: "subscriptions", color: "text-pink-400", bg: "bg-pink-500/10" },
  { value: "outros", label: "Outros", icon: "more_horiz", color: "text-[#8b919e]", bg: "bg-[#8b919e]/10" },
];

const CUSTOM_CATS_KEY = "fb_custos_pessoais_custom_cats";

function loadCustomCats(): { value: string; label: string }[] {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_CATS_KEY) || "[]");
  } catch { return []; }
}

function saveCustomCats(cats: { value: string; label: string }[]) {
  localStorage.setItem(CUSTOM_CATS_KEY, JSON.stringify(cats));
}

function buildCategorias(custom: { value: string; label: string }[]) {
  const all = [...defaultCategorias];
  custom.forEach(c => {
    if (!all.find(a => a.value === c.value)) {
      all.splice(all.length - 1, 0, { value: c.value, label: c.label, icon: "label", color: "text-sky-400", bg: "bg-sky-500/10" });
    }
  });
  return all;
}

function getCatFromList(cat: string, list: typeof defaultCategorias) {
  return list.find(c => c.value === cat) || list[list.length - 1];
}

const ModalOverlay = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="bg-[#0e1c2d] rounded-2xl w-full max-w-lg shadow-2xl border border-[#414752]/20">
      {children}
    </div>
  </div>
);

const emptyForm = { nome: "", valor: "", tipo: "fixo", categoria: "moradia", dia_vencimento: "1", notas: "" };

export function FbCustosPessoais() {
  const [custos, setCustos] = useState<CustoPessoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<CustoPessoal | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState<"all" | "fixo" | "variavel">("all");
  const [customCats, setCustomCats] = useState(loadCustomCats);
  const [addingCat, setAddingCat] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState("");
  const [showCatManager, setShowCatManager] = useState(false);

  const categorias = buildCategorias(customCats);
  const getCat = (cat: string) => getCatFromList(cat, categorias);

  const handleAddCategory = () => {
    const label = newCatLabel.trim();
    if (!label) return;
    const value = label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (categorias.find(c => c.value === value)) {
      toast({ title: "Categoria já existe", variant: "destructive" });
      return;
    }
    const updated = [...customCats, { value, label }];
    setCustomCats(updated);
    saveCustomCats(updated);
    setForm({ ...form, categoria: value });
    setNewCatLabel("");
    setAddingCat(false);
    toast({ title: `Categoria "${label}" adicionada!` });
  };

  const handleRemoveCategory = (value: string) => {
    const updated = customCats.filter(c => c.value !== value);
    setCustomCats(updated);
    saveCustomCats(updated);
    toast({ title: "Categoria removida" });
  };

  const fetchCustos = async () => {
    const { data } = await supabase.from("fb_finance_custos_pessoais" as any).select("*").order("dia_vencimento");
    setCustos((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchCustos(); }, []);

  const openNew = () => { setEditItem(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (c: CustoPessoal) => {
    setEditItem(c);
    setForm({ nome: c.nome, valor: String(c.valor), tipo: c.tipo, categoria: c.categoria, dia_vencimento: String(c.dia_vencimento), notas: c.notas || "" });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) { toast({ title: "Informe o nome", variant: "destructive" }); return; }
    const payload = {
      nome: form.nome.trim(),
      valor: parseFloat(form.valor) || 0,
      tipo: form.tipo,
      categoria: form.categoria,
      dia_vencimento: parseInt(form.dia_vencimento) || 1,
      notas: form.notas || null,
    };
    if (editItem) {
      await supabase.from("fb_finance_custos_pessoais" as any).update(payload as any).eq("id", editItem.id);
      toast({ title: "Custo atualizado!" });
    } else {
      await supabase.from("fb_finance_custos_pessoais" as any).insert(payload as any);
      toast({ title: "Custo adicionado!" });
    }
    setShowModal(false);
    fetchCustos();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este custo?")) return;
    await supabase.from("fb_finance_custos_pessoais" as any).delete().eq("id", id);
    toast({ title: "Custo removido" });
    fetchCustos();
  };

  const handleToggle = async (c: CustoPessoal) => {
    await supabase.from("fb_finance_custos_pessoais" as any).update({ ativo: !c.ativo } as any).eq("id", c.id);
    fetchCustos();
  };

  const filtered = custos.filter(c => filter === "all" || c.tipo === filter);
  const ativos = filtered.filter(c => c.ativo);
  const inativos = filtered.filter(c => !c.ativo);
  const totalFixo = custos.filter(c => c.ativo && c.tipo === "fixo").reduce((s, c) => s + c.valor, 0);
  const totalVariavel = custos.filter(c => c.ativo && c.tipo === "variavel").reduce((s, c) => s + c.valor, 0);
  const totalGeral = totalFixo + totalVariavel;

  // Group by category
  const catMap: Record<string, number> = {};
  custos.filter(c => c.ativo).forEach(c => { catMap[c.categoria] = (catMap[c.categoria] || 0) + c.valor; });
  const catEntries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#a5c8ff]" /></div>;

  return (
    <section className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <nav className="flex items-center gap-2 text-xs text-[#8b919e] uppercase tracking-widest mb-4">
            <span>Início</span>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <span className="text-[#a5c8ff]">Custos Pessoais</span>
          </nav>
          <h2 className="font-['Manrope'] font-extrabold text-4xl text-[#d5e4fa] tracking-tight">
            Custos <span className="text-[#e71a0e]">Pessoais</span>
          </h2>
          <p className="text-[#c1c6d4] text-sm mt-2">Gerencie seus custos fixos e variáveis mensais pessoais.</p>
        </div>
        <button onClick={openNew} className="bg-[#1976d2] text-white px-6 py-3 rounded-md text-sm font-bold flex items-center gap-2 shadow-lg shadow-[#1976d2]/20 active:scale-95 transition-all">
          <span className="material-symbols-outlined text-lg">add</span>
          Novo Custo
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#0e1c2d] rounded-xl p-6 border-l-4 border-[#e71a0e]">
          <span className="text-[10px] uppercase tracking-widest text-[#8b919e] font-bold block mb-1">Total Mensal</span>
          <span className="text-3xl font-['Manrope'] font-black text-[#d5e4fa]">{formatBRL(totalGeral)}</span>
          <p className="text-xs text-[#8b919e] mt-2">{custos.filter(c => c.ativo).length} custos ativos</p>
        </div>
        <div className="bg-[#0e1c2d] rounded-xl p-6 border-l-4 border-[#1976d2]">
          <span className="text-[10px] uppercase tracking-widest text-[#8b919e] font-bold block mb-1">Custos Fixos</span>
          <span className="text-2xl font-['Manrope'] font-bold text-[#1976d2]">{formatBRL(totalFixo)}</span>
          <p className="text-xs text-[#8b919e] mt-2">{custos.filter(c => c.ativo && c.tipo === "fixo").length} itens</p>
        </div>
        <div className="bg-[#0e1c2d] rounded-xl p-6 border-l-4 border-[#40e56c]">
          <span className="text-[10px] uppercase tracking-widest text-[#8b919e] font-bold block mb-1">Custos Variáveis</span>
          <span className="text-2xl font-['Manrope'] font-bold text-[#40e56c]">{formatBRL(totalVariavel)}</span>
          <p className="text-xs text-[#8b919e] mt-2">{custos.filter(c => c.ativo && c.tipo === "variavel").length} itens</p>
        </div>
      </div>

      {/* Category Breakdown */}
      {catEntries.length > 0 && (
        <div className="bg-[#0e1c2d] rounded-xl p-6 border border-white/5">
          <h3 className="text-sm font-['Manrope'] font-bold text-[#d5e4fa] mb-4">Distribuição por Categoria</h3>
          <div className="space-y-3">
            {catEntries.map(([cat, val]) => {
              const cfg = getCat(cat);
              const pct = totalGeral > 0 ? (val / totalGeral) * 100 : 0;
              return (
                <div key={cat} className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center`}>
                    <span className={`material-symbols-outlined text-base ${cfg.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{cfg.icon}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#c1c6d4] font-medium capitalize">{cfg.label}</span>
                      <span className="text-[#d5e4fa] font-bold">{formatBRL(val)} <span className="text-[#8b919e] font-normal">({pct.toFixed(0)}%)</span></span>
                    </div>
                    <div className="h-1.5 bg-[#283647] rounded-full overflow-hidden">
                      <div className="h-full bg-[#1976d2] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        {(["all", "fixo", "variavel"] as const).map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filter === t ? "bg-[#1976d2] text-white" : "bg-[#1d2b3c] text-[#8b919e] hover:text-[#d5e4fa]"}`}>
            {t === "all" ? "Todos" : t === "fixo" ? "Fixos" : "Variáveis"}
          </button>
        ))}
      </div>

      {/* Costs List */}
      <div className="bg-[#0e1c2d] rounded-xl border border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5">
          <h3 className="text-sm font-['Manrope'] font-bold text-[#d5e4fa]">Custos Ativos ({ativos.length})</h3>
        </div>
        <div className="divide-y divide-white/5">
          {ativos.map(c => {
            const cfg = getCat(c.categoria);
            return (
              <div key={c.id} className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg ${cfg.bg} flex items-center justify-center`}>
                    <span className={`material-symbols-outlined text-xl ${cfg.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{cfg.icon}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#d5e4fa]">{c.nome}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${c.tipo === "fixo" ? "bg-[#1976d2]/10 text-[#1976d2]" : "bg-[#40e56c]/10 text-[#40e56c]"}`}>
                        {c.tipo}
                      </span>
                      <span className="text-[10px] text-[#8b919e]">Venc. dia {c.dia_vencimento}</span>
                      {c.notas && <span className="text-[10px] text-[#8b919e]">• {c.notas}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-[#e71a0e]">{formatBRL(c.valor)}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-white/5 rounded-lg text-[#8b919e] hover:text-[#d5e4fa] transition-colors">
                      <span className="material-symbols-outlined text-sm">edit</span>
                    </button>
                    <button onClick={() => handleToggle(c)} className="p-1.5 hover:bg-white/5 rounded-lg text-[#8b919e] hover:text-yellow-400 transition-colors">
                      <span className="material-symbols-outlined text-sm">visibility_off</span>
                    </button>
                    <button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-white/5 rounded-lg text-[#8b919e] hover:text-[#e71a0e] transition-colors">
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {ativos.length === 0 && (
            <div className="px-6 py-12 text-center">
              <span className="material-symbols-outlined text-4xl text-[#414752] mb-2 block">payments</span>
              <p className="text-[#8b919e] text-sm">Nenhum custo registrado</p>
            </div>
          )}
        </div>
      </div>

      {/* Inactive */}
      {inativos.length > 0 && (
        <div className="bg-[#0e1c2d] rounded-xl border border-white/5 overflow-hidden opacity-60">
          <div className="p-4 border-b border-white/5">
            <h3 className="text-sm font-['Manrope'] font-bold text-[#8b919e]">Inativos ({inativos.length})</h3>
          </div>
          <div className="divide-y divide-white/5">
            {inativos.map(c => {
              const cfg = getCat(c.categoria);
              return (
                <div key={c.id} className="flex items-center justify-between px-6 py-3 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center opacity-50`}>
                      <span className={`material-symbols-outlined text-base ${cfg.color}`}>{cfg.icon}</span>
                    </div>
                    <span className="text-sm text-[#8b919e] line-through">{c.nome}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#8b919e]">{formatBRL(c.valor)}</span>
                    <button onClick={() => handleToggle(c)} className="p-1.5 hover:bg-white/5 rounded-lg text-[#8b919e] hover:text-[#40e56c] transition-colors">
                      <span className="material-symbols-outlined text-sm">visibility</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <ModalOverlay onClose={() => setShowModal(false)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-['Manrope'] font-bold text-xl text-[#d5e4fa]">{editItem ? "Editar Custo" : "Novo Custo"}</h3>
              <button onClick={() => setShowModal(false)} className="text-[#8b919e] hover:text-white"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-[#8b919e] uppercase tracking-widest block mb-1">Nome</label>
                <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Aluguel"
                  className="w-full bg-[#051424] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#d5e4fa] outline-none focus:ring-2 focus:ring-[#1976d2]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-[#8b919e] uppercase tracking-widest block mb-1">Valor (R$)</label>
                  <input type="number" step="0.01" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} placeholder="0.00"
                    className="w-full bg-[#051424] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#d5e4fa] outline-none focus:ring-2 focus:ring-[#1976d2]" />
                </div>
                <div>
                  <label className="text-[10px] text-[#8b919e] uppercase tracking-widest block mb-1">Dia Vencimento</label>
                  <input type="number" min="1" max="31" value={form.dia_vencimento} onChange={e => setForm({ ...form, dia_vencimento: e.target.value })}
                    className="w-full bg-[#051424] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#d5e4fa] outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-[#8b919e] uppercase tracking-widest block mb-1">Tipo</label>
                  <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                    className="w-full bg-[#051424] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#d5e4fa] outline-none">
                    <option value="fixo">Fixo</option>
                    <option value="variavel">Variável</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-[#8b919e] uppercase tracking-widest block mb-1">Categoria</label>
                  {addingCat ? (
                    <div className="flex gap-2">
                      <input value={newCatLabel} onChange={e => setNewCatLabel(e.target.value)} placeholder="Nome da categoria"
                        autoFocus onKeyDown={e => e.key === "Enter" && handleAddCategory()}
                        className="flex-1 bg-[#051424] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#d5e4fa] outline-none focus:ring-2 focus:ring-[#1976d2]" />
                      <button onClick={handleAddCategory} className="px-3 py-2 bg-[#1976d2] rounded-lg text-white text-xs font-bold">
                        <span className="material-symbols-outlined text-sm">check</span>
                      </button>
                      <button onClick={() => { setAddingCat(false); setNewCatLabel(""); }} className="px-3 py-2 bg-[#1d2b3c] rounded-lg text-[#8b919e] text-xs">
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}
                        className="flex-1 bg-[#051424] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#d5e4fa] outline-none">
                        {categorias.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                      <button onClick={() => setAddingCat(true)} title="Nova categoria"
                        className="px-3 py-2 bg-[#1d2b3c] hover:bg-[#283647] rounded-lg text-[#8b919e] hover:text-[#d5e4fa] transition-colors">
                        <span className="material-symbols-outlined text-sm">add</span>
                      </button>
                      {customCats.length > 0 && (
                        <button onClick={() => setShowCatManager(!showCatManager)} title="Gerenciar categorias"
                          className="px-3 py-2 bg-[#1d2b3c] hover:bg-[#283647] rounded-lg text-[#8b919e] hover:text-[#d5e4fa] transition-colors">
                          <span className="material-symbols-outlined text-sm">settings</span>
                        </button>
                      )}
                    </div>
                  )}
                  {showCatManager && customCats.length > 0 && (
                    <div className="mt-2 bg-[#051424] border border-white/10 rounded-lg p-2 space-y-1">
                      <p className="text-[10px] text-[#8b919e] uppercase tracking-widest mb-1">Categorias personalizadas</p>
                      {customCats.map(c => (
                        <div key={c.value} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-white/5">
                          <span className="text-xs text-[#d5e4fa]">{c.label}</span>
                          <button onClick={() => handleRemoveCategory(c.value)} className="text-[#8b919e] hover:text-[#e71a0e] transition-colors">
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-[#8b919e] uppercase tracking-widest block mb-1">Notas (opcional)</label>
                <input value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Ex: Parcela 12/48"
                  className="w-full bg-[#051424] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#d5e4fa] outline-none" />
              </div>
              <button onClick={handleSave} className="w-full bg-[#1976d2] text-white py-3 rounded-lg font-bold text-sm mt-2 active:scale-[0.98] transition-transform">
                {editItem ? "Salvar Alterações" : "Adicionar Custo"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </section>
  );
}
