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
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    console.log("Auth header present:", !!authHeader, "starts with:", authHeader?.substring(0, 20));
    
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Allow service-role key as auth bypass for internal calls
    const isServiceRole = authHeader?.replace("Bearer ", "") === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!isServiceRole) {
      if (!authHeader) throw new Error("Não autorizado");
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
    }

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

    // Action: update_product_tags
    if (body.action === "update_product_tags") {
      const { product_id, tags } = body;
      if (!product_id || !Array.isArray(tags)) throw new Error("product_id e tags são obrigatórios");
      const { error } = await supabaseAdmin.from("products").update({ tags }).eq("id", product_id);
      if (error) throw new Error(error.message);
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: fulfill_webshare - manually allocate Webshare proxy for an order item
    if (body.action === "fulfill_webshare") {
      const { order_item_id, user_id, quantity } = body;
      if (!order_item_id || !user_id) throw new Error("order_item_id e user_id são obrigatórios");
      const itemQty = quantity || 1;

      const WEBSHARE_API_KEY = Deno.env.get("WEBSHARE_API_KEY");
      if (!WEBSHARE_API_KEY) throw new Error("WEBSHARE_API_KEY não configurado");

      const WEBSHARE_BASE = "https://proxy.webshare.io/api/v2";

      // Fetch all Webshare proxies
      const allProxies: any[] = [];
      let wsPage = 1;
      while (true) {
        const resp = await fetch(
          `${WEBSHARE_BASE}/proxy/list/?mode=direct&page=${wsPage}&page_size=250`,
          { headers: { Authorization: `Token ${WEBSHARE_API_KEY}`, Accept: "application/json" } }
        );
        const data = await resp.json();
        if (!resp.ok) throw new Error(`Webshare API error [${resp.status}]`);
        if (data.results?.length) allProxies.push(...data.results);
        if (!data.next) break;
        wsPage++;
      }

      // Get already-assigned proxy IDs
      const { data: existingWsSubs } = await supabaseAdmin
        .from("subscriptions")
        .select("raw_data")
        .eq("type", "webshare")
        .in("status", ["active", "expiring"]);

      const assignedIds = new Set<string>();
      for (const sub of (existingWsSubs || [])) {
        const raw = (sub.raw_data || {}) as Record<string, any>;
        if (raw.webshare_proxy_id) assignedIds.add(raw.webshare_proxy_id);
      }

      const available = allProxies.filter((p: any) => p.valid && !assignedIds.has(p.id));
      if (available.length < itemQty) throw new Error(`Proxies insuficientes: ${available.length} disponíveis, ${itemQty} necessários`);

      const results = [];
      for (let i = 0; i < itemQty; i++) {
        const proxy = available[i];
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 30);

        const subName = `WS-${Date.now().toString(36).toUpperCase()}${i > 0 ? `-${i}` : ''}`;
        const { data: newSub, error: subErr } = await supabaseAdmin.from("subscriptions").insert({
          user_id,
          name: subName,
          type: "webshare",
          status: "active",
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          product_id: body.product_id || null,
          raw_data: {
            webshare_proxy_id: proxy.id,
            proxy_address: proxy.proxy_address,
            port: proxy.port,
            username: proxy.username,
            password: proxy.password,
            country_code: proxy.country_code,
            city_name: proxy.city_name,
            admin_allocated: true,
          },
        }).select("id").single();

        if (subErr) throw new Error(`Erro ao criar assinatura: ${subErr.message}`);
        results.push({ subscription_id: newSub.id, proxy_id: proxy.id, name: subName });
      }

      // Update order_item delivery_data
      await supabaseAdmin.from("order_items").update({
        delivery_data: { type: "webshare_proxy", fulfilled: true, count: itemQty, admin_allocated: true },
      }).eq("id", order_item_id);

      return new Response(JSON.stringify({ success: true, allocated: results }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
