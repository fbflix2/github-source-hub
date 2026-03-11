import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getAllAuthUsers(admin: any) {
  const all: any[] = [];
  let page = 1;
  while (true) {
    const { data: { users }, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    all.push(...users);
    if (users.length < 1000) break;
    page++;
  }
  return all;
}

async function getAllProfiles(admin: any) {
  const all: any[] = [];
  let from = 0;
  const size = 1000;
  while (true) {
    const { data, error } = await admin
      .from("profiles")
      .select("user_id, full_name, cpf, phone, birth_date, created_at, status")
      .range(from, from + size - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < size) break;
    from += size;
  }
  return all;
}

async function verifyStaff(req: Request, admin: any) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Não autorizado");
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("Não autorizado");
  const { data: ok } = await admin.rpc("is_staff", { _user_id: user.id });
  if (!ok) throw new Error("Sem permissão");
  return user;
}

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

    // ===== MIGRATION STATS =====
    if (body.action === "migration-stats") {
      await verifyStaff(req, supabaseAdmin);

      const [trackingRes, profiles, allUsers] = await Promise.all([
        supabaseAdmin.from("migration_tracking").select("*").order("created_at", { ascending: false }),
        getAllProfiles(supabaseAdmin),
        getAllAuthUsers(supabaseAdmin),
      ]);
      if (trackingRes.error) throw trackingRes.error;

      const tracking = trackingRes.data || [];

      const emailToUser = new Map<string, any>();
      for (const u of allUsers) {
        if (u.email) emailToUser.set(u.email.toLowerCase(), u);
      }
      const uidToProfile = new Map<string, any>();
      for (const p of profiles) uidToProfile.set(p.user_id, p);

      const trackedEmails = new Set(tracking.map((t: any) => t.email.toLowerCase()));
      const isComplete = (p: any) => !!(p?.full_name && p?.cpf && p?.phone && p?.birth_date);

      // Build a unified user map: email -> enriched data
      const enrichedByEmail = new Map<string, any>();

      // Process all auth users
      for (const u of allUsers) {
        if (!u.email) continue;
        const email = u.email.toLowerCase();
        const pr = uidToProfile.get(u.id);
        const trackingEntry = tracking.find((t: any) => t.email.toLowerCase() === email);
        const neverLoggedIn = !u.last_sign_in_at;
        const hasImportedFlag = u.user_metadata?.must_change_password === true && !u.user_metadata?.migrated_at;

        enrichedByEmail.set(email, {
          id: trackingEntry?.id || u.id,
          email: u.email,
          full_name: pr?.full_name || u.user_metadata?.full_name || trackingEntry?.full_name || null,
          created_at: trackingEntry?.created_at || u.created_at,
          migrated_at: trackingEntry?.migrated_at || u.user_metadata?.migrated_at || null,
          status: trackingEntry?.status || null,
          has_account: true,
          never_logged_in: neverLoggedIn,
          profile_complete: isComplete(pr),
          profile_data: pr
            ? { full_name: pr.full_name, cpf: pr.cpf ? `***${pr.cpf.slice(-4)}` : null, phone: pr.phone, birth_date: pr.birth_date }
            : null,
          last_sign_in: u.last_sign_in_at || null,
          in_tracking: !!trackingEntry,
          migration_method: u.user_metadata?.migrated_at ? "link" : (hasImportedFlag ? "excel" : null),
          contacted: trackingEntry?.contacted || false,
          tracking_id: trackingEntry?.id || null,
        });
      }

      // Also add tracking entries that have NO auth account yet
      for (const t of tracking) {
        const email = t.email.toLowerCase();
        if (!enrichedByEmail.has(email)) {
          enrichedByEmail.set(email, {
            id: t.id,
            email: t.email,
            full_name: t.full_name,
            created_at: t.created_at,
            migrated_at: t.migrated_at,
            status: t.status,
            has_account: false,
            never_logged_in: true,
            profile_complete: false,
            profile_data: null,
            last_sign_in: null,
            in_tracking: true,
            migration_method: null,
            contacted: t.contacted || false,
            tracking_id: t.id,
          });
        }
      }

      const allEnriched = Array.from(enrichedByEmail.values());

      // Categories:
      // Pending = never logged in (no last_sign_in)
      const pendingList = allEnriched.filter((u: any) => u.never_logged_in);
      // Migrated = has logged in AND was in tracking or has migration metadata
      const migratedList = allEnriched.filter((u: any) => !u.never_logged_in && (u.in_tracking || u.migration_method));
      // Direct = has logged in AND was NOT in tracking AND no migration metadata
      const directList = allEnriched.filter((u: any) => !u.never_logged_in && !u.in_tracking && !u.migration_method);
      // Complete profiles (all users)
      const completeCount = allEnriched.filter((u: any) => u.profile_complete).length;

      return new Response(
        JSON.stringify({
          pending_users: pendingList,
          migrated_users: migratedList,
          direct_users: directList,
          all_users: allEnriched,
          stats: {
            total_users: allEnriched.length,
            pending: pendingList.length,
            migrated: migratedList.length,
            direct_registrations: directList.length,
            complete_profiles: completeCount,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== GENERATE CREDENTIALS =====
    if (body.action === "generate-credentials") {
      await verifyStaff(req, supabaseAdmin);
      const email = body.email?.trim().toLowerCase();
      if (!email) throw new Error("Email é obrigatório");

      const password = "mudar@123";
      let action = "created";

      const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { must_change_password: true },
      });

      if (createErr) {
        // User likely exists — find by email using fast DB lookup
        const { data: userId } = await supabaseAdmin.rpc("get_user_id_by_email", { target_email: email });
        if (!userId) throw new Error("Não foi possível criar ou localizar o usuário: " + createErr.message);

        const { data: { user: found } } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (!found) throw new Error("Usuário não encontrado pelo ID");

        await supabaseAdmin.auth.admin.updateUserById(found.id, {
          password,
          user_metadata: { ...found.user_metadata, must_change_password: true },
        });
        action = "password_reset";
      }

      // Mark in migration_tracking
      await supabaseAdmin.from("migration_tracking")
        .update({ status: "migrated", migrated_at: new Date().toISOString() })
        .eq("email", email);

      return new Response(
        JSON.stringify({ success: true, action, email, password }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== LIST MIGRATED (existing) =====
    if (body.action === "list-migrated") {
      await verifyStaff(req, supabaseAdmin);

      const allUsers = await getAllAuthUsers(supabaseAdmin);

      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);

      const migrated = allUsers
        .filter((u: any) => {
          const migratedAt = u.user_metadata?.migrated_at;
          const hasMigrationFlag = migratedAt != null || u.user_metadata?.must_change_password === true;
          if (!hasMigrationFlag) return false;
          const dateToCheck = migratedAt || u.last_sign_in_at || u.created_at;
          return dateToCheck && new Date(dateToCheck) >= todayStart;
        })
        .map((u: any) => ({
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

    // ===== ORIGINAL MIGRATION LOGIN FLOW =====
    const { email } = body;
    if (!email) throw new Error("Email é obrigatório");

    const allUsers = await getAllAuthUsers(supabaseAdmin);
    const foundUser = allUsers.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

    if (!foundUser) {
      return new Response(
        JSON.stringify({ error: "Email não encontrado em nossa base. Verifique o email e tente novamente." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabaseAdmin.auth.admin.updateUserById(foundUser.id, {
      user_metadata: { ...foundUser.user_metadata, must_change_password: true, migrated_at: new Date().toISOString() },
    });

    await supabaseAdmin.from("migration_tracking")
      .update({ status: "migrated", migrated_at: new Date().toISOString() })
      .eq("email", email.toLowerCase());

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: foundUser.email!,
    });
    if (linkError) throw linkError;

    const url = new URL(linkData.properties.action_link);
    const token = url.searchParams.get("token");
    const type = url.searchParams.get("type");

    return new Response(
      JSON.stringify({ success: true, token, type, email: foundUser.email }),
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
