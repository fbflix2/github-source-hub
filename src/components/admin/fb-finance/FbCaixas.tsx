import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Caixa { id: string; nome: string; saldo_atual: number; alvo_percent: number; tipo: string }

export function FbCaixas() {
  const [caixas, setCaixas] = useState<Caixa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("fb_finance_caixas" as any).select("*").order("tipo").order("nome").then(({ data }) => {
      if (data) setCaixas(data as any);
      setLoading(false);
    });
  }, []);

  const pessoal = caixas.filter(c => c.tipo === "pessoal");
  const empresa = caixas.filter(c => c.tipo === "empresa");
  const totalPessoal = pessoal.reduce((s, c) => s + Number(c.saldo_atual), 0);
  const totalEmpresa = empresa.reduce((s, c) => s + Number(c.saldo_atual), 0);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" /></div>;

  const renderGroup = (title: string, items: Caixa[], total: number, color: string) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className={`text-lg font-bold ${color}`}>{title}</h2>
        <span className="text-sm font-semibold text-blue-200">{formatBRL(total)}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((c) => {
          const saldo = Number(c.saldo_atual);
          const isPositive = saldo >= 0;
          return (
            <Card key={c.id} className="bg-[#0c1929] border-blue-900/30 hover:border-blue-700/40 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Wallet className="size-4 text-blue-400/60" />
                    <p className="text-sm font-medium text-blue-100">{c.nome}</p>
                  </div>
                  {c.alvo_percent > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-300">{c.alvo_percent}%</span>
                  )}
                </div>
                <p className={`text-xl font-bold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                  {formatBRL(saldo)}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  {isPositive ? <TrendingUp className="size-3 text-emerald-500/60" /> : <TrendingDown className="size-3 text-red-500/60" />}
                  <span className="text-[10px] text-blue-400/40">Saldo atual</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-white">Caixas / Envelopes</h1>
      {renderGroup("🏠 Pessoal", pessoal, totalPessoal, "text-blue-400")}
      {renderGroup("🏢 Empresa", empresa, totalEmpresa, "text-cyan-400")}
    </div>
  );
}
