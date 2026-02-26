import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface LinkRow {
  email: string;
  client_name: string;
  codigo: string;
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

    const { rows } = await req.json() as { rows: LinkRow[] };
    if (!rows?.length) throw new Error("Lista vazia");

    // Get all unique emails
    const uniqueEmails = [...new Set(rows.map(r => r.email.toLowerCase().trim()).filter(Boolean))];

    // Build email -> user_id map
    const emailToUserId = new Map<string, string>();

    // 1. Check existing users by email (via auth admin)
    const { data: { users: allUsers } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    
    // We may need multiple pages
    let existingUsers = allUsers || [];
    let page = 1;
    while (existingUsers.length === 1000 * page) {
      page++;
      const { data: { users: moreUsers } } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (moreUsers?.length) existingUsers = [...existingUsers, ...moreUsers];
      else break;
    }

    for (const u of existingUsers) {
      if (u.email) {
        emailToUserId.set(u.email.toLowerCase(), u.id);
      }
    }

    // 2. Create accounts for emails not found
    let created = 0;
    const errors: string[] = [];
    const credentials: { email: string; password: string; name: string }[] = [];

    for (const email of uniqueEmails) {
      if (emailToUserId.has(email)) continue;

      // Find the client name from the first row with this email
      const row = rows.find(r => r.email.toLowerCase().trim() === email);
      const clientName = row?.client_name?.replace(/^@/, "") || "";

      const password = crypto.randomUUID().slice(0, 8) + "A1!";
      const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: clientName },
      });

      if (createError) {
        errors.push(`${email}: ${createError.message}`);
        continue;
      }

      if (userData.user) {
        emailToUserId.set(email, userData.user.id);
        credentials.push({ email, password, name: clientName });
        created++;
      }
    }

    // 3. Link subscriptions by matching code
    let linked = 0;
    let notFound = 0;

    for (const row of rows) {
      const email = row.email.toLowerCase().trim();
      const userId = emailToUserId.get(email);
      if (!userId) {
        errors.push(`${row.codigo}: usuário não encontrado para ${email}`);
        notFound++;
        continue;
      }

      // Find subscription by code (stored in `name` column)
      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .select("id, user_id")
        .eq("name", row.codigo)
        .maybeSingle();

      if (sub) {
        if (sub.user_id !== userId) {
          const { error: updateErr } = await supabaseAdmin
            .from("subscriptions")
            .update({ user_id: userId })
            .eq("id", sub.id);

          if (updateErr) {
            errors.push(`${row.codigo}: erro ao vincular - ${updateErr.message}`);
          } else {
            linked++;
          }
        } else {
          // Already correctly linked
          linked++;
        }
      } else {
        notFound++;
        errors.push(`${row.codigo}: assinatura não encontrada no banco local`);
      }
    }

    return new Response(
      JSON.stringify({
        total: rows.length,
        unique_emails: uniqueEmails.length,
        created,
        linked,
        not_found: notFound,
        errors: errors.slice(0, 50),
        credentials,
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
