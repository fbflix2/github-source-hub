import { useState } from "react";
import { useFbxStats, fbxFetch } from "@/hooks/useFbx";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function AdminFBX() {
  const { data: stats, isLoading } = useFbxStats();
  const [feeRecharge, setFeeRecharge] = useState("");
  const [feeP2P, setFeeP2P] = useState("");
  const [discount, setDiscount] = useState("");
  const [saving, setSaving] = useState(false);

  // Load current settings
  const { data: settingsData } = useQuery({
    queryKey: ["fbx-settings-admin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", ["fbx_recharge_fee", "fbx_p2p_fee", "fbx_purchase_discount"]);
      const s: Record<string, string> = {};
      (data || []).forEach((r: any) => { s[r.key] = r.value; });
      return s;
    },
    refetchOnMount: true,
  });

  // Set defaults when settings load
  if (settingsData && !feeRecharge) {
    setFeeRecharge(String(Number(settingsData.fbx_recharge_fee || 0.05) * 100));
    setFeeP2P(String(Number(settingsData.fbx_p2p_fee || 0.06) * 100));
    setDiscount(String(Number(settingsData.fbx_purchase_discount || 0.10) * 100));
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await fbxFetch("update-settings", {
        fbx_recharge_fee: Number(feeRecharge) / 100,
        fbx_p2p_fee: Number(feeP2P) / 100,
        fbx_purchase_discount: Number(discount) / 100,
      });
      toast({ title: "Configurações salvas!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gestão Token FBX</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl p-4 border">
          <p className="text-xs text-muted-foreground uppercase font-bold">Supply Circulante</p>
          <p className="text-2xl font-bold text-primary">{isLoading ? "..." : (stats?.totalSupply || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} FBX</p>
        </div>
        <div className="bg-card rounded-xl p-4 border">
          <p className="text-xs text-muted-foreground uppercase font-bold">Taxas Coletadas</p>
          <p className="text-2xl font-bold text-green-500">{isLoading ? "..." : (stats?.totalFees || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} FBX</p>
        </div>
        <div className="bg-card rounded-xl p-4 border">
          <p className="text-xs text-muted-foreground uppercase font-bold">Volume 24h</p>
          <p className="text-2xl font-bold">{isLoading ? "..." : (stats?.volume24h || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} FBX</p>
        </div>
        <div className="bg-card rounded-xl p-4 border">
          <p className="text-xs text-muted-foreground uppercase font-bold">Total Recargas</p>
          <p className="text-2xl font-bold">{isLoading ? "..." : (stats?.totalRecharges || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} FBX</p>
        </div>
      </div>

      {/* Settings */}
      <div className="bg-card rounded-xl p-6 border max-w-lg">
        <h2 className="text-lg font-bold mb-4">Configuração de Taxas</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">Taxa de Recarga (BRL → FBX)</label>
            <div className="flex items-center gap-2">
              <input
                className="bg-background border rounded-lg px-3 py-2 w-24 text-sm"
                type="number"
                value={feeRecharge}
                onChange={(e) => setFeeRecharge(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Taxa P2P</label>
            <div className="flex items-center gap-2">
              <input
                className="bg-background border rounded-lg px-3 py-2 w-24 text-sm"
                type="number"
                value={feeP2P}
                onChange={(e) => setFeeP2P(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Desconto Compras com FBX</label>
            <div className="flex items-center gap-2">
              <input
                className="bg-background border rounded-lg px-3 py-2 w-24 text-sm"
                type="number"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-bold text-sm hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar Configurações"}
          </button>
        </div>
      </div>
    </div>
  );
}
