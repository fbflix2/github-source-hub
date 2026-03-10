import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Target, TrendingUp, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MonthlyGoalModalProps {
  open: boolean;
  onClose: () => void;
  currentRevenue: number;
  onSaved: () => void;
}

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function MonthlyGoalModal({ open, onClose, currentRevenue, onSaved }: MonthlyGoalModalProps) {
  const [revenueGoal, setRevenueGoal] = useState("");
  const [profitGoal, setProfitGoal] = useState("");
  const [salesGoal, setSalesGoal] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "monthly_goals")
        .maybeSingle();
      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          setRevenueGoal(parsed.revenue?.toString() || "");
          setProfitGoal(parsed.profit?.toString() || "");
          setSalesGoal(parsed.sales?.toString() || "");
        } catch { /* ignore */ }
      }
    };
    load();
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    const goals = {
      revenue: Number(revenueGoal) || 0,
      profit: Number(profitGoal) || 0,
      sales: Number(salesGoal) || 0,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("site_settings")
      .select("id")
      .eq("key", "monthly_goals")
      .maybeSingle();

    if (existing) {
      await supabase.from("site_settings").update({ value: JSON.stringify(goals) }).eq("key", "monthly_goals");
    } else {
      await supabase.from("site_settings").insert({ key: "monthly_goals", value: JSON.stringify(goals) });
    }

    toast.success("Meta mensal salva!");
    setSaving(false);
    onSaved();
    onClose();
  };

  const progress = revenueGoal ? Math.min(100, Math.round((currentRevenue / Number(revenueGoal)) * 100)) : 0;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-[#0f0808] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Target className="size-5 text-primary" />
            Metas do Mês
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Preview */}
          {Number(revenueGoal) > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Progresso atual</span>
                <span className="font-bold text-white">{progress}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${progress}%`,
                    background: progress >= 100
                      ? "linear-gradient(90deg, hsl(var(--primary)), #22c55e)"
                      : "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.6))",
                  }}
                />
              </div>
              <p className="text-xs text-gray-500">
                {formatCurrency(currentRevenue)} de {formatCurrency(Number(revenueGoal))}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-gray-300 flex items-center gap-2 text-sm">
              <DollarSign className="size-4" /> Meta de Receita (R$)
            </Label>
            <Input
              type="number"
              value={revenueGoal}
              onChange={e => setRevenueGoal(e.target.value)}
              placeholder="Ex: 50000"
              className="bg-white/5 border-white/10 text-white"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-300 flex items-center gap-2 text-sm">
              <TrendingUp className="size-4" /> Meta de Lucro (R$)
            </Label>
            <Input
              type="number"
              value={profitGoal}
              onChange={e => setProfitGoal(e.target.value)}
              placeholder="Ex: 20000"
              className="bg-white/5 border-white/10 text-white"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-300 flex items-center gap-2 text-sm">
              <Target className="size-4" /> Meta de Vendas (unidades)
            </Label>
            <Input
              type="number"
              value={salesGoal}
              onChange={e => setSalesGoal(e.target.value)}
              placeholder="Ex: 200"
              className="bg-white/5 border-white/10 text-white"
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Salvando..." : "Salvar Metas"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
