import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const COLORS = [
  "#a5c8ff", "#40e56c", "#ffb4a8", "#f5c542", "#c084fc", "#22d3ee",
  "#fb7185", "#a3e635", "#e879f9", "#f97316",
];

const defaultLabels: Record<string, string> = {
  dia_a_dia: "Dia a Dia",
  estilo_vida: "Estilo de Vida",
  fundo_emergencia: "Fundo Emergência",
  investimentos: "Investimentos",
  janela_oportunidade: "Janela Oportunidade",
  conta_corrente: "Conta Corrente",
};

const keyToLabel = (key: string): string =>
  defaultLabels[key] || key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

interface Props {
  salario: number;
}

export function FbPersonalDistribution({ salario }: Props) {
  const [percentuais, setPercentuais] = useState<Record<string, number>>({});
  const [configId, setConfigId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPerc, setNewPerc] = useState("0");

  useEffect(() => { void fetchConfig(); }, []);

  const fetchConfig = async () => {
    const { data } = await supabase
      .from("fb_finance_config" as any)
      .select("id, personal_distribution_percentages")
      .limit(1)
      .maybeSingle();
    if (data) {
      setConfigId((data as any).id);
      const saved = (data as any).personal_distribution_percentages as Record<string, unknown> | null;
      const clean: Record<string, number> = {};
      for (const [k, v] of Object.entries(saved || {})) {
        clean[k] = Number(v) || 0;
      }
      setPercentuais(Object.keys(clean).length ? clean : {
        dia_a_dia: 30, estilo_vida: 15, fundo_emergencia: 20,
        investimentos: 20, janela_oportunidade: 15,
      });
    }
    setLoaded(true);
  };

  const saveToDb = useCallback(async (newPerc: Record<string, number>) => {
    if (!configId) return;
    const { error } = await supabase
      .from("fb_finance_config" as any)
      .update({ personal_distribution_percentages: newPerc } as any)
      .eq("id", configId);
    if (error) {
      console.error("Erro ao salvar percentuais pessoais:", error);
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    }
  }, [configId]);

  // Autosave with debounce
  useEffect(() => {
    if (!loaded || !configId) return;
    const t = window.setTimeout(() => { void saveToDb(percentuais); }, 400);
    return () => window.clearTimeout(t);
  }, [percentuais, loaded, configId, saveToDb]);

  const totalPerc = Object.values(percentuais).reduce((s, v) => s + v, 0);
  const entries = Object.entries(percentuais);

  const adjust = (key: string, delta: number) => {
    setPercentuais(prev => {
      const next = { ...prev };
      next[key] = Math.max(0, Math.min(100, (next[key] || 0) + delta));
      return next;
    });
  };

  const handleRemove = (key: string) => {
    setPercentuais(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    const key = newName.trim().toLowerCase().replace(/\s+/g, "_");
    if (percentuais[key] !== undefined) {
      toast({ title: "Já existe um card com esse nome", variant: "destructive" });
      return;
    }
    setPercentuais(prev => ({ ...prev, [key]: Number(newPerc) || 0 }));
    setNewName("");
    setNewPerc("0");
    setShowAdd(false);
  };

  if (!loaded) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-['Manrope'] font-bold text-xl text-[#d5e4fa]">
            Alocação do Pro Labore
          </h3>
          <p className="text-[#8b919e] text-xs mt-1">
            Distribua o valor do Pro Labore entre os caixas pessoais
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${totalPerc === 100 ? "bg-[#40e56c]/20 text-[#40e56c]" : "bg-[#e71a0e]/20 text-[#ffb4a8]"}`}>
            {totalPerc}% alocado
          </span>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-[#1976d2] text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:opacity-90 flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">add</span> Novo
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {entries.map(([key, value], i) => {
          const allocated = salario * (value / 100);
          return (
            <div key={key} className="bg-[#0e1c2d] rounded-xl p-4 border border-white/5 relative group">
              <button
                onClick={() => handleRemove(key)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-[#414752] hover:text-[#e71a0e] transition-all"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-[10px] uppercase tracking-widest font-bold text-[#c1c6d4] truncate">
                  {keyToLabel(key)}
                </span>
              </div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <button onClick={() => adjust(key, -1)}
                  className="w-6 h-6 rounded bg-[#283647] text-[#c1c6d4] hover:bg-[#1976d2] hover:text-white flex items-center justify-center text-xs font-bold transition-colors">
                  −
                </button>
                <span className="font-['Manrope'] font-bold text-2xl text-[#d5e4fa] min-w-[3ch] text-center">
                  {value}%
                </span>
                <button onClick={() => adjust(key, 1)}
                  className="w-6 h-6 rounded bg-[#283647] text-[#c1c6d4] hover:bg-[#1976d2] hover:text-white flex items-center justify-center text-xs font-bold transition-colors">
                  +
                </button>
              </div>
              <p className="text-center text-[11px] text-[#8b919e] font-medium">
                {formatBRL(allocated)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Visual bar */}
      {entries.length > 0 && (
        <div className="h-3 rounded-full overflow-hidden flex bg-[#283647]">
          {entries.map(([key, value], i) => (
            <div
              key={key}
              className="h-full transition-all"
              style={{ width: `${value}%`, backgroundColor: COLORS[i % COLORS.length] }}
            />
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowAdd(false)}>
          <div className="bg-[#0e1c2d] p-6 rounded-xl border border-white/10 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <h4 className="text-sm font-bold text-[#d5e4fa]">Novo Caixa Pessoal</h4>
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-[#8b919e] mb-1 block">Nome</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Reserva Viagem"
                className="w-full bg-[#283647] border-none text-sm text-[#d5e4fa] px-3 py-2.5 rounded-lg outline-none placeholder:text-[#414752]" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-[#8b919e] mb-1 block">Percentual (%)</label>
              <input type="number" value={newPerc} onChange={e => setNewPerc(e.target.value)}
                className="w-full bg-[#283647] border-none text-sm text-[#d5e4fa] px-3 py-2.5 rounded-lg outline-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 bg-[#283647] text-[#c1c6d4] py-2 rounded-lg text-sm font-bold">Cancelar</button>
              <button onClick={handleAdd} className="flex-1 bg-[#1976d2] text-white py-2 rounded-lg text-sm font-bold hover:opacity-90">Adicionar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
