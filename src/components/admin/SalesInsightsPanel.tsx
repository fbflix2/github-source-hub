import { useState } from "react";
import { Lightbulb, Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SalesData {
  categories: { name: string; revenue: number }[];
  chartData: { name: string; revenue: number; cost: number; profit: number }[];
  totalUnitsSold: number;
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  margin: string;
  breakEvenUnits: number;
  breakEvenReached: boolean;
  fixedCosts: number;
  avgProfitPerUnit: number;
}

interface Insight {
  emoji: string;
  title: string;
  description: string;
}

export default function SalesInsightsPanel({ salesData }: { salesData: SalesData }) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("sales-insights", {
        body: { salesData },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setInsights(data?.insights || []);
      setHasLoaded(true);
    } catch (err: any) {
      console.error("Error fetching insights:", err);
      toast.error("Erro ao gerar insights de vendas.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Lightbulb className="size-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
              Estratégias Inteligentes
              <Sparkles className="size-3 text-primary" />
            </h3>
            <p className="text-[10px] text-muted-foreground">Sugestões baseadas no comportamento das suas vendas</p>
          </div>
        </div>
        <button
          onClick={fetchInsights}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          {hasLoaded ? "Atualizar" : "Gerar Insights"}
        </button>
      </div>

      {!hasLoaded && !loading ? (
        <button
          onClick={fetchInsights}
          className="w-full py-8 flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/10 hover:border-primary/30 hover:bg-primary/5 transition-all group cursor-pointer"
        >
          <div className="p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Sparkles className="size-5 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm text-white font-medium">Clique para gerar estratégias de vendas</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              A IA vai analisar seus dados e sugerir ações práticas
            </p>
          </div>
        </button>
      ) : loading ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="size-6 text-primary animate-spin" />
          <p className="text-xs text-muted-foreground">Analisando padrões de vendas...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {insights.map((insight, i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition-all group"
            >
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0 mt-0.5">{insight.emoji}</span>
                <div>
                  <h4 className="text-xs font-bold text-white mb-1">{insight.title}</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{insight.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
