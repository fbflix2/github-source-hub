import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface DespesaRow {
  id: string;
  nome: string;
  valor: number;
  dia_vencimento: number;
  pago: boolean;
  mes_ref: string;
  categoria: string;
  source: "planejada" | "custo_pessoal";
}

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const catColors: Record<string, string> = {
  fixo: "#1976d2",
  lazer: "#eab308",
  alimentacao: "#40e56c",
  transporte: "#93c5fd",
  saude: "#e71a0e",
  educacao: "#a5c8ff",
  moradia: "#1976d2",
  financeiro: "#40e56c",
  assinaturas: "#ec4899",
  variavel: "#f59e0b",
  outros: "#94a3b8",
};

export function FbCalendarModal({ open, onClose }: Props) {
  const [despesas, setDespesas] = useState<DespesaRow[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const mesRef = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`;

  useEffect(() => {
    if (!open) return;
    fetchAll();
  }, [open, mesRef]);

  const fetchAll = async () => {
    // Fetch planned expenses for this month
    const { data: planejadas } = await supabase
      .from("fb_finance_despesas_planejadas")
      .select("*")
      .eq("mes_ref", mesRef)
      .order("dia_vencimento");

    // Fetch active personal costs (recurring - shown every month)
    const { data: custos } = await supabase
      .from("fb_finance_custos_pessoais")
      .select("*")
      .eq("ativo", true)
      .order("dia_vencimento");

    const items: DespesaRow[] = [];

    if (planejadas) {
      for (const p of planejadas as any[]) {
        items.push({ ...p, source: "planejada" });
      }
    }

    if (custos) {
      for (const c of custos as any[]) {
        // Check if this custo pessoal already exists as a despesa planejada (by name match)
        const alreadyPlanned = (planejadas || []).some(
          (p: any) => p.nome.toLowerCase().trim() === c.nome.toLowerCase().trim() && p.dia_vencimento === c.dia_vencimento
        );
        if (!alreadyPlanned) {
          items.push({
            id: c.id,
            nome: c.nome,
            valor: c.valor,
            dia_vencimento: c.dia_vencimento,
            pago: false,
            mes_ref: mesRef,
            categoria: c.categoria,
            source: "custo_pessoal",
          });
        }
      }
    }

    items.sort((a, b) => a.dia_vencimento - b.dia_vencimento);
    setDespesas(items);
  };

  if (!open) return null;

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const getDayDespesas = (day: number) => despesas.filter(d => d.dia_vencimento === day);
  const selectedDespesas = selectedDay ? getDayDespesas(selectedDay) : [];

  const totalMes = despesas.reduce((s, d) => s + Number(d.valor), 0);
  const totalPago = despesas.filter(d => d.pago).reduce((s, d) => s + Number(d.valor), 0);
  const totalPendente = totalMes - totalPago;

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 shadow-2xl mx-4"
        style={{ background: "#0a1929" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 px-8 py-6 border-b border-white/10 flex items-center justify-between" style={{ background: "#0a1929" }}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#1976d2]/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#1976d2] text-2xl">calendar_month</span>
            </div>
            <div>
              <h2 className="font-['Manrope'] text-2xl font-bold text-[#d5e4fa]">Calendário Financeiro</h2>
              <p className="text-sm text-slate-500">Compromissos, contas e vencimentos</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined text-slate-400">close</span>
          </button>
        </div>

        <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendar */}
          <div className="lg:col-span-2">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-6">
              <button onClick={prevMonth} className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined text-slate-400">chevron_left</span>
              </button>
              <h3 className="font-['Manrope'] text-xl font-bold text-[#d5e4fa] capitalize">
                {currentMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
              </h3>
              <button onClick={nextMonth} className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined text-slate-400">chevron_right</span>
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
                <div key={d} className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-500 py-2">{d}</div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const dayDesp = getDayDespesas(day);
                const hasEvents = dayDesp.length > 0;
                const allPaid = hasEvents && dayDesp.every(d => d.pago);
                const hasPending = hasEvents && dayDesp.some(d => !d.pago);
                const isToday = isCurrentMonth && today.getDate() === day;
                const isSelected = selectedDay === day;
                const isPast = isCurrentMonth && day < today.getDate();

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                    className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all text-sm font-medium relative
                      ${isSelected ? "ring-2 ring-[#1976d2] bg-[#1976d2]/20" : "hover:bg-white/5"}
                      ${isToday ? "border border-[#1976d2]" : ""}
                      ${isPast && !hasEvents ? "text-slate-600" : "text-[#d5e4fa]"}
                    `}
                    style={{ background: isSelected ? undefined : "#0e1c2d" }}
                  >
                    <span className={isToday ? "font-bold text-[#1976d2]" : ""}>{day}</span>
                    {hasEvents && (
                      <div className="flex gap-0.5">
                        {dayDesp.slice(0, 3).map((d, idx) => (
                          <span
                            key={idx}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: d.pago ? "#40e56c" : hasPending && isPast ? "#e71a0e" : "#eab308" }}
                          />
                        ))}
                        {dayDesp.length > 3 && <span className="text-[8px] text-slate-500">+{dayDesp.length - 3}</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-6 justify-center">
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#40e56c]" /><span className="text-[10px] text-slate-500 uppercase font-bold">Pago</span></div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#eab308]" /><span className="text-[10px] text-slate-500 uppercase font-bold">Pendente</span></div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#e71a0e]" /><span className="text-[10px] text-slate-500 uppercase font-bold">Atrasado</span></div>
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#ec4899]" /><span className="text-[10px] text-slate-500 uppercase font-bold">Custo Pessoal</span></div>
            </div>
          </div>

          {/* Right panel */}
          <div className="space-y-6">
            {/* Month summary */}
            <div className="rounded-2xl p-6 border border-white/5" style={{ background: "#0e1c2d" }}>
              <h4 className="font-['Manrope'] font-bold text-[#d5e4fa] mb-4">Resumo do Mês</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Total Compromissos</span>
                  <span className="font-bold text-[#d5e4fa]">{formatBRL(totalMes)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#40e56c]">✓ Pagos</span>
                  <span className="font-bold text-[#40e56c]">{formatBRL(totalPago)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#eab308]">⏳ Pendentes</span>
                  <span className="font-bold text-[#eab308]">{formatBRL(totalPendente)}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden mt-2" style={{ background: "#283647" }}>
                  <div className="h-full bg-[#40e56c] transition-all" style={{ width: `${totalMes > 0 ? (totalPago / totalMes) * 100 : 0}%` }} />
                </div>
                <p className="text-[10px] text-slate-500 text-center uppercase font-bold">{totalMes > 0 ? ((totalPago / totalMes) * 100).toFixed(0) : 0}% concluído</p>
              </div>
            </div>

            {/* Selected day details */}
            <div className="rounded-2xl p-6 border border-white/5" style={{ background: "#0e1c2d" }}>
              <h4 className="font-['Manrope'] font-bold text-[#d5e4fa] mb-4">
                {selectedDay ? `Dia ${selectedDay}` : "Próximos Vencimentos"}
              </h4>
              {selectedDay && selectedDespesas.length === 0 && (
                <p className="text-sm text-slate-500">Nenhum compromisso neste dia</p>
              )}
              {(selectedDay ? selectedDespesas : despesas.filter(d => !d.pago).slice(0, 5)).map(d => (
                <div key={d.id} className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${catColors[d.categoria] || catColors.outros}20` }}>
                    <span className="material-symbols-outlined text-sm" style={{ color: catColors[d.categoria] || catColors.outros }}>
                      {d.pago ? "check_circle" : "schedule"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#d5e4fa] truncate">{d.nome}</p>
                    <p className="text-[10px] text-slate-500">
                      Dia {d.dia_vencimento} • {d.categoria}
                      {d.source === "custo_pessoal" && <span className="ml-1 text-[#ec4899]">• Pessoal</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-bold ${d.pago ? "text-[#40e56c]" : "text-[#d5e4fa]"}`}>{formatBRL(Number(d.valor))}</span>
                    {d.pago && <span className="block text-[8px] text-[#40e56c] uppercase font-bold">Pago</span>}
                  </div>
                </div>
              ))}
              {!selectedDay && despesas.filter(d => !d.pago).length === 0 && (
                <p className="text-sm text-slate-500">Todos os compromissos estão pagos! 🎉</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
