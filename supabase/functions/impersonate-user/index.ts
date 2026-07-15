import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const token = authHeader.replace("Bearer ", "");
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Allow staff (admin/moderator) OR resellers acting on their own clients
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .in("role", ["admin", "moderator"])
      .maybeSingle();

    const isStaff = !!roleData;

    const { target_user_id, admin_origin } = await req.json();

    if (!isStaff) {
      // Check reseller-owned client
      const { data: reseller } = await adminClient
        .from("resellers")
        .select("id, status")
        .eq("user_id", caller.id)
        .maybeSingle();
      if (!reseller || reseller.status === "suspended" || reseller.status === "inactive") {
        return new Response(JSON.stringify({ error: "Acesso negado" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const resellerId = reseller.id as string;
      const [{ data: o }, { data: s }, { data: p }] = await Promise.all([
        adminClient.from("orders").select("id").eq("reseller_id", resellerId).eq("user_id", target_user_id).limit(1),
        adminClient.from("subscriptions").select("id").eq("reseller_id", resellerId).eq("user_id", target_user_id).limit(1),
        adminClient.from("profiles").select("user_id").eq("reseller_id", resellerId).eq("user_id", target_user_id).maybeSingle(),
      ]);
      const owns = (o && o.length > 0) || (s && s.length > 0) || !!p;
      if (!owns) {
        return new Response(JSON.stringify({ error: "Este cliente não pertence à sua carteira" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!target_user_id) {
      return new Response(JSON.stringify({ error: "target_user_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get target user email
    const { data: { user: targetUser }, error: userError } = await adminClient.auth.admin.getUserById(target_user_id);
    if (userError || !targetUser?.email) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate magic link
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: targetUser.email,
    });

    if (linkError || !linkData) {
      return new Response(JSON.stringify({ error: "Erro ao gerar link: " + (linkError?.message || "desconhecido") }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Redirect back to the current admin origin with an impersonation flag.
    // The frontend client uses this flag to isolate auth in sessionStorage per-tab.
    const allowedOrigins = new Set([
      "https://fbflix.com.br",
      "https://www.fbflix.com.br",
      "https://fbflix1.lovable.app",
      "https://id-preview--26f1d1f2-11d9-44cb-a3de-f54769701ec2.lovable.app",
    ]);

    const defaultOrigin = "https://fbflix.com.br";
    let clientOrigin = defaultOrigin;

    if (admin_origin) {
      try {
        const parsedOrigin = new URL(admin_origin).origin;
        if (allowedOrigins.has(parsedOrigin)) {
          clientOrigin = parsedOrigin;
        }
      } catch (_) {
        // Keep default origin on invalid admin_origin
      }
    }

    const redirectTo = `${clientOrigin}/?impersonated=1`;
    const redirectUrl = `${supabaseUrl}/auth/v1/verify?token=${linkData.properties.hashed_token}&type=magiclink&redirect_to=${encodeURIComponent(redirectTo)}`;

    return new Response(
      JSON.stringify({ url: redirectUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
