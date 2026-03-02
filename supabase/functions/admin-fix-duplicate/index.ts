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

    const { delete_user_id } = await req.json();
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
