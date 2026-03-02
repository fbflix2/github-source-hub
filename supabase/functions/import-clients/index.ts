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

    console.log("[import-clients] Starting request...");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin or moderator
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller }, error: userError } = await supabaseUser.auth.getUser();
    if (userError) {
      console.error("[import-clients] Auth error:", userError.message);
      throw new Error("Erro de autenticação: " + userError.message);
    }
    if (!caller) throw new Error("Não autorizado");

    console.log("[import-clients] Caller:", caller.id);

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    
    // Also check moderator role
    const { data: isMod } = await supabaseAdmin.rpc("has_role", {
      _user_id: caller.id,
      _role: "moderator",
    });
    
    if (!isAdmin && !isMod) throw new Error("Sem permissão de administrador");

    console.log("[import-clients] Authorized, parsing body...");

    let body;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error("[import-clients] JSON parse error:", parseErr);
      throw new Error("Erro ao ler dados da requisição");
    }
    
    const { clients } = body as { clients: ClientData[] };
    if (!clients || !Array.isArray(clients) || clients.length === 0) {
      console.error("[import-clients] Empty or invalid clients list");
      throw new Error("Lista de clientes vazia");
    }

    console.log(`[import-clients] Processing ${clients.length} clients...`);

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
        if (client.birth_date) {
          // Convert BR date format (dd/mm/yyyy) to ISO (yyyy-mm-dd)
          const bd = client.birth_date.trim();
          const brMatch = bd.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
          if (brMatch) {
            profileFields.birth_date = `${brMatch[3]}-${brMatch[2].padStart(2, "0")}-${brMatch[1].padStart(2, "0")}`;
          } else if (/^\d{4}-\d{2}-\d{2}$/.test(bd)) {
            profileFields.birth_date = bd;
          }
          // skip invalid formats silently
        }
        if (client.full_name) profileFields.full_name = client.full_name;

        // Try to create user first — if exists, we'll get an error
        const password = "mudar@123";
        const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: client.email,
          password,
          email_confirm: true,
          user_metadata: { full_name: client.full_name || "", must_change_password: true },
        });

        if (createError) {
          console.log(`createError for ${client.email}:`, JSON.stringify(createError));
          
          // Check if user already exists - be broad in detection
          const errMsg = (createError.message || "").toLowerCase();
          const isExisting = errMsg.includes("already") ||
            errMsg.includes("registered") ||
            errMsg.includes("exists") ||
            errMsg.includes("duplicate") ||
            (createError as any).status === 422;

          if (isExisting) {
            // Find user by email using GoTrue admin REST API directly
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
            
            let existingUserId: string | null = null;
            let page = 1;
            const perPage = 500;
            
            while (!existingUserId) {
              const res = await fetch(
                `${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
                {
                  headers: {
                    Authorization: `Bearer ${serviceKey}`,
                    apikey: serviceKey,
                  },
                }
              );
              if (!res.ok) {
                console.log(`GoTrue fetch failed page ${page}: ${res.status}`);
                break;
              }
              const result = await res.json();
              const users = result.users || [];
              console.log(`GoTrue page ${page}: ${users.length} users`);
              const found = users.find(
                (u: any) => u.email?.toLowerCase() === client.email.toLowerCase()
              );
              if (found) {
                existingUserId = found.id;
                console.log(`Found user ${client.email} -> ${existingUserId}`);
                break;
              }
              if (users.length < perPage) break;
              page++;
            }

            if (existingUserId) {
              const { data: profile } = await supabaseAdmin
                .from("profiles")
                .select("*")
                .eq("user_id", existingUserId)
                .maybeSingle();

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
                    .eq("user_id", existingUserId);

                  if (updateError) {
                    errors.push(`${client.email}: erro ao atualizar perfil: ${updateError.message}`);
                  }
                }
              }

              // Reset password and return credentials for existing users too
              const newPassword = "mudar@123";
              const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(
                existingUserId,
                {
                  password: newPassword,
                  user_metadata: { must_change_password: true },
                }
              );

              if (!resetError) {
                credentials.push({
                  email: client.email,
                  password: newPassword,
                  full_name: client.full_name || profile?.full_name || "",
                });
              } else {
                errors.push(`${client.email}: atualizado mas erro ao resetar senha: ${resetError.message}`);
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

    console.log(`[import-clients] Done: ${success} success, ${updated} updated, ${failed} failed`);

    return new Response(
      JSON.stringify({ success, updated, failed, errors, credentials }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[import-clients] Top-level error:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
