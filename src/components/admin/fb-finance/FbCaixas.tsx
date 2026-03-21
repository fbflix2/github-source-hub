import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatCompact = (v: number) => v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}.000` : `R$ ${v.toFixed(0)}`;

interface Caixa { id: string; nome: string; saldo_atual: number; alvo_percent: number; tipo: string }

const caixaIcons: Record<string, { icon: string; color: string; bg: string }> = {
  "Fundo Emergência": { icon: "security", color: "text-[#a5c8ff]", bg: "bg-blue-500/10" },
  "Estilo de Vida": { icon: "flight_takeoff", color: "text-yellow-500", bg: "bg-yellow-500/10" },
  "Investimentos": { icon: "monitoring", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  "Capital de Giro": { icon: "account_balance", color: "text-[#a5c8ff]", bg: "bg-blue-500/10" },
  "Fundos Reserva": { icon: "shield", color: "text-[#40e56c]", bg: "bg-green-500/10" },
  "Dividendos": { icon: "payments", color: "text-yellow-400", bg: "bg-yellow-500/10" },
  "Operacional": { icon: "business_center", color: "text-cyan-400", bg: "bg-cyan-500/10" },
  "Dia a Dia": { icon: "shopping_cart", color: "text-orange-400", bg: "bg-orange-500/10" },
  "Conta Corrente Pessoal": { icon: "account_balance_wallet", color: "text-[#a5c8ff]", bg: "bg-blue-500/10" },
  "Janela Oportunidade": { icon: "trending_up", color: "text-purple-400", bg: "bg-purple-500/10" },
};

const defaultIcon = { icon: "savings", color: "text-[#ffb4a8]", bg: "bg-red-500/10" };

export function FbCaixas() {
  const [caixas, setCaixas] = useState<Caixa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("fb_finance_caixas" as any).select("*").order("tipo").order("nome").then(({ data }) => {
      if (data) setCaixas(data as any);
      setLoading(false);
    });
  }, []);

  const totalPatrimonio = caixas.reduce((s, c) => s + Number(c.saldo_atual), 0);
  const totalAlvo = caixas.reduce((s, c) => s + (Number(c.alvo_percent) > 0 ? Number(c.saldo_atual) / (Number(c.alvo_percent) / 100) : 0), 0);
  const healthPercent = totalAlvo > 0 ? Math.min((totalPatrimonio / totalAlvo) * 100, 100) : 85;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#a5c8ff]" /></div>;

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
            Organize sua vida financeira separando seu capital em caixas estratégicas. Priorize objetivos e visualize seu progresso em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-[#1d2b3c] text-[#d5e4fa] hover:bg-[#283647] border border-[#414752]/20 px-5 py-3 rounded-md text-sm font-semibold flex items-center gap-2 transition-all" style={{ fontFamily: "Inter" }}>
            <span className="material-symbols-outlined text-lg">swap_horiz</span>
            Transferir entre Caixas
          </button>
          <button className="bg-[#1976d2] text-white px-6 py-3 rounded-md text-sm font-bold flex items-center gap-2 shadow-lg shadow-[#1976d2]/20 active:scale-95 transition-all" style={{ fontFamily: "Inter" }}>
            <span className="material-symbols-outlined text-lg">add</span>
            Nova Caixa
          </button>
        </div>
      </div>

      {/* Financial Summary Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {/* Total Vaulted */}
        <div className="md:col-span-2 bg-gradient-to-br from-[#1976d2] to-blue-900 p-8 rounded-xl shadow-2xl relative overflow-hidden">
          <div className="relative z-10">
            <span className="text-xs uppercase tracking-[0.2em] text-blue-100/70 font-bold mb-2 block">Patrimônio Reservado</span>
            <h3 className="text-5xl font-['Manrope'] font-black text-white mb-6 tracking-tighter">{formatBRL(totalPatrimonio)}</h3>
            <div className="flex items-center gap-4">
              <span className="text-blue-200/60 text-xs">{caixas.length} caixas ativas</span>
            </div>
          </div>
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
          <div className="absolute right-8 top-8 opacity-20">
            <span className="material-symbols-outlined text-7xl text-white" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance</span>
          </div>
        </div>

        {/* Health Metric */}
        <div className="bg-[#0e1c2d] p-6 rounded-xl border-l-4 border-[#40e56c] flex flex-col justify-between">
          <div>
            <span className="text-xs text-[#8b919e] uppercase tracking-wider block mb-1" style={{ fontFamily: "Inter" }}>Saúde das Reservas</span>
            <p className="text-2xl font-['Manrope'] font-bold text-[#40e56c]">{healthPercent >= 80 ? "Excelente" : healthPercent >= 50 ? "Bom" : "Atenção"}</p>
          </div>
          <div className="h-1.5 bg-[#283647] rounded-full w-full overflow-hidden my-3">
            <div className="h-full bg-[#40e56c] rounded-full" style={{ width: `${healthPercent}%` }}></div>
          </div>
          <p className="text-xs text-[#c1c6d4]">{healthPercent.toFixed(0)}% do planejado.</p>
        </div>
      </div>

      {/* Envelopes Section Title */}
      <h3 className="font-['Manrope'] font-bold text-xl text-[#d5e4fa] mb-8 flex items-center gap-3">
        <span className="w-8 h-[2px] bg-[#a5c8ff]"></span>
        Suas Caixas Ativas
      </h3>

      {/* Envelope Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {caixas.map((c) => {
          const saldo = Number(c.saldo_atual);
          const iconCfg = caixaIcons[c.nome] || defaultIcon;
          // Estimate a "meta" based on alvo_percent (use saldo * 100/alvo or a fallback)
          const meta = c.alvo_percent > 0 ? saldo / (c.alvo_percent / 100) : saldo * 1.5;
          const progress = meta > 0 ? Math.min((saldo / meta) * 100, 100) : 0;
          const metaAtingida = progress >= 100;

          return (
            <div key={c.id} className="bg-[#0e1c2d] group hover:bg-[#122031] transition-all duration-300 p-6 rounded-xl relative">
              {/* Icon & Menu */}
              <div className="flex justify-between items-start mb-6">
                <div className={`w-12 h-12 rounded-lg ${iconCfg.bg} flex items-center justify-center ${iconCfg.color}`}>
                  <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>{iconCfg.icon}</span>
                </div>
                <button className="text-[#8b919e] hover:text-[#d5e4fa] transition-colors">
                  <span className="material-symbols-outlined">more_vert</span>
                </button>
              </div>

              {/* Name & Description */}
              <h4 className="font-['Manrope'] font-bold text-lg text-[#d5e4fa] mb-1">{c.nome}</h4>
              <p className="text-xs text-[#8b919e] mb-4">
                {c.tipo === "pessoal" ? "Envelope pessoal" : "Envelope empresarial"}
                {c.alvo_percent > 0 && ` • ${c.alvo_percent}% alvo`}
              </p>

              {/* Balance & Progress */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-[#c1c6d4] font-medium">Saldo Atual</span>
                    <span className="text-[#40e56c] font-bold">{formatCompact(saldo)}</span>
                  </div>
                  <div className="h-2 bg-[#283647] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${metaAtingida ? "bg-[#40e56c] shadow-[0_0_10px_rgba(64,229,108,0.4)]" : "bg-[#40e56c]"}`}
                      style={{ width: `${progress}%` }}
                    ></div>
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

              {/* Action Button */}
              <button className="mt-6 w-full py-2 border border-[#414752]/30 rounded text-xs font-bold text-[#c1c6d4] group-hover:bg-[#1976d2] group-hover:text-white group-hover:border-transparent transition-all">
                Ver Detalhes
              </button>
            </div>
          );
        })}
      </div>

    </section>
  );
}
