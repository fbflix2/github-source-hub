import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useFbxBalance, useFbxOrders, useFbxActions, useFbxSettings } from "@/hooks/useFbx";
import { FbxStatsHeader } from "@/components/fbx/FbxStatsHeader";
import { FbxChart } from "@/components/fbx/FbxChart";
import { FbxOrderBook } from "@/components/fbx/FbxOrderBook";
import { FbxTrading } from "@/components/fbx/FbxTrading";
import { FbxRecentTrades } from "@/components/fbx/FbxRecentTrades";
import { FbxRechargeModal } from "@/components/fbx/FbxRechargeModal";
import { FbxTransferModal } from "@/components/fbx/FbxTransferModal";

export default function TokenFBX() {
  const [showRecharge, setShowRecharge] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  const { data: balanceData } = useFbxBalance();
  const { data: orders = [] } = useFbxOrders();
  const { data: settingsData } = useFbxSettings();
  const actions = useFbxActions();

  const fbxBalance = balanceData?.fbx_balance || 0;
  const brlBalance = balanceData?.brl_balance || 0;
  const settings = settingsData?.settings || {};

  const sellOrders = orders.filter((o: any) => o.type === "sell" && o.status === "open");
  const buyOrders = orders.filter((o: any) => o.type === "buy" && o.status === "open");

  const handleCreateOrder = async (type: "buy" | "sell", quantity: number, pixKey?: string) => {
    try {
      await actions.createOrder(type, quantity, pixKey);
      toast({ title: "Ordem criada!", description: `${type === "buy" ? "Compra" : "Venda"} de ${quantity} FBX` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleMatchOrder = async (orderId: string) => {
    try {
      const res = await actions.matchOrder(orderId);
      toast({ title: "Ordem aceita!", description: res.pix_key ? `Pix: ${res.pix_key}` : "Aguardando confirmação" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col gap-2 -mt-4" style={{ height: "calc(100vh - 120px)" }}>
      <FbxStatsHeader fbxBalance={fbxBalance} brlBalance={brlBalance} onRecharge={() => setShowRecharge(true)} onTransfer={() => setShowTransfer(true)} />
      <FbxChart />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <FbxOrderBook sellOrders={sellOrders} buyOrders={buyOrders} onMatch={handleMatchOrder} />
        <FbxTrading onCreateOrder={handleCreateOrder} fbxBalance={fbxBalance} settings={settings} />
        <FbxRecentTrades />
      </div>

      <FbxRechargeModal open={showRecharge} onOpenChange={setShowRecharge} brlBalance={brlBalance} feeRate={Number(settings.fbx_recharge_fee || 0.05)} />
      <FbxTransferModal open={showTransfer} onOpenChange={setShowTransfer} fbxBalance={fbxBalance} />
    </div>
  );
}
