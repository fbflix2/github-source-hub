import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generatePasswordFromEmail(email: string): string {
  const local = email.split("@")[0] || "user";
  // Capitalize first letter, append fixed suffix
  const base = local.charAt(0).toUpperCase() + local.slice(1, 6);
  return `${base}@Proxy1`;
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
    const {
      data: { user: caller },
    } = await supabaseUser.auth.getUser();
    if (!caller) throw new Error("Não autorizado");

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Sem permissão de administrador");

    // 1. Get all active proxybr subscriptions
    let allSubs: any[] = [];
    let from = 0;
    while (true) {
      const { data } = await supabaseAdmin
        .from("subscriptions")
        .select("id, name, user_id, status, end_date, raw_data")
        .eq("type", "proxybr")
        .in("status", ["active", "pending_renewal"])
        .range(from, from + 999);
      if (!data?.length) break;
      allSubs = [...allSubs, ...data];
      if (data.length < 1000) break;
      from += 1000;
    }

    // 2. Get admin user_id (fallback owner)
    const { data: adminRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1);
    const adminUserId = adminRoles?.[0]?.user_id;

    // 3. Build existing email -> user_id map
    const existingEmailMap = new Map<string, string>();
    let pg = 1;
    while (true) {
      const {
        data: { users },
        error,
      } = await supabaseAdmin.auth.admin.listUsers({ page: pg, perPage: 1000 });
      if (error || !users?.length) break;
      for (const u of users) {
        if (u.email) existingEmailMap.set(u.email.toLowerCase(), u.id);
      }
      if (users.length < 1000) break;
      pg++;
    }

    // 4. Process each subscription
    const credentials: {
      email: string;
      password: string;
      full_name: string;
      subscription_code: string;
      product_name: string;
      status: string;
      already_existed: boolean;
    }[] = [];
    const errors: string[] = [];
    let created = 0;
    let existing = 0;
    let skipped = 0;

    for (const sub of allSubs) {
      const raw = sub.raw_data || {};
      const notes = (raw.notes || "").trim();
      const productName = raw.product?.name || sub.name;

      // Try to extract email from notes
      let email = "";
      if (notes && notes.includes("@")) {
        // Extract email-like pattern from notes
        const emailMatch = notes.match(
          /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
        );
        if (emailMatch) email = emailMatch[0].toLowerCase();
      }

      if (!email) {
        // If subscription is owned by a non-admin user, get their email
        if (sub.user_id && sub.user_id !== adminUserId) {
          // Find email from existingEmailMap
          for (const [e, uid] of existingEmailMap.entries()) {
            if (uid === sub.user_id) {
              email = e;
              break;
            }
          }
        }
      }

      if (!email) {
        skipped++;
        errors.push(
          `${sub.name}: Sem email identificável (notes: "${notes || "vazio"}")`
        );
        continue;
      }

      const password = generatePasswordFromEmail(email);

      // Check if user already exists
      const existingUserId = existingEmailMap.get(email);
      if (existingUserId) {
        // User exists - reset their password to the generated one
        const { error: updateError } =
          await supabaseAdmin.auth.admin.updateUserById(existingUserId, {
            password,
            user_metadata: { must_change_password: true },
          });

        if (updateError) {
          errors.push(`${email}: Erro ao resetar senha: ${updateError.message}`);
          continue;
        }

        // Link subscription if still on admin
        if (sub.user_id === adminUserId) {
          await supabaseAdmin
            .from("subscriptions")
            .update({ user_id: existingUserId })
            .eq("id", sub.id);
        }

        // Get profile name
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("full_name")
          .eq("user_id", existingUserId)
          .maybeSingle();

        credentials.push({
          email,
          password,
          full_name: profile?.full_name || "",
          subscription_code: sub.name,
          product_name: productName,
          status: sub.status,
          already_existed: true,
        });
        existing++;
      } else {
        // Create new user
        const { data: userData, error: createError } =
          await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
              full_name: notes || email.split("@")[0],
              must_change_password: true,
            },
          });

        if (createError) {
          errors.push(`${email}: ${createError.message}`);
          continue;
        }

        if (userData.user) {
          // Wait for profile trigger
          await new Promise((r) => setTimeout(r, 300));

          // Update profile name
          const displayName = notes || email.split("@")[0];
          await supabaseAdmin
            .from("profiles")
            .update({ full_name: displayName })
            .eq("user_id", userData.user.id);

          // Link subscription
          await supabaseAdmin
            .from("subscriptions")
            .update({ user_id: userData.user.id })
            .eq("id", sub.id);

          existingEmailMap.set(email, userData.user.id);

          credentials.push({
            email,
            password,
            full_name: displayName,
            subscription_code: sub.name,
            product_name: productName,
            status: sub.status,
            already_existed: false,
          });
          created++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        total: allSubs.length,
        created,
        existing,
        skipped,
        credentials,
        errors,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
