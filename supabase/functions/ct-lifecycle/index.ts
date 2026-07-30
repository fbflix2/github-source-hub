import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chargeSavedCard } from "../_shared/stripe-offsession.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const summary = { expired_trials: 0, renewed: 0, suspended: 0, proxies_released: 0, wa_alerts: 0 };

  async function invokeWapi(action: string, payload: Record<string, any> = {}) {
    try {
      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/wapi-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json().catch(() => ({}));
      console.log(`[ct-lifecycle] wapi ${action}:`, data);
      return data;
    } catch (e) {
      console.error(`[ct-lifecycle] wapi ${action} failed:`, e);
      return null;
    }
  }

  async function releaseProxies(ctClientIds: string[]) {
    if (!ctClientIds.length) return 0;
    const { data: subs } = await admin
      .from("subscriptions")
      .select("id")
      .in("included_in_ct_client_id", ctClientIds);
    const subIds = (subs || []).map((s: any) => s.id);
    if (subIds.length) {
      await admin
        .from("subscriptions")
        .update({ user_id: null, included_in_ct_client_id: null, status: "available", auto_renew: false })
        .in("id", subIds);
      await admin
        .from("ct_client_proxies")
        .update({ released_at: new Date().toISOString() })
        .in("ct_client_id", ctClientIds)
        .is("released_at", null);
    }
    return subIds.length;
  }

  try {
    // 1) Expire trials/pending payment past 24h
    const { data: expired } = await admin
      .from("ct_clients")
      .select("id")
      .in("status", ["trial", "pendente_pagamento"])
      .lt("trial_ends_at", now.toISOString());
    if (expired && expired.length > 0) {
      const ids = expired.map((x) => x.id);
      await admin.from("ct_clients")
        .update({ status: "cancelado" })
        .in("id", ids);
      summary.expired_trials = ids.length;
      summary.proxies_released += await releaseProxies(ids);
    }

    // 2) Send WhatsApp reminders BEFORE renewal (D-3, D-1, D0)
    for (const days of [3, 1, 0]) {
      const r = await invokeWapi("send-ct-expiring-alerts", { days_ahead: days });
      if (r?.queued) summary.wa_alerts += r.queued;
    }

    // 3) Renew subscriptions where next_billing <= today
    // Inclui 'suspenso' para auto-reativar quando o cliente recarregar a carteira
    const { data: dueList } = await admin
      .from("ct_clients")
      .select("id, user_id, plan_id, monthly_value, next_billing, status")
      .in("status", ["ativo", "suspenso"])
      .lte("next_billing", today);

    for (const sub of (dueList ?? [])) {
      const price = Number(sub.monthly_value);
      const { data: prof } = await admin
        .from("profiles").select("balance, full_name").eq("user_id", sub.user_id).single();
      const bal = Number(prof?.balance || 0);

      if (bal >= price) {
        const newBal = bal - price;
        await admin.from("profiles").update({ balance: newBal }).eq("user_id", sub.user_id);

        const nextBilling = new Date();
        nextBilling.setDate(nextBilling.getDate() + 30);
        await admin.from("ct_clients").update({
          status: "ativo",
          next_billing: nextBilling.toISOString().slice(0, 10),
          last_payment_at: now.toISOString(),
        }).eq("id", sub.id);

        await admin.from("wallet_transactions").insert({
          user_id: sub.user_id,
          type: "debit",
          title: sub.status === "suspenso" ? "Reativação Scale Pro" : "Renovação Scale Pro",
          amount: price,
          balance_after: newBal,
          reference_id: sub.id,
        });
        summary.renewed++;
      } else {
        // Sem saldo -> tenta cobrança automática no cartão salvo (Stripe)
        const card = await chargeSavedCard(admin, {
          userId: sub.user_id,
          amount: price,
          description: "Renovação Scale Pro",
          kind: "scale_pro_renewal",
          referenceId: sub.id,
        });

        if (card.ok) {
          const nextBilling = new Date();
          nextBilling.setDate(nextBilling.getDate() + 30);
          await admin.from("ct_clients").update({
            status: "ativo",
            next_billing: nextBilling.toISOString().slice(0, 10),
            last_payment_at: now.toISOString(),
          }).eq("id", sub.id);

          await admin.from("wallet_transactions").insert({
            user_id: sub.user_id,
            type: "adjustment",
            title: "Renovação Scale Pro cobrada no cartão",
            amount: 0,
            balance_after: bal,
            reference_id: sub.id,
          });

          summary.renewed++;
          continue;
        }
        console.log(`[ct-lifecycle] cartão indisponível para ${sub.user_id}: ${card.reason} ${card.error || ""}`);

        // Se já está suspenso, não repete a suspensão nem o alerta
        if (sub.status === "suspenso") continue;
        await admin.from("ct_clients").update({ status: "suspenso" }).eq("id", sub.id);
        summary.proxies_released += await releaseProxies([sub.id]);
        await admin.from("notifications").insert({
          title: "Assinatura CT suspensa",
          message: `${prof?.full_name || "Cliente"} ficou sem saldo para renovar (R$ ${price.toFixed(2)}).`,
          type: "subscription",
          global: true,
        });
        // Notifica o cliente via WhatsApp
        await invokeWapi("send-ct-suspended-alert", { ct_client_id: sub.id });
        summary.suspended++;
      }
    }

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ct-lifecycle] error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});