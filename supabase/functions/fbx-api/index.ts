import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const authHeader = req.headers.get("Authorization");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader || "" } },
  });
  const { data: { user } } = await userClient.auth.getUser();

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const body = req.method === "POST" ? await req.json() : {};

  try {
    // ========== GET SETTINGS ==========
    if (action === "settings") {
      const { data } = await admin.from("site_settings")
        .select("key, value")
        .in("key", ["fbx_recharge_fee", "fbx_p2p_fee", "fbx_purchase_discount"]);
      const settings: Record<string, string> = {};
      (data || []).forEach((s: any) => { settings[s.key] = s.value; });
      return json({ settings });
    }

    // ========== STATS (admin) ==========
    if (action === "stats") {
      if (!user) return json({ error: "Unauthorized" }, 401);
      const { data: isStaff } = await admin.rpc("is_staff", { _user_id: user.id });
      if (!isStaff) return json({ error: "Forbidden" }, 403);

      const { data: supplyData } = await admin.from("profiles").select("fbx_balance");
      const totalSupply = (supplyData || []).reduce((s: number, p: any) => s + Number(p.fbx_balance || 0), 0);

      const { data: feesData } = await admin.from("fbx_transactions")
        .select("fee").eq("type", "fee");
      const totalFees = (feesData || []).reduce((s: number, t: any) => s + Number(t.fee || 0), 0);

      const since24h = new Date(Date.now() - 86400000).toISOString();
      const { data: vol } = await admin.from("fbx_transactions")
        .select("amount").gte("created_at", since24h);
      const volume24h = (vol || []).reduce((s: number, t: any) => s + Math.abs(Number(t.amount || 0)), 0);

      const { data: recharges } = await admin.from("fbx_transactions")
        .select("net_amount").eq("type", "recharge");
      const totalRecharges = (recharges || []).reduce((s: number, t: any) => s + Number(t.net_amount || 0), 0);

      return json({ totalSupply, totalFees, volume24h, totalRecharges });
    }

    if (!user) return json({ error: "Unauthorized" }, 401);

    // ========== BALANCE ==========
    if (action === "balance") {
      const { data } = await admin.from("profiles")
        .select("fbx_balance, balance").eq("user_id", user.id).single();
      return json({ fbx_balance: data?.fbx_balance || 0, brl_balance: data?.balance || 0 });
    }

    // ========== RECHARGE (convert BRL balance to FBX) ==========
    if (action === "recharge") {
      const { amount } = body;
      if (!amount || amount <= 0) return json({ error: "Valor inválido" }, 400);

      const { data: feeRow } = await admin.from("site_settings")
        .select("value").eq("key", "fbx_recharge_fee").single();
      const feeRate = Number(feeRow?.value || "0.05");

      const { data: profile } = await admin.from("profiles")
        .select("balance, fbx_balance").eq("user_id", user.id).single();
      if (!profile || Number(profile.balance) < amount) {
        return json({ error: "Saldo BRL insuficiente" }, 400);
      }

      const fee = Math.round(amount * feeRate * 100) / 100;
      const netFbx = Math.round((amount - fee) * 100) / 100;
      const newBrl = Math.round((Number(profile.balance) - amount) * 100) / 100;
      const newFbx = Math.round((Number(profile.fbx_balance) + netFbx) * 100) / 100;

      await admin.from("profiles").update({ balance: newBrl, fbx_balance: newFbx }).eq("user_id", user.id);

      await admin.from("wallet_transactions").insert({
        user_id: user.id, type: "debit", amount: -amount,
        title: `Recarga FBX (${netFbx} FBX)`, balance_after: newBrl,
      });

      await admin.from("fbx_transactions").insert({
        user_id: user.id, type: "recharge", amount, fee, net_amount: netFbx,
        balance_after: newFbx, description: `Recarga de R$${amount} → ${netFbx} FBX (taxa ${(feeRate * 100).toFixed(0)}%)`,
      });

      return json({ success: true, fbx_received: netFbx, fee, new_fbx_balance: newFbx });
    }

    // ========== TRANSFER ==========
    if (action === "transfer") {
      const { to_email, amount } = body;
      if (!to_email || !amount || amount <= 0) return json({ error: "Dados inválidos" }, 400);

      const { data: recipients } = await admin.auth.admin.listUsers();
      const recipient = recipients?.users?.find((u: any) => u.email === to_email);
      if (!recipient) return json({ error: "Usuário não encontrado" }, 404);
      if (recipient.id === user.id) return json({ error: "Não pode transferir para si mesmo" }, 400);

      const { data: sender } = await admin.from("profiles")
        .select("fbx_balance").eq("user_id", user.id).single();
      if (!sender || Number(sender.fbx_balance) < amount) {
        return json({ error: "Saldo FBX insuficiente" }, 400);
      }

      const { data: recProfile } = await admin.from("profiles")
        .select("fbx_balance").eq("user_id", recipient.id).single();

      const senderNew = Math.round((Number(sender.fbx_balance) - amount) * 100) / 100;
      const recNew = Math.round((Number(recProfile?.fbx_balance || 0) + amount) * 100) / 100;

      await admin.from("profiles").update({ fbx_balance: senderNew }).eq("user_id", user.id);
      await admin.from("profiles").update({ fbx_balance: recNew }).eq("user_id", recipient.id);

      await admin.from("fbx_transactions").insert([
        {
          user_id: user.id, type: "transfer_out", amount: -amount, fee: 0, net_amount: -amount,
          balance_after: senderNew, counterpart_user_id: recipient.id,
          description: `Transferência para ${to_email}`,
        },
        {
          user_id: recipient.id, type: "transfer_in", amount, fee: 0, net_amount: amount,
          balance_after: recNew, counterpart_user_id: user.id,
          description: `Transferência de ${user.email}`,
        },
      ]);

      return json({ success: true, new_balance: senderNew });
    }

    // ========== BUY FBX (instant conversion BRL → FBX) ==========
    if (action === "buy-fbx") {
      const { quantity } = body;
      if (!quantity || quantity <= 0) return json({ error: "Valor inválido" }, 400);

      const { data: feeRow } = await admin.from("site_settings")
        .select("value").eq("key", "fbx_p2p_fee").single();
      const feeRate = Number(feeRow?.value || "0.05");

      const { data: profile } = await admin.from("profiles")
        .select("balance, fbx_balance").eq("user_id", user.id).single();
      if (!profile) return json({ error: "Perfil não encontrado" }, 404);

      const brl = Number(profile.balance);
      if (brl < quantity) return json({ error: "Saldo BRL insuficiente" }, 400);

      const fee = Math.round(quantity * feeRate * 100) / 100;
      const net = Math.round((quantity - fee) * 100) / 100;
      const newBrl = Math.round((brl - quantity) * 100) / 100;
      const newFbx = Math.round((Number(profile.fbx_balance) + net) * 100) / 100;

      await admin.from("profiles").update({ balance: newBrl, fbx_balance: newFbx }).eq("user_id", user.id);

      await admin.from("wallet_transactions").insert({
        user_id: user.id, type: "debit", amount: -quantity,
        title: `Compra ${net} FBX`, balance_after: newBrl,
      });
      await admin.from("fbx_transactions").insert({
        user_id: user.id, type: "purchase", amount: quantity, fee, net_amount: net,
        balance_after: newFbx, description: `Compra R$${quantity} → ${net} FBX (taxa ${(feeRate * 100).toFixed(0)}%)`,
      });

      return json({ success: true, fbx_received: net, fee, new_fbx_balance: newFbx, new_brl_balance: newBrl, message: `Compra de ${net} FBX realizada!` });
    }

    // ========== LEGACY: create-order / exchange (maps to buy-fbx or sell-order) ==========
    if (action === "create-order" || action === "exchange") {
      const { type, quantity, pix_key } = body;
      if (!type || !quantity || quantity <= 0) return json({ error: "Dados inválidos" }, 400);

      if (type === "buy") {
        // Redirect to instant buy
        const { data: feeRow } = await admin.from("site_settings")
          .select("value").eq("key", "fbx_p2p_fee").single();
        const feeRate = Number(feeRow?.value || "0.05");

        const { data: profile } = await admin.from("profiles")
          .select("balance, fbx_balance").eq("user_id", user.id).single();
        if (!profile) return json({ error: "Perfil não encontrado" }, 404);

        const brl = Number(profile.balance);
        if (brl < quantity) return json({ error: "Saldo BRL insuficiente" }, 400);

        const fee = Math.round(quantity * feeRate * 100) / 100;
        const net = Math.round((quantity - fee) * 100) / 100;
        const newBrl = Math.round((brl - quantity) * 100) / 100;
        const newFbx = Math.round((Number(profile.fbx_balance) + net) * 100) / 100;

        await admin.from("profiles").update({ balance: newBrl, fbx_balance: newFbx }).eq("user_id", user.id);

        await admin.from("wallet_transactions").insert({
          user_id: user.id, type: "debit", amount: -quantity,
          title: `Compra ${net} FBX`, balance_after: newBrl,
        });
        await admin.from("fbx_transactions").insert({
          user_id: user.id, type: "purchase", amount: quantity, fee, net_amount: net,
          balance_after: newFbx, description: `Compra R$${quantity} → ${net} FBX (taxa ${(feeRate * 100).toFixed(0)}%)`,
        });

        return json({ success: true, fbx_received: net, fee, message: `Compra de ${net} FBX realizada!` });
      }

      // SELL: Create P2P sell order with escrow
      const { data: profile } = await admin.from("profiles")
        .select("fbx_balance").eq("user_id", user.id).single();
      if (!profile || Number(profile.fbx_balance) < quantity) {
        return json({ error: "Saldo FBX insuficiente" }, 400);
      }

      const { data: feeRow } = await admin.from("site_settings")
        .select("value").eq("key", "fbx_p2p_fee").single();
      const feeRate = Number(feeRow?.value || "0.05");

      // Escrow: deduct FBX from seller immediately
      const newFbx = Math.round((Number(profile.fbx_balance) - quantity) * 100) / 100;
      await admin.from("profiles").update({ fbx_balance: newFbx }).eq("user_id", user.id);

      // Create sell order
      const { data: order, error: orderErr } = await admin.from("fbx_orders").insert({
        user_id: user.id,
        type: "sell",
        quantity,
        fee_rate: feeRate,
        pix_key: pix_key || null,
        status: "open",
      }).select().single();

      if (orderErr) {
        // Refund escrow on error
        await admin.from("profiles").update({ fbx_balance: Number(profile.fbx_balance) }).eq("user_id", user.id);
        throw orderErr;
      }

      return json({ success: true, order_id: order.id, message: `Ordem de venda de ${quantity} FBX criada! FBX em escrow.` });
    }

    // ========== MATCH ORDER (buyer accepts a sell order) ==========
    if (action === "match-order") {
      const { order_id } = body;
      const { data: order } = await admin.from("fbx_orders")
        .select("*").eq("id", order_id).eq("status", "open").single();
      if (!order) return json({ error: "Ordem não encontrada ou não disponível" }, 404);
      if (order.user_id === user.id) return json({ error: "Não pode aceitar sua própria ordem" }, 400);

      // Buyer needs BRL balance to match a sell order
      if (order.type === "sell") {
        const { data: buyerProfile } = await admin.from("profiles")
          .select("balance").eq("user_id", user.id).single();
        if (!buyerProfile || Number(buyerProfile.balance) < Number(order.quantity)) {
          return json({ error: "Saldo BRL insuficiente para comprar" }, 400);
        }
      }

      await admin.from("fbx_orders").update({
        status: "escrow", matched_user_id: user.id, matched_at: new Date().toISOString(),
      }).eq("id", order_id);

      return json({ success: true, pix_key: order.pix_key, quantity: order.quantity, message: "Ordem aceita! Aguardando confirmação de pagamento." });
    }

    // ========== CONFIRM ORDER (seller confirms Pix received → release FBX to buyer) ==========
    if (action === "confirm-order") {
      const { order_id } = body;
      const { data: order } = await admin.from("fbx_orders")
        .select("*").eq("id", order_id).eq("status", "escrow").single();
      if (!order) return json({ error: "Ordem não encontrada em escrow" }, 404);

      // Only the seller (order creator for sell orders) can confirm receipt of payment
      const sellerId = order.user_id;
      const buyerId = order.matched_user_id!;

      if (user.id !== sellerId) {
        const { data: isStaff } = await admin.rpc("is_staff", { _user_id: user.id });
        if (!isStaff) return json({ error: "Apenas o vendedor pode confirmar o recebimento" }, 403);
      }

      const qty = Number(order.quantity);
      const feeRate = Number(order.fee_rate);
      const fee = Math.round(qty * feeRate * 100) / 100;
      const netForBuyer = qty; // Buyer gets full amount, fee is on seller
      const sellerReceivesBrl = qty; // Seller receives BRL via Pix (outside platform)

      // Credit FBX to buyer (full amount, no fee for buyer)
      const { data: buyerProfile } = await admin.from("profiles")
        .select("fbx_balance").eq("user_id", buyerId).single();
      const buyerNewFbx = Math.round((Number(buyerProfile?.fbx_balance || 0) + netForBuyer) * 100) / 100;
      await admin.from("profiles").update({ fbx_balance: buyerNewFbx }).eq("user_id", buyerId);

      // Fee goes to platform: seller had qty escrowed, buyer gets qty, platform keeps fee
      // Actually the fee is deducted from what the seller originally escrowed
      // Seller escrowed `qty` FBX. Buyer gets `qty` FBX. Fee = qty * feeRate.
      // So we need to credit buyer only (qty - fee) and platform keeps fee
      // Let me recalculate:
      const buyerReceivesFbx = Math.round((qty - fee) * 100) / 100;
      const correctedBuyerFbx = Math.round((Number(buyerProfile?.fbx_balance || 0) + buyerReceivesFbx) * 100) / 100;
      // Fix: update with correct amount
      await admin.from("profiles").update({ fbx_balance: correctedBuyerFbx }).eq("user_id", buyerId);

      // Complete order
      await admin.from("fbx_orders").update({
        status: "completed", fee_amount: fee,
      }).eq("id", order_id);

      // Log transactions
      const { data: sellerProfile } = await admin.from("profiles")
        .select("fbx_balance").eq("user_id", sellerId).single();

      await admin.from("fbx_transactions").insert([
        {
          user_id: buyerId, type: "p2p_buy", amount: qty, fee: 0, net_amount: buyerReceivesFbx,
          balance_after: correctedBuyerFbx, counterpart_user_id: sellerId,
          description: `Compra P2P de ${buyerReceivesFbx} FBX`,
          reference_id: order_id,
        },
        {
          user_id: sellerId, type: "p2p_sell", amount: -qty, fee, net_amount: -qty,
          balance_after: Number(sellerProfile?.fbx_balance || 0), counterpart_user_id: buyerId,
          description: `Venda P2P de ${qty} FBX (taxa ${(feeRate * 100).toFixed(0)}%: ${fee} FBX)`,
          reference_id: order_id,
        },
      ]);

      return json({ success: true, fee, buyer_received: buyerReceivesFbx, message: `Ordem confirmada! ${buyerReceivesFbx} FBX liberados.` });
    }

    // ========== CANCEL ORDER ==========
    if (action === "cancel-order") {
      const { order_id } = body;
      const { data: order } = await admin.from("fbx_orders")
        .select("*").eq("id", order_id).single();
      if (!order) return json({ error: "Ordem não encontrada" }, 404);

      if (order.user_id !== user.id) {
        const { data: isStaff } = await admin.rpc("is_staff", { _user_id: user.id });
        if (!isStaff) return json({ error: "Sem permissão" }, 403);
      }

      if (order.status === "completed") return json({ error: "Ordem já concluída" }, 400);

      // Refund escrowed FBX to seller
      if (order.type === "sell" && (order.status === "open" || order.status === "escrow")) {
        const { data: profile } = await admin.from("profiles")
          .select("fbx_balance").eq("user_id", order.user_id).single();
        const refunded = Math.round((Number(profile?.fbx_balance || 0) + Number(order.quantity)) * 100) / 100;
        await admin.from("profiles").update({ fbx_balance: refunded }).eq("user_id", order.user_id);

        await admin.from("fbx_transactions").insert({
          user_id: order.user_id, type: "refund", amount: Number(order.quantity), fee: 0,
          net_amount: Number(order.quantity), balance_after: refunded,
          description: `Reembolso escrow: ordem cancelada`,
          reference_id: order_id,
        });
      }

      await admin.from("fbx_orders").update({ status: "cancelled" }).eq("id", order_id);
      return json({ success: true, message: "Ordem cancelada com sucesso." });
    }

    // ========== UPDATE SETTINGS (admin) ==========
    if (action === "update-settings") {
      const { data: isStaff } = await admin.rpc("is_staff", { _user_id: user.id });
      if (!isStaff) return json({ error: "Forbidden" }, 403);

      const { fbx_recharge_fee, fbx_p2p_fee, fbx_purchase_discount } = body;
      const updates = [];
      if (fbx_recharge_fee !== undefined) updates.push({ key: "fbx_recharge_fee", value: String(fbx_recharge_fee) });
      if (fbx_p2p_fee !== undefined) updates.push({ key: "fbx_p2p_fee", value: String(fbx_p2p_fee) });
      if (fbx_purchase_discount !== undefined) updates.push({ key: "fbx_purchase_discount", value: String(fbx_purchase_discount) });

      for (const u of updates) {
        await admin.from("site_settings").upsert({ key: u.key, value: u.value, updated_at: new Date().toISOString() }, { onConflict: "key" });
      }

      return json({ success: true });
    }

    return json({ error: "Ação não reconhecida" }, 400);
  } catch (err: any) {
    console.error("FBX API Error:", err);
    return json({ error: err.message || "Erro interno" }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
