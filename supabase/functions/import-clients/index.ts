import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ClientData {
  email: string;
  full_name?: string;
  phone?: string;
  cpf?: string;
  cep?: string;
  address?: string;
  birth_date?: string;
}

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
    if (!isAdmin) throw new Error("Sem permissão de administrador");

    const { clients } = await req.json() as { clients: ClientData[] };
    if (!clients || !Array.isArray(clients) || clients.length === 0) {
      throw new Error("Lista de clientes vazia");
    }

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const client of clients) {
      try {
        if (!client.email) {
          failed++;
          errors.push(`Cliente sem email: ${client.full_name || "desconhecido"}`);
          continue;
        }

        // Create user with email_confirm: true (account is active immediately)
        const password = crypto.randomUUID().slice(0, 12) + "A1!";
        const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: client.email,
          password,
          email_confirm: true,
          user_metadata: { full_name: client.full_name || "" },
        });

        if (createError) {
          failed++;
          errors.push(`${client.email}: ${createError.message}`);
          continue;
        }

        // Update profile with extra fields if any exist
        const profileUpdate: Record<string, string | undefined> = {};
        if (client.phone) profileUpdate.phone = client.phone;
        if (client.cpf) profileUpdate.cpf = client.cpf;
        if (client.cep) profileUpdate.cep = client.cep;
        if (client.address) profileUpdate.address = client.address;
        if (client.birth_date) profileUpdate.birth_date = client.birth_date;

        if (Object.keys(profileUpdate).length > 0 && userData.user) {
          // Small delay for trigger to create profile
          await new Promise((r) => setTimeout(r, 200));

          const { error: updateError } = await supabaseAdmin
            .from("profiles")
            .update(profileUpdate)
            .eq("user_id", userData.user.id);

          if (updateError) {
            // User was created but profile update failed - still count as partial success
            errors.push(`${client.email}: perfil criado mas erro ao atualizar dados extras: ${updateError.message}`);
          }
        }

        success++;
      } catch (e) {
        failed++;
        errors.push(`${client.email}: ${e instanceof Error ? e.message : "Erro desconhecido"}`);
      }
    }

    return new Response(
      JSON.stringify({ success, failed, errors }),
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
