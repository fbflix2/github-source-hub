import { createClient } from "npm:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info" };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return respond({ error: "Método inválido" }, 405);
  try {
    const authorization = req.headers.get("Authorization") || "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const auth = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if (authError || !user) return respond({ error: "Não autenticado" }, 401);
    const { data: isAdmin, error: roleError } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (roleError || !isAdmin) return respond({ error: "Somente administradores podem editar vendas" }, 403);
    const { order_id, items, mark_unpaid } = await req.json();
    if (typeof order_id !== "string" || !Array.isArray(items) || items.length === 0 || items.length > 100) return respond({ error: "Dados inválidos" }, 400);
    const { data: order, error: orderError } = await admin.from("orders").select("id,code,subtotal,total,discount,status,payment_method").eq("id", order_id).single();
    if (orderError || !order || !order.code?.startsWith("VND-")) return respond({ error: "Somente vendas manuais VND podem ser editadas" }, 400);
    if (["cancelled", "refunded"].includes(order.status)) return respond({ error: "Venda cancelada ou estornada não pode ser editada" }, 400);
    const { data: existing, error: itemsError } = await admin.from("order_items").select("id,name,quantity,price,delivery_data").eq("order_id", order_id);
    if (itemsError || !existing || existing.length !== items.length) return respond({ error: "Itens não correspondem à venda" }, 400);
    const ids = new Set(existing.map(i => i.id));
    if (items.some(i => !ids.has(i.id) || typeof i.name !== "string" || !i.name.trim() || i.name.length > 180 || !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 10000 || typeof i.price !== "number" || !Number.isFinite(i.price) || i.price < 0)) return respond({ error: "Nome, quantidade ou preço inválido" }, 400);
    for (const i of items) {
      const files = i.manualFiles || [];
      if (!Array.isArray(files) || files.length > 30 || files.some((f: any) => typeof f.name !== "string" || !f.name.toLowerCase().endsWith(".txt") || typeof f.content !== "string" || f.content.length > 100000)) return respond({ error: "Arquivo TXT inválido" }, 400);
      if (i.manualBmLink) {
        try { const u = new URL(i.manualBmLink); if (!["http:", "https:"].includes(u.protocol)) throw Error(); }
        catch { return respond({ error: "Link de BM inválido" }, 400); }
      }
    }
    if (mark_unpaid) {
      const { data: payments, error: paymentError } = await admin.from("payments").select("id,status").eq("order_id", order_id);
      if (paymentError) return respond({ error: "Não foi possível verificar pagamentos" }, 500);
      if ((payments || []).some(p => ["completed", "paid", "approved", "succeeded", "refunded", "partially_refunded"].includes(String(p.status).toLowerCase()))) {
        return respond({ error: "Há pagamento confirmado ou estornado vinculado a esta venda. Não é possível voltar para não pago automaticamente." }, 409);
      }
      if (order.payment_method === "courtesy") return respond({ error: "Cortesia não pode ser convertida em cobrança automaticamente." }, 409);
    }
    const { data: activePayments, error: activeError } = await admin.from("payments").select("id,status").eq("order_id", order_id);
    if (activeError) return respond({ error: "Não foi possível verificar cobranças vinculadas" }, 500);
    const amountChanged = items.some((item: any) => {
      const previous = existing.find(x => x.id === item.id)!;
      return Number(previous.price) !== item.price || Number(previous.quantity) !== item.quantity;
    });
    if (amountChanged && (activePayments || []).some(p => ["pending", "completed", "paid", "approved", "succeeded"].includes(String(p.status).toLowerCase()))) {
      return respond({ error: "Existe cobrança ou pagamento ativo. Não altere preços antes de cancelar ou conciliar a cobrança." }, 409);
    }
    const total = Math.round(items.reduce((sum: number, i: any) => sum + Math.round(i.price * 100) * i.quantity, 0)) / 100;
    const courtesy = order.payment_method === "courtesy";
    const old = { subtotal: order.subtotal, total: order.total, discount: order.discount, items: existing };
    // Preserve non-manual delivery metadata. Existing manual attachments are replaced only with the submitted list.
    for (const i of items) {
      const previous = existing.find(x => x.id === i.id)!;
      const previousData = previous.delivery_data && typeof previous.delivery_data === "object" ? previous.delivery_data : {};
      const delivery = { ...previousData, _manual_delivery: true, manualFiles: i.manualFiles || [], manualBmLink: i.manualBmLink || "" };
      const { error } = await admin.from("order_items").update({ name: i.name.trim(), quantity: i.quantity, price: i.price, delivery_data: delivery }).eq("id", i.id).eq("order_id", order_id);
      if (error) throw error;
    }
    const { error: updateError } = await admin.from("orders").update({ subtotal: total, total: courtesy ? 0 : total, discount: courtesy ? total : 0, ...(mark_unpaid ? { status: "pending_payment", payment_method: "pix" } : {}) }).eq("id", order_id);
    if (updateError) throw updateError;
    // Financial payment records are deliberately untouched; correction is of the recorded sale, not a refund or additional charge.
    console.log("Manual sale corrected", { order_id, admin_user_id: user.id, before: old, after: { total, items: items.map((i: any) => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity, files: i.manualFiles?.map((f: any) => f.name) })) } });
    return respond({ ok: true, total, marked_unpaid: Boolean(mark_unpaid), payment_records_unchanged: true });
  } catch (e) { console.error("edit-manual-sale", e); return respond({ error: "Não foi possível salvar as alterações" }, 500); }
});
