import { createClient } from "npm:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método inválido" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, key);
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: { user }, error } = await caller.auth.getUser();
    if (error || !user) return json({ error: "Não autenticado" }, 401);
    const { data: allowed, error: roleError } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (roleError || !allowed) return json({ error: "Somente administrador" }, 403);
    const body = await req.json();
    if (body.action === "approve" || body.action === "reject") {
      const { data: review } = await admin.from("lauth_sale_reviews").select("id,status,order_id").eq("id", body.review_id).maybeSingle();
      if (!review || review.status !== "pending") return json({ error: "Solicitação indisponível ou já analisada" }, 409);
      const { error: saveError } = await admin.from("lauth_sale_reviews").update({
        status: body.action === "approve" ? "approved" : "rejected",
        approved_by: user.id, approved_at: new Date().toISOString(),
      }).eq("id", review.id).eq("status", "pending");
      if (saveError) throw saveError;
      return json({ ok: true, status: body.action === "approve" ? "approved" : "rejected", movement_executed: false,
        message: "Decisão registrada. Movimentação automática aguardando confirmação da API Lauth." });
    }
    if (body.action !== "request") return json({ error: "Ação inválida" }, 400);
    const facebookId = String(body.facebook_profile_id || "").trim();
    if (!/^[0-9]{8,25}$/.test(facebookId)) return json({ error: "ID numérico do Facebook inválido" }, 400);
    const { data: item } = await admin.from("order_items").select("id,order_id,name,orders:order_id(id,code,status)").eq("id", body.order_item_id).maybeSingle();
    const order = (item as any)?.orders;
    if (!item || !order || order.status !== "completed") return json({ error: "Pedido não está concluído" }, 409);
    const { data: payments, error: paymentError } = await admin.from("payments").select("status").eq("order_id", item.order_id);
    if (paymentError) return json({ error: "Não foi possível validar pagamentos" }, 500);
    if (!(payments || []).some(p => ["completed", "paid", "approved", "succeeded"].includes(String(p.status).toLowerCase()))) {
      return json({ error: "Sem pagamento confirmado no registro financeiro. Revisão não criada." }, 409);
    }
    const { data: previous } = await admin.from("lauth_sale_reviews").select("id,status,alerted_at").eq("order_item_id", item.id).eq("facebook_profile_id", facebookId).maybeSingle();
    if (previous) return json({ ok: true, review: previous, duplicate: true });
    const { data: created, error: insertError } = await admin.from("lauth_sale_reviews").insert({
      order_id: item.order_id, order_item_id: item.id, facebook_profile_id: facebookId
    }).select("id,status").single();
    if (insertError) throw insertError;
    const message = `📦 FBFLIX — PERFIL VENDIDO\\nPedido: ${order.code}\\nProduto: ${item.name}\\nID Facebook: ${facebookId}\\nOrigem: LOJA FBFLIX\\nDestino solicitado: VENDIDOS 2026\\n\\nAguardando sua aprovação no painel administrativo. Nenhum perfil foi movido.`;
    const { data: send, error: sendError } = await admin.functions.invoke("wapi-send", {
      body: { action: "send-text", phone: "5519995081355", message }
    });
    if (!sendError && !send?.error) await admin.from("lauth_sale_reviews").update({ alerted_at: new Date().toISOString() }).eq("id", created.id);
    return json({ ok: true, review: created, alert_sent: !sendError && !send?.error, movement_executed: false });
  } catch (e) { console.error("lauth-sale-review", e); return json({ error: "Falha ao processar solicitação" }, 500); }
});
