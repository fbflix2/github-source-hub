import { createClient } from "npm:@supabase/supabase-js@2";

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
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
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
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];
    const credentials: { email: string; password: string; full_name: string }[] = [];

    for (const client of clients) {
      try {
        if (!client.email) {
          failed++;
          errors.push(`Cliente sem email: ${client.full_name || "desconhecido"}`);
          continue;
        }

        // Build profile fields from spreadsheet data
        const profileFields: Record<string, string | undefined> = {};
        if (client.phone) profileFields.phone = client.phone;
        if (client.cpf) profileFields.cpf = client.cpf;
        if (client.cep) profileFields.cep = client.cep;
        if (client.address) profileFields.address = client.address;
        if (client.rua) profileFields.rua = client.rua;
        if (client.numero) profileFields.numero = client.numero;
        if (client.bairro) profileFields.bairro = client.bairro;
        if (client.cidade) profileFields.cidade = client.cidade;
        if (client.estado) profileFields.estado = client.estado;
        if (client.birth_date) profileFields.birth_date = client.birth_date;
        if (client.full_name) profileFields.full_name = client.full_name;

        // Try to create user first — if exists, we'll get an error
        const password = crypto.randomUUID().slice(0, 8) + "A1!";
        const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: client.email,
          password,
          email_confirm: true,
          user_metadata: { full_name: client.full_name || "" },
        });

        if (createError) {
          // Check if user already exists
          const isExisting = createError.message?.includes("already been registered") ||
            createError.message?.includes("already exists") ||
            createError.status === 422;

          if (isExisting) {
            // Find user by email using admin API
            const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
            const existingUser = userList?.users?.find(
              (u) => u.email?.toLowerCase() === client.email.toLowerCase()
            );

            if (existingUser) {
              const { data: profile } = await supabaseAdmin
                .from("profiles")
                .select("*")
                .eq("user_id", existingUser.id)
                .single();

              if (profile) {
                const updateData: Record<string, string> = {};
                for (const [key, value] of Object.entries(profileFields)) {
                  if (value && (!profile[key] || profile[key] === "")) {
                    updateData[key] = value;
                  }
                }

                if (Object.keys(updateData).length > 0) {
                  const { error: updateError } = await supabaseAdmin
                    .from("profiles")
                    .update(updateData)
                    .eq("user_id", existingUser.id);

                  if (updateError) {
                    errors.push(`${client.email}: erro ao atualizar perfil: ${updateError.message}`);
                  }
                }
              }

              updated++;
              success++;
            } else {
              failed++;
              errors.push(`${client.email}: usuário existe mas não foi encontrado`);
            }
            continue;
          }

          failed++;
          errors.push(`${client.email}: ${createError.message}`);
          continue;
        }

        // New user created — update profile with extra fields
        if (Object.keys(profileFields).length > 0 && userData.user) {
          await new Promise((r) => setTimeout(r, 200));
          const { error: updateError } = await supabaseAdmin
            .from("profiles")
            .update(profileFields)
            .eq("user_id", userData.user.id);

          if (updateError) {
            errors.push(`${client.email}: perfil criado mas erro ao atualizar dados extras: ${updateError.message}`);
          }
        }

        credentials.push({
          email: client.email,
          password,
          full_name: client.full_name || "",
        });
        success++;
      } catch (e) {
        failed++;
        errors.push(`${client.email}: ${e instanceof Error ? e.message : "Erro desconhecido"}`);
      }
    }

    return new Response(
      JSON.stringify({ success, updated, failed, errors, credentials }),
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
