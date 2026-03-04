import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller } } = await supabaseUser.auth.getUser();
    if (!caller) throw new Error("Não autorizado");

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Sem permissão");

    const body = await req.json();

    // Action: split_order_item - splits a qty>1 order_item into individual items with correct delivery_data
    if (body.action === "split_order_item") {
      const { order_item_id } = body;
      if (!order_item_id) throw new Error("order_item_id é obrigatório");

      // Get the order_item
      const { data: oi, error: oiErr } = await supabaseAdmin
        .from("order_items")
        .select("*")
        .eq("id", order_item_id)
        .single();
      if (oiErr || !oi) throw new Error("Order item não encontrado");
      if (oi.quantity <= 1) throw new Error("Order item já tem qty=1");

      // Get all stock_items linked to this order_item
      const { data: stockItems } = await supabaseAdmin
        .from("stock_items")
        .select("*")
        .eq("order_item_id", order_item_id)
        .order("created_at", { ascending: true });

      if (!stockItems || stockItems.length === 0) throw new Error("Nenhum stock_item vinculado");

      // Update original order_item to qty=1 and set delivery_data from first stock_item
      const firstStock = stockItems[0];
      const firstDelivery = {
        ...(firstStock.data || {}),
        ...(firstStock.identification ? { idPerfil: firstStock.identification } : {}),
        ...(firstStock.identification_link ? { linkPerfil: firstStock.identification_link } : {}),
      };

      await supabaseAdmin.from("order_items").update({
        quantity: 1,
        delivery_data: firstDelivery,
      }).eq("id", order_item_id);

      // Create new order_items for remaining stock_items
      const newItems = [];
      for (let i = 1; i < stockItems.length; i++) {
        const si = stockItems[i];
        const delivery = {
          ...(si.data || {}),
          ...(si.identification ? { idPerfil: si.identification } : {}),
          ...(si.identification_link ? { linkPerfil: si.identification_link } : {}),
        };

        const { data: newOi, error: insertErr } = await supabaseAdmin.from("order_items").insert({
          order_id: oi.order_id,
          product_id: oi.product_id,
          name: oi.name,
          price: oi.price,
          quantity: 1,
          delivery_data: delivery,
        }).select("id").single();

        if (insertErr) throw new Error(`Erro ao criar item ${i}: ${insertErr.message}`);

        // Reassign stock_item to new order_item
        await supabaseAdmin.from("stock_items").update({
          order_item_id: newOi.id,
        }).eq("id", si.id);

        newItems.push({ new_order_item_id: newOi.id, stock_item_id: si.id });
      }

      return new Response(
        JSON.stringify({ success: true, original_item: order_item_id, new_items: newItems }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default action: delete_user
    const { delete_user_id } = body;
    if (!delete_user_id) throw new Error("delete_user_id é obrigatório");

    // 1. Delete profile
    const { error: delProfile } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("user_id", delete_user_id);

    // 2. Delete user_roles
    const { error: delRoles } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", delete_user_id);

    // 3. Delete auth user
    const { error: delUser } = await supabaseAdmin.auth.admin.deleteUser(delete_user_id);

    return new Response(
      JSON.stringify({
        success: true,
        profile_deleted: !delProfile,
        roles_deleted: !delRoles,
        auth_deleted: !delUser,
        errors: [delProfile?.message, delRoles?.message, delUser?.message].filter(Boolean),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
