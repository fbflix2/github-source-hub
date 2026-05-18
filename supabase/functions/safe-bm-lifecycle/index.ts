 import { createClient } from "npm:@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };
 
 function ok(data: unknown) {
   return new Response(JSON.stringify(data), {
     headers: { ...corsHeaders, "Content-Type": "application/json" },
     status: 200,
   });
 }
 
 function getBRTDate(): Date {
   const now = new Date();
   return new Date(now.getTime() - 3 * 60 * 60 * 1000);
 }
 
 function daysDiff(endDate: string): number {
   const brtNow = getBRTDate();
   const todayStr = brtNow.toISOString().slice(0, 10);
   const today = new Date(todayStr + "T00:00:00Z");
   const end = new Date(endDate.slice(0, 10) + "T00:00:00Z");
   return Math.floor((today.getTime() - end.getTime()) / (1000 * 60 * 60 * 24));
 }
 
 function normalizePhone(raw: string): string {
   let digits = raw.replace(/\D/g, "");
   if (raw.trim().startsWith("+")) return digits;
   if (!digits.startsWith("55") && digits.length <= 11) digits = "55" + digits;
   return digits;
 }
 
 Deno.serve(async (req) => {
   if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
 
   try {
     const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
     const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
     const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
 
     let body: any = {};
     try { body = await req.json(); } catch {}
     const dryRun = body?.dry_run === true;
 
      // 1. Fetch Safe BMs that are due for billing (active, suspended or pending that are due)
      const { data: vaults, error: vaultsErr } = await admin
        .from("safe_bm_vaults")
        .select("id, user_id, bm_name, subscription_price, next_billing_at, grace_notifications, auto_renew, status")
        .in("status", ["active", "suspended", "pending"])
        .eq("auto_renew", true)
        .lte("next_billing_at", new Date().toISOString());
 
     if (vaultsErr) throw vaultsErr;
     if (!vaults?.length) return ok({ success: true, message: "Nenhum Safe BM para cobrar", processed: 0 });
 
     const results = [];
     const waQueue = [];
 
     for (const vault of vaults) {
       const userId = vault.user_id;
       const price = Number(vault.subscription_price || 9.99);
       
       // Fetch user profile for balance and contact
       const { data: profile } = await admin.from("profiles").select("full_name, phone, balance").eq("user_id", userId).single();
       if (!profile) continue;
 
       const currentBalance = Number(profile.balance || 0);
 
       if (currentBalance >= price) {
         // SUCCESSFUL BILLING
         if (!dryRun) {
           const newBalance = currentBalance - price;
           
           // 1. Deduct balance
           await admin.from("profiles").update({ balance: newBalance }).eq("user_id", userId);
           
           // 2. Record transaction
           await admin.from("wallet_transactions").insert({
             user_id: userId,
             type: "purchase",
             title: `Renovação Safe BM: ${vault.bm_name}`,
             amount: -price,
             balance_after: newBalance,
             reference_id: vault.id
           });
 
           // 3. Update vault billing dates
           const nextBilling = new Date(vault.next_billing_at);
           nextBilling.setMonth(nextBilling.getMonth() + 1);
           
            await admin.from("safe_bm_vaults").update({
              last_billing_at: new Date().toISOString(),
              next_billing_at: nextBilling.toISOString(),
              billing_status: 'paid',
              status: 'active', // Ensure it becomes active if it was suspended
              grace_notifications: {} // Reset grace notifications
            }).eq("id", vault.id);
         }
 
         results.push({ id: vault.id, status: "paid", amount: price });
       } else {
         // INSUFFICIENT FUNDS - GRACE PERIOD LOGIC
         const diff = daysDiff(vault.next_billing_at);
         const grace = (vault.grace_notifications || {}) as Record<string, any>;
         let stage = "";
 
         if (diff === 0 && !grace["d0"]) stage = "d0";
         else if (diff === 3 && !grace["d3"]) stage = "d3";
         else if (diff >= 5 && !grace["d5_cancelled"]) stage = "d5_cancelled";
 
         if (stage) {
           let msg = "";
           const nome = profile.full_name || "Cliente";
           const phone = profile.phone;
 
           if (stage === "d0") {
             msg = `Olá ${nome} ⚠️\n\n🔴 *Aviso de renovação Safe BM*\n\nA renovação do seu *Safe BM (${vault.bm_name})* venceu hoje, mas você não possui saldo suficiente (R$ ${price.toFixed(2)}).\n\nPor favor, recarregue seu saldo para evitar a suspensão da proteção.\n\nfbflix.com.br/wallet`;
           } else if (stage === "d3") {
             msg = `Olá ${nome} 🚨\n\n*URGENTE: Safe BM expirado*\n\nSeu *Safe BM (${vault.bm_name})* está com a renovação pendente há 3 dias. Se o saldo não for regularizado em 48h, a proteção será desativada.\n\nRecarregue agora: fbflix.com.br/wallet`;
           } else if (stage === "d5_cancelled") {
             if (!dryRun) {
               await admin.from("safe_bm_vaults").update({ status: 'suspended', billing_status: 'overdue' }).eq("id", vault.id);
             }
             msg = `❌ *Safe BM Desativado — ${nome}*\n\nSua proteção *Safe BM (${vault.bm_name})* foi desativada por falta de pagamento.\n\nPara reativar, adicione saldo e entre em contato com o suporte.`;
           }
 
           if (msg && phone && !dryRun) {
             waQueue.push({
               phone: normalizePhone(phone),
               message: msg,
               user_id: userId
             });
           }
 
           if (!dryRun) {
             const updatedGrace = { ...grace, [stage]: new Date().toISOString() };
             await admin.from("safe_bm_vaults").update({ grace_notifications: updatedGrace }).eq("id", vault.id);
           }
           results.push({ id: vault.id, status: "grace", stage });
         } else {
           results.push({ id: vault.id, status: "pending_funds", diff });
         }
       }
     }
 
     // Send WhatsApp notifications
     for (const wa of waQueue) {
       await admin.functions.invoke("wapi-send", {
         body: { action: "send-text", phone: wa.phone, message: wa.message, user_id: wa.user_id }
       });
     }
 
     return ok({ success: true, processed: vaults.length, results });
   } catch (error) {
     console.error("[safe-bm-lifecycle] Error:", error);
     return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
   }
 });