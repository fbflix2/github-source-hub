import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const respond = (error: string, status: number) => new Response(JSON.stringify({ error }), { status, headers });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return respond("Método não permitido", 405);
  try {
    const token = req.headers.get("Authorization")?.replace(/^Bearer /, "");
    if (!token) return respond("Não autorizado", 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: auth, error: authError } = await authClient.auth.getUser(token);
    if (authError || !auth.user) return respond("Não autorizado", 401);
    const { data: isStaff, error: staffError } = await authClient.rpc("is_staff", { _user_id: auth.user.id });
    if (staffError || isStaff !== true) return respond("Somente administradores podem desbloquear itens", 403);
    const { stock_item_id, order_item_id } = await req.json();
    if (typeof stock_item_id !== "string" || typeof order_item_id !== "string") return respond("Identificadores inválidos", 400);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: item, error: lookupError } = await admin.from("stock_items")
      .select("id, status, order_item_id").eq("id", stock_item_id).eq("order_item_id", order_item_id).maybeSingle();
    if (lookupError) throw lookupError;
    if (!item) return respond("Item não encontrado neste pedido", 404);
    if (item.status !== "bloqueado") return respond("O item não está bloqueado", 409);
    const { data: updated, error: updateError } = await admin.from("stock_items")
      .update({ status: "vendido" }).eq("id", stock_item_id).eq("order_item_id", order_item_id)
      .eq("status", "bloqueado").select("id").maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return respond("Status alterado. Atualize a página", 409);
    console.info("Admin desbloqueou item", { stock_item_id, order_item_id, admin_id: auth.user.id });
    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (e) {
    console.error("Erro ao desbloquear item", e);
    return respond("Não foi possível desbloquear o item", 500);
  }
});
