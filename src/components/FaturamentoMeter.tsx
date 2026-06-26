interface FaturamentoMeterProps {
  earned: number;
  compact?: boolean;
}

const MILESTONES = [5000, 10000, 50000, 100000];

export function FaturamentoMeter({ earned, compact = false }: FaturamentoMeterProps) {
  const target = MILESTONES.find((m) => earned < m) ?? MILESTONES[MILESTONES.length - 1];
  const idx = MILESTONES.indexOf(target);
  const prev = idx > 0 ? MILESTONES[idx - 1] : 0;
  const isMaxed = earned >= MILESTONES[MILESTONES.length - 1];
  const pct = isMaxed
    ? 100
    : Math.max(0, Math.min(100, ((earned - prev) / (target - prev)) * 100));
  const fmt = (v: number) =>
    v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : `${v}`;

  if (compact) {
    return (
      <div className="hidden lg:flex flex-col w-44">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Faturamento</span>
          <span className="text-[10px] font-bold text-primary">
            R$ {earned.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="h-1.5 w-full bg-card border border-border rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[9px] text-muted-foreground/70 uppercase tracking-wider">R$ {fmt(prev)}</span>
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
            {isMaxed ? "Máx" : `Meta R$ ${fmt(target)}`}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 md:w-56 md:flex-none">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Faturamento</p>
        <p className="text-xs font-bold text-primary">
          R$ {earned.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </p>
      </div>
      <div className="h-2 w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">R$ {fmt(prev)}</span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          {isMaxed ? "Meta máxima atingida" : `Meta: R$ ${fmt(target)}`}
        </span>
      </div>
    </div>
  );
}