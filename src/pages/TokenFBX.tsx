import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useFbxBalance, useFbxActions, useFbxSettings } from "@/hooks/useFbx";
import { FbxStatsHeader } from "@/components/fbx/FbxStatsHeader";
import { FbxChart } from "@/components/fbx/FbxChart";
import { FbxTrading } from "@/components/fbx/FbxTrading";
import { FbxRecentTrades } from "@/components/fbx/FbxRecentTrades";
import { FbxRechargeModal } from "@/components/fbx/FbxRechargeModal";
import { FbxTransferModal } from "@/components/fbx/FbxTransferModal";

export default function TokenFBX() {
  const [showRecharge, setShowRecharge] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  const { data: balanceData } = useFbxBalance();
  const { data: settingsData } = useFbxSettings();
  const actions = useFbxActions();

  const fbxBalance = balanceData?.fbx_balance || 0;
  const brlBalance = balanceData?.brl_balance || 0;
  const settings = settingsData?.settings || {};

  const handleCreateOrder = async (type: "buy" | "sell", quantity: number) => {
    try {
      const res = await actions.createOrder(type, quantity);
      toast({ title: "✅ Sucesso!", description: res.message });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col gap-2 -mt-4" style={{ height: "calc(100vh - 120px)" }}>
      <FbxStatsHeader fbxBalance={fbxBalance} brlBalance={brlBalance} onRecharge={() => setShowRecharge(true)} onTransfer={() => setShowTransfer(true)} />
      <FbxChart />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <FbxTrading onCreateOrder={handleCreateOrder} fbxBalance={fbxBalance} brlBalance={brlBalance} settings={settings} />
        <FbxRecentTrades />
      </div>

      <FbxRechargeModal open={showRecharge} onOpenChange={setShowRecharge} brlBalance={brlBalance} feeRate={Number(settings.fbx_recharge_fee || 0.05)} />
      <FbxTransferModal open={showTransfer} onOpenChange={setShowTransfer} fbxBalance={fbxBalance} />
    </div>
  );
}