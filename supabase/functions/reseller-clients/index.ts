import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await userClient.auth.getUser(token);
    const callerId = userData?.user?.id;
    if (!callerId) throw new Error("Não autorizado");

    const admin = createClient(url, service);

    // Locate this caller's reseller row
    const { data: reseller } = await admin
      .from("resellers")
      .select("id, status")
      .eq("user_id", callerId)
      .maybeSingle();
    if (!reseller) throw new Error("Somente revendedores");

    const resellerId = reseller.id as string;

    // Collect user_ids linked to this reseller from orders + subscriptions + profiles
    const userIds = new Set<string>();

    const [{ data: ord }, { data: subs }, { data: profs }] = await Promise.all([
      admin.from("orders").select("user_id").eq("reseller_id", resellerId),
      admin.from("subscriptions").select("user_id").eq("reseller_id", resellerId),
      admin.from("profiles").select("user_id").eq("reseller_id", resellerId),
    ]);
    for (const r of ord || []) r.user_id && userIds.add(r.user_id);
    for (const r of subs || []) r.user_id && userIds.add(r.user_id);
    for (const r of profs || []) r.user_id && userIds.add(r.user_id);

    if (userIds.size === 0) {
      return new Response(
        JSON.stringify({ clients: [], stats: { total: 0, withBalance: 0, activeSubs: 0, active30d: 0 } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ids = Array.from(userIds);

    // Fetch profiles for those user_ids (in chunks of 200 to stay safe)
    const profileRows: any[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { data } = await admin
        .from("profiles")
        .select(
          "id, user_id, full_name, phone, balance, status, avatar_url, created_at, first_login_at, cpf, birth_date, rua, numero, bairro, cidade, estado, cep"
        )
        .in("user_id", chunk);
      if (data) profileRows.push(...data);
    }

    // Active subs (any active subscription counts)
    const { data: activeSubs } = await admin
      .from("subscriptions")
      .select("user_id")
      .in("user_id", ids)
      .eq("status", "active");
    const activeSubSet = new Set((activeSubs || []).map((s) => s.user_id));

    // 30d activity
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: recentOrders } = await admin
      .from("orders")
      .select("user_id, total, status, created_at")
      .eq("reseller_id", resellerId)
      .in("status", ["completed", "delivered"])
      .gte("created_at", thirtyDaysAgo.toISOString());
    const active30d = new Set((recentOrders || []).map((o) => o.user_id));

    // Emails via auth admin — only for the caller's client user_ids
    const emailMap: Record<string, string> = {};
    for (const uid of ids) {
      try {
        const { data } = await admin.auth.admin.getUserById(uid);
        if (data?.user?.email) emailMap[uid] = data.user.email;
      } catch (_) {
        // ignore
      }
    }

    const clients = profileRows.map((p) => {
      const isComplete = !!(
        p.full_name && p.cpf && p.birth_date &&
        p.rua && p.numero && p.bairro && p.cidade && p.estado && p.cep && p.phone
      );
      return {
        id: p.id,
        user_id: p.user_id,
        full_name: p.full_name,
        email: emailMap[p.user_id] || "",
        phone: p.phone,
        balance: Number(p.balance ?? 0),
        status: p.status ?? "active",
        avatar_url: p.avatar_url,
        created_at: p.created_at,
        first_login_at: p.first_login_at,
        has_active_subscription: activeSubSet.has(p.user_id),
        profile_complete: isComplete,
      };
    });

    const stats = {
      total: clients.length,
      withBalance: clients.filter((c) => c.balance > 0).length,
      activeSubs: activeSubSet.size,
      active30d: active30d.size,
    };

    return new Response(JSON.stringify({ clients, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});