import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_PASSWORD = "mudar@123";
const CHUNK_SIZE = 150; // Process 150 users per invocation to avoid timeout

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

    // Parse body
    let body: any = {};
    try { body = await req.json(); } catch {}

    // Status check
    if (body?.action === "status") {
      const { data: current } = await supabaseAdmin
        .from("site_settings")
        .select("value")
        .eq("key", "credentials_job")
        .maybeSingle();
      const parsed = current?.value ? JSON.parse(current.value) : { status: "idle" };
      return new Response(JSON.stringify(parsed), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reset action
    if (body?.action === "reset") {
      await supabaseAdmin.from("site_settings").upsert({
        key: "credentials_job",
        value: JSON.stringify({ status: "idle" }),
      }, { onConflict: "key" });
      return new Response(JSON.stringify({ status: "reset" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check current job state
    const { data: currentSetting } = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", "credentials_job")
      .maybeSingle();

    let jobState: any = currentSetting?.value ? JSON.parse(currentSetting.value) : null;

    // If action=continue, we're resuming a chunked job
    const isContinue = body?.action === "continue";

    if (!isContinue) {
      // New job - check if one is already running
      if (jobState?.status === "in_progress") {
        const elapsed = Date.now() - (jobState.timestamp || 0);
        // If stale (>2 min since last update), allow restart
        if (elapsed < 2 * 60 * 1000) {
          return new Response(
            JSON.stringify({ status: "in_progress", progress: jobState.progress || 0, processed: jobState.processed || 0, total: jobState.total || 0 }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        // Stale - restart
      }
    }

    const sb = supabaseAdmin;

    // 1. Get admin user_ids
    const { data: adminRoles } = await sb.from("user_roles").select("user_id").eq("role", "admin");
    const adminUserIds = new Set((adminRoles || []).map((r: any) => r.user_id));

    // 2. Build email map
    const userIdToEmail = new Map<string, string>();
    const emailToUserId = new Map<string, string>();
    let pg = 1;
    while (true) {
      const { data: { users }, error } = await sb.auth.admin.listUsers({ page: pg, perPage: 1000 });
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

    // 3. Get all non-admin profiles
    let allProfiles: any[] = [];
    let from = 0;
    while (true) {
      const { data } = await sb.from("profiles").select("user_id, full_name, phone").range(from, from + 999);
      if (!data?.length) break;
      allProfiles = [...allProfiles, ...data];
      if (data.length < 1000) break;
      from += 1000;
    }
    allProfiles = allProfiles.filter(p => !adminUserIds.has(p.user_id));

    // 4. Get active subs grouped by user
    let allSubs: any[] = [];
    from = 0;
    while (true) {
      const { data } = await sb.from("subscriptions")
        .select("id, name, user_id, status, raw_data")
        .eq("type", "proxybr")
        .in("status", ["active", "pending_renewal"])
        .range(from, from + 999);
      if (!data?.length) break;
      allSubs = [...allSubs, ...data];
      if (data.length < 1000) break;
      from += 1000;
    }

    const subsByUser = new Map<string, any[]>();
    for (const sub of allSubs) {
      const list = subsByUser.get(sub.user_id) || [];
      list.push(sub);
      subsByUser.set(sub.user_id, list);
    }

    // Sort: most active subs first
    allProfiles.sort((a: any, b: any) => (subsByUser.get(b.user_id)?.length || 0) - (subsByUser.get(a.user_id)?.length || 0));

    const total = allProfiles.length;

    // Determine chunk range
    let startIdx = 0;
    let existingCredentials: any[] = [];
    let existingErrors: string[] = [];

    if (isContinue && jobState?.status === "in_progress") {
      startIdx = jobState.processed || 0;
      // Load existing partial credentials from storage
      if (jobState.partial_file) {
        try {
          const { data: fileData } = await sb.storage.from("documents").download(jobState.partial_file);
          if (fileData) {
            const parsed = JSON.parse(await fileData.text());
            existingCredentials = parsed.credentials || [];
            existingErrors = parsed.errors || [];
          }
        } catch {}
      }
    }

    const endIdx = Math.min(startIdx + CHUNK_SIZE, total);
    const isLastChunk = endIdx >= total;

    // Mark as in_progress
    await sb.from("site_settings").upsert({
      key: "credentials_job",
      value: JSON.stringify({
        status: "in_progress",
        timestamp: Date.now(),
        progress: Math.round((startIdx / total) * 100),
        processed: startIdx,
        total,
      }),
    }, { onConflict: "key" });

    // 5. Process this chunk
    const credentials = [...existingCredentials];
    const errors = [...existingErrors];
    let processed = startIdx;

    for (let i = startIdx; i < endIdx; i++) {
      const profile = allProfiles[i];
      const email = userIdToEmail.get(profile.user_id);
      if (!email) {
        errors.push(`${profile.full_name || profile.user_id}: Sem email`);
        processed++;
        continue;
      }

      const subs = subsByUser.get(profile.user_id) || [];

      try {
        await sb.auth.admin.updateUserById(profile.user_id, {
          password: DEFAULT_PASSWORD,
          user_metadata: { must_change_password: true },
        });
      } catch (err: any) {
        errors.push(`${email}: ${err.message}`);
        processed++;
        continue;
      }

      const subsInfo = subs.length > 0
        ? subs.map((s: any) => (s.raw_data?.product?.name || s.name)).join(", ")
        : "Nenhuma";

      credentials.push({
        email,
        password: DEFAULT_PASSWORD,
        full_name: profile.full_name || "",
        phone: profile.phone || "",
        active_subscriptions: subs.length,
        subscription_products: subsInfo,
        status: subs.length > 0 ? "Cliente ativo" : "Sem assinatura",
      });

      processed++;
    }

    // Save partial results to storage
    const partialFile = `credentials/partial_${Date.now()}.json`;
    const partialBlob = new Blob([JSON.stringify({ credentials, errors })], { type: "application/json" });
    await sb.storage.from("documents").upload(partialFile, partialBlob, { contentType: "application/json", upsert: true });

    if (!isLastChunk) {
      // More chunks needed
      await sb.from("site_settings").upsert({
        key: "credentials_job",
        value: JSON.stringify({
          status: "in_progress",
          timestamp: Date.now(),
          progress: Math.round((processed / total) * 100),
          processed,
          total,
          partial_file: partialFile,
          needs_continue: true,
        }),
      }, { onConflict: "key" });

      return new Response(
        JSON.stringify({ status: "in_progress", progress: Math.round((processed / total) * 100), processed, total, needs_continue: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Last chunk - handle unlinked subs
    const adminId = adminRoles?.[0]?.user_id;
    const unlinkedSubs = allSubs.filter(s => s.user_id === adminId);

    for (const sub of unlinkedSubs) {
      const raw = sub.raw_data || {};
      const notes = (raw.notes || "").trim();
      if (!notes) continue;

      const emailMatch = notes.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (!emailMatch) continue;

      const email = emailMatch[0].toLowerCase();
      if (credentials.some(c => c.email === email)) continue;

      const existingUserId = emailToUserId.get(email);
      try {
        if (existingUserId) {
          await sb.auth.admin.updateUserById(existingUserId, {
            password: DEFAULT_PASSWORD,
            user_metadata: { must_change_password: true },
          });
          await sb.from("subscriptions").update({ user_id: existingUserId }).eq("id", sub.id);
        } else {
          const { data: userData, error: createError } = await sb.auth.admin.createUser({
            email,
            password: DEFAULT_PASSWORD,
            email_confirm: true,
            user_metadata: { full_name: notes || email.split("@")[0], must_change_password: true },
          });
          if (createError) { errors.push(`${email}: ${createError.message}`); continue; }
          if (userData.user) {
            await new Promise(r => setTimeout(r, 200));
            await sb.from("profiles").update({ full_name: notes }).eq("user_id", userData.user.id);
            await sb.from("subscriptions").update({ user_id: userData.user.id }).eq("id", sub.id);
          }
        }

        credentials.push({
          email,
          password: DEFAULT_PASSWORD,
          full_name: notes || "",
          phone: "",
          active_subscriptions: 1,
          subscription_products: raw.product?.name || sub.name,
          status: "Novo (criado agora)",
        });
      } catch (err: any) {
        errors.push(`${email}: ${err.message}`);
      }
    }

    // Final file
    const fileName = `credentials_${Date.now()}.json`;
    const jsonBlob = new Blob([JSON.stringify(credentials)], { type: "application/json" });
    await sb.storage.from("documents").upload(`credentials/${fileName}`, jsonBlob, { contentType: "application/json", upsert: true });

    await sb.from("site_settings").upsert({
      key: "credentials_job",
      value: JSON.stringify({
        status: "done",
        timestamp: Date.now(),
        total_clients: credentials.length,
        file_path: `credentials/${fileName}`,
        errors: errors.slice(0, 50),
      }),
    }, { onConflict: "key" });

    console.log(`Credentials job done: ${credentials.length} clients, ${errors.length} errors`);

    return new Response(
      JSON.stringify({ status: "done", total_clients: credentials.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Credentials error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
