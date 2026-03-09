import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { useFbxBalance, useFbxActions, useFbxSettings, useFbxOrders, useFbxTransactions } from "@/hooks/useFbx";
import { FbxStatsHeader } from "@/components/fbx/FbxStatsHeader";
import { FbxChart } from "@/components/fbx/FbxChart";
import { FbxTrading } from "@/components/fbx/FbxTrading";
import { FbxRecentTrades } from "@/components/fbx/FbxRecentTrades";
import { FbxOrderBook } from "@/components/fbx/FbxOrderBook";
import { FbxRechargeModal } from "@/components/fbx/FbxRechargeModal";
import { FbxTransferModal } from "@/components/fbx/FbxTransferModal";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export default function TokenFBX() {
  const [showRecharge, setShowRecharge] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const queryClient = useQueryClient();

  const { data: balanceData } = useFbxBalance();
  const { data: settingsData } = useFbxSettings();
  const { data: orders = [] } = useFbxOrders();
  const actions = useFbxActions();

  const fbxBalance = balanceData?.fbx_balance || 0;
  const brlBalance = balanceData?.brl_balance || 0;
  const settings = settingsData?.settings || {};

  const sellOrders = orders.filter((o: any) => o.type === "sell" && o.status === "open");
  const buyOrders = orders.filter((o: any) => o.type === "buy" && o.status === "open");

  // Realtime subscriptions for live updates
  useEffect(() => {
    const channel = supabase
      .channel("fbx-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "fbx_orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["fbx-orders"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "fbx_transactions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["fbx-transactions"] });
        queryClient.invalidateQueries({ queryKey: ["fbx-balance"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const handleCreateOrder = async (type: "buy" | "sell", quantity: number, pixKey?: string) => {
    try {
      const res = await actions.createOrder(type, quantity, pixKey);
      toast({ title: "✅ Sucesso!", description: res.message });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleMatch = async (orderId: string) => {
    try {
      const res = await actions.matchOrder(orderId);
      toast({ title: "✅ Ordem aceita!", description: res.message || "Aguardando confirmação de pagamento." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col gap-2 -mt-4" style={{ height: "calc(100vh - 120px)" }}>
      <FbxStatsHeader fbxBalance={fbxBalance} brlBalance={brlBalance} onRecharge={() => setShowRecharge(true)} onTransfer={() => setShowTransfer(true)} />
      <FbxChart />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <FbxTrading onCreateOrder={handleCreateOrder} fbxBalance={fbxBalance} brlBalance={brlBalance} settings={settings} />
        <FbxOrderBook sellOrders={sellOrders} buyOrders={buyOrders} onMatch={handleMatch} />
        <FbxRecentTrades />
      </div>

      <FbxRechargeModal open={showRecharge} onOpenChange={setShowRecharge} brlBalance={brlBalance} feeRate={Number(settings.fbx_recharge_fee || 0.05)} />
      <FbxTransferModal open={showTransfer} onOpenChange={setShowTransfer} fbxBalance={fbxBalance} />
    </div>
  );
}
