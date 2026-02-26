import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generatePasswordFromEmail(email: string): string {
  const local = email.split("@")[0] || "user";
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
    const { data: { user: caller } } = await supabaseUser.auth.getUser();
    if (!caller) throw new Error("Não autorizado");

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Sem permissão de administrador");

    // 1. Get admin user_id
    const { data: adminRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminUserIds = new Set((adminRoles || []).map((r: any) => r.user_id));

    // 2. Build email map from auth users
    const userIdToEmail = new Map<string, string>();
    const emailToUserId = new Map<string, string>();
    let pg = 1;
    while (true) {
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ page: pg, perPage: 1000 });
      if (error || !users?.length) break;
      for (const u of users) {
        if (u.email) {
          userIdToEmail.set(u.id, u.email.toLowerCase());
          emailToUserId.set(u.email.toLowerCase(), u.id);
        }
      }
      if (users.length < 1000) break;
      pg++;
    }

    // 3. Get all profiles (non-admin)
    let allProfiles: any[] = [];
    let from = 0;
    while (true) {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name, phone")
        .range(from, from + 999);
      if (!data?.length) break;
      allProfiles = [...allProfiles, ...data];
      if (data.length < 1000) break;
      from += 1000;
    }
    // Filter out admins
    allProfiles = allProfiles.filter(p => !adminUserIds.has(p.user_id));

    // 4. Get all active subscriptions grouped by user_id
    let allSubs: any[] = [];
    from = 0;
    while (true) {
      const { data } = await supabaseAdmin
        .from("subscriptions")
        .select("id, name, user_id, status, end_date, raw_data, type")
        .eq("type", "proxybr")
        .in("status", ["active", "pending_renewal"])
        .range(from, from + 999);
      if (!data?.length) break;
      allSubs = [...allSubs, ...data];
      if (data.length < 1000) break;
      from += 1000;
    }

    // Group subs by user_id
    const subsByUser = new Map<string, any[]>();
    for (const sub of allSubs) {
      const list = subsByUser.get(sub.user_id) || [];
      list.push(sub);
      subsByUser.set(sub.user_id, list);
    }

    // 5. Sort profiles: those with active subs first (by sub count desc), then the rest
    allProfiles.sort((a, b) => {
      const aCount = subsByUser.get(a.user_id)?.length || 0;
      const bCount = subsByUser.get(b.user_id)?.length || 0;
      return bCount - aCount;
    });

    // 6. Process each profile
    const credentials: any[] = [];
    const errors: string[] = [];
    let resetCount = 0;

    for (const profile of allProfiles) {
      const email = userIdToEmail.get(profile.user_id);
      if (!email) {
        errors.push(`${profile.full_name || profile.user_id}: Sem email no auth`);
        continue;
      }

      const password = generatePasswordFromEmail(email);
      const subs = subsByUser.get(profile.user_id) || [];

      // Reset password and set must_change_password flag
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        profile.user_id,
        { password, user_metadata: { must_change_password: true } }
      );

      if (updateError) {
        errors.push(`${email}: ${updateError.message}`);
        continue;
      }
      resetCount++;

      // Build subscription info string
      const subsInfo = subs.length > 0
        ? subs.map((s: any) => {
            const raw = s.raw_data || {};
            return raw.product?.name || s.name;
          }).join(", ")
        : "Nenhuma";

      credentials.push({
        email,
        password,
        full_name: profile.full_name || "",
        phone: profile.phone || "",
        active_subscriptions: subs.length,
        subscription_products: subsInfo,
        status: subs.length > 0 ? "Cliente ativo" : "Sem assinatura",
      });
    }

    // 7. Also handle unlinked subs (admin-owned) with emails in notes
    const adminId = adminRoles?.[0]?.user_id;
    const unlinkedSubs = allSubs.filter(s => s.user_id === adminId);
    
    for (const sub of unlinkedSubs) {
      const raw = sub.raw_data || {};
      const notes = (raw.notes || "").trim();
      if (!notes) continue;

      const emailMatch = notes.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (!emailMatch) continue;
      
      const email = emailMatch[0].toLowerCase();
      // Skip if already processed
      if (credentials.some(c => c.email === email)) continue;

      const password = generatePasswordFromEmail(email);
      const existingUserId = emailToUserId.get(email);

      if (existingUserId) {
        // User exists, reset password
        await supabaseAdmin.auth.admin.updateUserById(existingUserId, {
          password,
          user_metadata: { must_change_password: true },
        });
        // Link sub
        await supabaseAdmin.from("subscriptions").update({ user_id: existingUserId }).eq("id", sub.id);
      } else {
        // Create new user
        const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: notes || email.split("@")[0], must_change_password: true },
        });
        if (createError) {
          errors.push(`${email}: ${createError.message}`);
          continue;
        }
        if (userData.user) {
          await new Promise(r => setTimeout(r, 300));
          await supabaseAdmin.from("profiles").update({ full_name: notes || email.split("@")[0] }).eq("user_id", userData.user.id);
          await supabaseAdmin.from("subscriptions").update({ user_id: userData.user.id }).eq("id", sub.id);
        }
      }

      credentials.push({
        email,
        password,
        full_name: notes || "",
        phone: "",
        active_subscriptions: 1,
        subscription_products: raw.product?.name || sub.name,
        status: "Novo (criado agora)",
      });
      resetCount++;
    }

    return new Response(
      JSON.stringify({
        total_clients: credentials.length,
        passwords_reset: resetCount,
        credentials,
        errors,
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
