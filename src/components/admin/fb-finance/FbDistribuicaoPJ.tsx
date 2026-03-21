import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle, Play } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Percentuais {
  capital_giro: number;
  fundos_reserva: number;
  dividendos: number;
  operacional: number;
  dia_a_dia: number;
}

interface Distribuicao {
  id: string; data: string; entrada_dia: number; percentuais: Percentuais;
  valores_alocados: Record<string, number>; aplicado: boolean;
}

const defaultPerc: Percentuais = { capital_giro: 2, fundos_reserva: 15, dividendos: 1, operacional: 80, dia_a_dia: 2 };
const percLabels: Record<string, string> = {
  capital_giro: "Capital de Giro",
  fundos_reserva: "Fundos Reserva",
  dividendos: "Dividendos",
  operacional: "Operacional",
  dia_a_dia: "Dia a Dia",
};

export function FbDistribuicaoPJ() {
  const [percentuais, setPercentuais] = useState<Percentuais>(defaultPerc);
  const [entradaHoje, setEntradaHoje] = useState("");
  const [distribuicoes, setDistribuicoes] = useState<Distribuicao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Load config percentuais
    const { data: config } = await supabase.from("fb_finance_config" as any).select("distribution_percentages").limit(1).single();
    if (config && (config as any).distribution_percentages) {
      setPercentuais((config as any).distribution_percentages);
    }
    // Load distribuicoes
    const { data: dist } = await supabase.from("fb_finance_distribuicoes" as any).select("*").order("data", { ascending: false }).limit(30);
    if (dist) setDistribuicoes(dist as any);
    setLoading(false);
  };

  const somaPerc = Object.values(percentuais).reduce((s, v) => s + v, 0);
  const isValid = Math.abs(somaPerc - 100) < 0.01;

  const handleSavePerc = async () => {
    if (!isValid) {
      toast({ title: "A soma dos % deve ser 100%", variant: "destructive" });
      return;
    }
    await supabase.from("fb_finance_config" as any).update({ distribution_percentages: percentuais } as any).neq("id", "00000000-0000-0000-0000-000000000000");
    toast({ title: "Percentuais salvos!" });
  };

  const handleDistribuir = async () => {
    const entrada = parseFloat(entradaHoje);
    if (!entrada || entrada <= 0) {
      toast({ title: "Informe a entrada do dia", variant: "destructive" });
      return;
    }
    if (!isValid) {
      toast({ title: "A soma dos % deve ser 100%", variant: "destructive" });
      return;
    }

    const valores: Record<string, number> = {};
    for (const key of Object.keys(percentuais)) {
      valores[key] = entrada * ((percentuais as any)[key] / 100);
    }

    const hoje = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("fb_finance_distribuicoes" as any).insert({
      data: hoje,
      entrada_dia: entrada,
      percentuais,
      valores_alocados: valores,
      aplicado: true,
    } as any);

    if (error) {
      toast({ title: "Erro ao distribuir", variant: "destructive" });
      return;
    }

    // Update caixa balances
    const caixaMap: Record<string, string> = {
      capital_giro: "Capital de Giro",
      fundos_reserva: "Fundos Reserva/Crise",
      dividendos: "Dividendos",
      operacional: "Operacional",
      dia_a_dia: "Dia a Dia/Emergências",
    };
    const { data: caixas } = await supabase.from("fb_finance_caixas" as any).select("id, nome, saldo_atual");
    if (caixas) {
      for (const [key, nome] of Object.entries(caixaMap)) {
        const caixa = (caixas as any[]).find((c: any) => c.nome === nome);
        if (caixa) {
          const newBalance = Number(caixa.saldo_atual) + valores[key];
          await supabase.from("fb_finance_caixas" as any).update({ saldo_atual: newBalance } as any).eq("id", caixa.id);
        }
      }
    }

    toast({ title: "Distribuição aplicada com sucesso!" });
    setEntradaHoje("");
    fetchData();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" /></div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-white">Distribuição Diária PJ</h1>

      {/* Percentuais Globais */}
      <Card className="bg-[#0c1929] border-blue-900/30">
        <CardHeader><CardTitle className="text-sm text-blue-200">Percentuais de Distribuição</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(percentuais).map(([key, val]) => (
              <div key={key}>
                <Label className="text-blue-300/60 text-xs">{percLabels[key]}</Label>
                <Input
                  type="number" step="0.1" value={val}
                  onChange={e => setPercentuais({ ...percentuais, [key]: parseFloat(e.target.value) || 0 })}
                  className="bg-[#0a1420] border-blue-900/30 text-white text-sm"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-3">
            <div className={`flex items-center gap-1 text-sm font-medium ${isValid ? "text-emerald-400" : "text-red-400"}`}>
              {isValid ? <CheckCircle className="size-4" /> : <AlertTriangle className="size-4" />}
              Soma: {somaPerc.toFixed(1)}%
            </div>
            <Button size="sm" onClick={handleSavePerc} variant="outline" className="border-blue-700 text-blue-300 hover:bg-blue-900/30">Salvar %</Button>
          </div>
        </CardContent>
      </Card>

      {/* Distribuir Hoje */}
      <Card className="bg-[#0c1929] border-blue-900/30">
        <CardHeader><CardTitle className="text-sm text-blue-200">Aplicar Distribuição Hoje</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-end gap-3">
            <div className="flex-1">
              <Label className="text-blue-300/60 text-xs">Entrada do Dia (R$)</Label>
              <Input type="number" step="0.01" value={entradaHoje} onChange={e => setEntradaHoje(e.target.value)} placeholder="Ex: 1500.00" className="bg-[#0a1420] border-blue-900/30 text-white" />
            </div>
            {entradaHoje && parseFloat(entradaHoje) > 0 && (
              <div className="flex flex-wrap gap-2 flex-1">
                {Object.entries(percentuais).map(([key, perc]) => (
                  <div key={key} className="text-xs bg-blue-900/20 px-2 py-1 rounded text-blue-300">
                    {percLabels[key]}: <span className="text-cyan-400 font-semibold">{formatBRL(parseFloat(entradaHoje) * perc / 100)}</span>
                  </div>
                ))}
              </div>
            )}
            <Button onClick={handleDistribuir} className="bg-gradient-to-r from-emerald-600 to-cyan-500 text-white">
              <Play className="size-4 mr-1" /> Distribuir
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card className="bg-[#0c1929] border-blue-900/30">
        <CardHeader><CardTitle className="text-sm text-blue-200">Histórico de Distribuições</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-blue-900/20 hover:bg-transparent">
                <TableHead className="text-blue-300/60">Data</TableHead>
                <TableHead className="text-blue-300/60 text-right">Entrada</TableHead>
                {Object.keys(percLabels).map(k => (
                  <TableHead key={k} className="text-blue-300/60 text-right">{percLabels[k]}</TableHead>
                ))}
                <TableHead className="text-blue-300/60 text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {distribuicoes.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-blue-400/40 py-8">Nenhuma distribuição realizada</TableCell></TableRow>
              ) : distribuicoes.map((d) => (
                <TableRow key={d.id} className="border-blue-900/10 hover:bg-blue-900/10">
                  <TableCell className="text-white text-xs">{new Date(d.data + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-right text-cyan-400 text-xs font-medium">{formatBRL(Number(d.entrada_dia))}</TableCell>
                  {Object.keys(percLabels).map(k => (
                    <TableCell key={k} className="text-right text-blue-200 text-xs">
                      {formatBRL(Number((d.valores_alocados as any)?.[k] || 0))}
                    </TableCell>
                  ))}
                  <TableCell className="text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${d.aplicado ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                      {d.aplicado ? "Aplicado" : "Pendente"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
