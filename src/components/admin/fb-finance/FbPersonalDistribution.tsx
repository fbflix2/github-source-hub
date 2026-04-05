import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const COLORS = [
  "#a5c8ff", "#40e56c", "#ffb4a8", "#f5c542", "#c084fc", "#22d3ee",
  "#fb7185", "#a3e635", "#e879f9", "#f97316",
];

interface Caixa {
  id: string;
  nome: string;
  tipo: string;
}

interface Props {
  salario: number;
}

export function FbPersonalDistribution({ salario }: Props) {
  const [caixas, setCaixas] = useState<Caixa[]>([]);
  const [percentuais, setPercentuais] = useState<Record<string, number>>({});
  const [configId, setConfigId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { void fetchAll(); }, []);

  const fetchAll = async () => {
    // Fetch personal caixas
    const { data: caixasData } = await supabase
      .from("fb_finance_caixas" as any)
      .select("id, nome, tipo")
      .eq("tipo", "pessoal")
      .order("nome");

    const boxes = ((caixasData || []) as unknown) as Caixa[];
    setCaixas(boxes);

    // Fetch saved percentages (keyed by caixa id)
    const { data: configData } = await supabase
      .from("fb_finance_config" as any)
      .select("id, personal_distribution_percentages")
      .limit(1)
      .maybeSingle();

    if (configData) {
      setConfigId((configData as any).id);
      const saved = (configData as any).personal_distribution_percentages as Record<string, number> | null;

      // Build percentages: use saved values for matching caixa IDs, default equal split
      const clean: Record<string, number> = {};
      const equalShare = boxes.length > 0 ? Math.floor(100 / boxes.length) : 0;

      for (const box of boxes) {
        clean[box.id] = saved && saved[box.id] !== undefined ? Number(saved[box.id]) : equalShare;
      }

      setPercentuais(clean);
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

  const adjust = (id: string, delta: number) => {
    setPercentuais(prev => {
      const next = { ...prev };
      next[id] = Math.max(0, Math.min(100, (next[id] || 0) + delta));
      return next;
    });
  };

  if (!loaded || caixas.length === 0) return null;

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
        <span className={`text-xs font-bold px-3 py-1 rounded-full ${totalPerc === 100 ? "bg-[#40e56c]/20 text-[#40e56c]" : "bg-[#e71a0e]/20 text-[#ffb4a8]"}`}>
          {totalPerc}% alocado
        </span>
      </div>

      {/* Cards - one per personal caixa */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {caixas.map((box, i) => {
          const value = percentuais[box.id] || 0;
          const allocated = salario * (value / 100);
          return (
            <div key={box.id} className="bg-[#0e1c2d] rounded-xl p-4 border border-white/5 relative group">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-[10px] uppercase tracking-widest font-bold text-[#c1c6d4] truncate">
                  {box.nome}
                </span>
              </div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <button onClick={() => adjust(box.id, -1)}
                  className="w-6 h-6 rounded bg-[#283647] text-[#c1c6d4] hover:bg-[#1976d2] hover:text-white flex items-center justify-center text-xs font-bold transition-colors">
                  −
                </button>
                <span className="font-['Manrope'] font-bold text-2xl text-[#d5e4fa] min-w-[3ch] text-center">
                  {value}%
                </span>
                <button onClick={() => adjust(box.id, 1)}
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
      {caixas.length > 0 && (
        <div className="h-3 rounded-full overflow-hidden flex bg-[#283647]">
          {caixas.map((box, i) => (
            <div
              key={box.id}
              className="h-full transition-all"
              style={{ width: `${percentuais[box.id] || 0}%`, backgroundColor: COLORS[i % COLORS.length] }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
