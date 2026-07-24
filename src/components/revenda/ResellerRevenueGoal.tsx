import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const GOAL = 1000;

export default function ResellerRevenueGoal({ resellerId }: { resellerId: string }) {
  const [revenue, setRevenue] = useState(0);

  useEffect(() => {
    if (!resellerId) return;
    let cancelled = false;
    (async () => {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("orders")
        .select("total,status,created_at")
        .eq("reseller_id", resellerId)
        .eq("status", "completed")
        .gte("created_at", start.toISOString())
        .limit(1000);
      if (cancelled) return;
      const total = (data || []).reduce((s: number, o: any) => s + Number(o.total || 0), 0);
      setRevenue(total);
    })();
    return () => {
      cancelled = true;
    };
  }, [resellerId]);

  const pct = useMemo(() => Math.min(100, Math.round((revenue / GOAL) * 100)), [revenue]);
  const reached = revenue >= GOAL;

  return (
    <div
      className="hidden md:flex flex-col justify-center gap-1 px-3.5 py-1.5 rounded-full border border-border/60 bg-card/60 backdrop-blur-sm min-w-[180px]"
      title={`Meta mensal: R$ ${GOAL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
    >
      <div className="flex items-center justify-between gap-3 leading-none">
        <div className="flex items-center gap-1.5">
          <Trophy className={cn("size-3", reached ? "text-emerald-400" : "text-primary")} />
          <span className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground">
            Meta 1K
          </span>
        </div>
        <span className={cn("text-[11px] font-bold tabular-nums", reached ? "text-emerald-400" : "text-foreground")}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out",
            reached ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : "bg-gradient-to-r from-primary to-primary/70"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[9px] text-muted-foreground leading-none tabular-nums">
        R$ {revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / R$ {GOAL.toLocaleString("pt-BR")}
      </span>
    </div>
  );
}