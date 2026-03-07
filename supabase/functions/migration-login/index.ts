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
    const { email } = await req.json();
    if (!email) throw new Error("Email é obrigatório");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if user exists by email
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1,
      page: 1,
    });

    // Search user by email using a more targeted approach
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
      user_metadata: { ...foundUser.user_metadata, must_change_password: true },
    });

    // Generate a magic link (without sending email) to get the token
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: foundUser.email!,
    });

    if (linkError) throw linkError;

    // Extract the token from the generated link
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
