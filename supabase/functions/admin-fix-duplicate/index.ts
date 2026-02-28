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

    const KEEP_USER = "2d811ea5-ed52-4b62-ad1c-9757653817f3";
    const DELETE_USER = "ccee7e3d-395e-416a-9ca5-ede0dbecfe15";

    // 1. Update the kept profile with missing data from duplicate
    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update({
        birth_date: "1964-02-11",
        cep: "04604006",
      })
      .eq("user_id", KEEP_USER);

    if (updateErr) throw new Error("Erro ao atualizar perfil: " + updateErr.message);

    // 2. Delete duplicate profile
    const { error: delProfile } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("user_id", DELETE_USER);

    // 3. Delete duplicate user_roles
    const { error: delRoles } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", DELETE_USER);

    // 4. Delete duplicate auth user
    const { error: delUser } = await supabaseAdmin.auth.admin.deleteUser(DELETE_USER);

    return new Response(
      JSON.stringify({
        success: true,
        profile_updated: !updateErr,
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
