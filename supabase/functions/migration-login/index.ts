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
    const body = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Action: list migrated users
    if (body.action === "list-migrated") {
      // Verify caller is admin
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Não autorizado");

      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user: caller } } = await supabaseUser.auth.getUser();
      if (!caller) throw new Error("Não autorizado");

      const { data: isAdmin } = await supabaseAdmin.rpc("is_staff", { _user_id: caller.id });
      if (!isAdmin) throw new Error("Sem permissão");

      // List all users and filter those with must_change_password
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;

      // Get today's start (UTC)
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const todayISO = todayStart.toISOString();

      const migrated = users
        .filter((u) => {
          const migratedAt = u.user_metadata?.migrated_at;
          const hasMigrationFlag = migratedAt != null || u.user_metadata?.must_change_password === true;
          if (!hasMigrationFlag) return false;
          
          // Filter: only those who migrated today or later
          const dateToCheck = migratedAt || u.last_sign_in_at || u.created_at;
          return dateToCheck && new Date(dateToCheck) >= todayStart;
        })
        .map((u) => ({
          id: u.id,
          email: u.email,
          full_name: u.user_metadata?.full_name || null,
          migrated_at: u.user_metadata?.migrated_at || u.last_sign_in_at || u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          password_changed: u.user_metadata?.must_change_password !== true,
        }));

      return new Response(
        JSON.stringify({ users: migrated }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Original migration login flow
    const { email } = body;
    if (!email) throw new Error("Email é obrigatório");

    // Search user by email
    const { data: { users }, error: searchError } = await supabaseAdmin.auth.admin.listUsers();
    if (searchError) throw searchError;

    const foundUser = users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!foundUser) {
      return new Response(
        JSON.stringify({ error: "Email não encontrado em nossa base. Verifique o email e tente novamente." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Set must_change_password flag
    await supabaseAdmin.auth.admin.updateUserById(foundUser.id, {
      user_metadata: { ...foundUser.user_metadata, must_change_password: true, migrated_at: new Date().toISOString() },
    });

    // Generate a magic link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: foundUser.email!,
    });

    if (linkError) throw linkError;

    const url = new URL(linkData.properties.action_link);
    const token = url.searchParams.get("token");
    const type = url.searchParams.get("type");

    return new Response(
      JSON.stringify({
        success: true,
        token,
        type,
        email: foundUser.email,
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
