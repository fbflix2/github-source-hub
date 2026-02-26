import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_PASSWORD = "mudar@123";
const CHUNK_SIZE = 100;

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

    let body: any = {};
    try { body = await req.json(); } catch {}

    const sb = supabaseAdmin;

    // Status check
    if (body?.action === "status") {
      const { data: current } = await sb
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
      await sb.from("site_settings").upsert({
        key: "credentials_job",
        value: JSON.stringify({ status: "idle" }),
      }, { onConflict: "key" });
      return new Response(JSON.stringify({ status: "reset" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check current job state
    const { data: currentSetting } = await sb
      .from("site_settings")
      .select("value")
      .eq("key", "credentials_job")
      .maybeSingle();

    let jobState: any = currentSetting?.value ? JSON.parse(currentSetting.value) : null;
    const isContinue = body?.action === "continue";

    if (!isContinue) {
      if (jobState?.status === "in_progress") {
        const elapsed = Date.now() - (jobState.timestamp || 0);
        if (elapsed < 2 * 60 * 1000) {
          return new Response(
            JSON.stringify({ status: "in_progress", progress: jobState.progress || 0, processed: jobState.processed || 0, total: jobState.total || 0 }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // --- CONTINUE PATH: load cached data from partial file ---
    if (isContinue && jobState?.status === "in_progress" && jobState?.partial_file) {
      console.log("Continue chunk from", jobState.processed, "partial:", jobState.partial_file);
      
      let partialData: any = null;
      try {
        const { data: fileData } = await sb.storage.from("documents").download(jobState.partial_file);
        if (fileData) partialData = JSON.parse(await fileData.text());
      } catch (e) {
        console.error("Failed to load partial file:", e);
      }
      
      if (!partialData?.allProfiles) {
        throw new Error("Arquivo parcial corrompido, reinicie o job");
      }

      const { allProfiles, userIdToEmail, emailToUserId, subsByUser, adminUserIds, credentials, errors } = partialData;
      const total = allProfiles.length;
      const startIdx = jobState.processed || 0;
      const endIdx = Math.min(startIdx + CHUNK_SIZE, total);
      const isLastChunk = endIdx >= total;

      // Update status
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

      // Process chunk
      let processed = startIdx;
      for (let i = startIdx; i < endIdx; i++) {
        const profile = allProfiles[i];
        const email = userIdToEmail[profile.user_id];
        if (!email) {
          errors.push(`${profile.full_name || profile.user_id}: Sem email`);
          processed++;
          continue;
        }

        const subs = subsByUser[profile.user_id] || [];
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
          ? subs.map((s: any) => (s.product_name || s.name)).join(", ")
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

      console.log(`Processed chunk ${startIdx}-${endIdx} of ${total}`);

      if (!isLastChunk) {
        // Save updated partial with same cached data
        const partialFile = `credentials/partial_${Date.now()}.json`;
        const updatedPartial = { ...partialData, credentials, errors };
        const blob = new Blob([JSON.stringify(updatedPartial)], { type: "application/json" });
        await sb.storage.from("documents").upload(partialFile, blob, { contentType: "application/json", upsert: true });

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

      // Last chunk - finalize
      return await finalizeJob(sb, credentials, errors, partialData);
    }

    // --- NEW JOB: build data and process first chunk ---
    console.log("Starting new credentials job...");

    // 1. Get admin user_ids
    const { data: adminRoles } = await sb.from("user_roles").select("user_id").eq("role", "admin");
    const adminUserIds = (adminRoles || []).map((r: any) => r.user_id);
    const adminSet = new Set(adminUserIds);

    // 2. Build email map
    const userIdToEmail: Record<string, string> = {};
    const emailToUserId: Record<string, string> = {};
    let pg = 1;
    while (true) {
      const { data: { users }, error } = await sb.auth.admin.listUsers({ page: pg, perPage: 1000 });
      if (error || !users?.length) break;
      for (const u of users) {
        if (u.email) {
          userIdToEmail[u.id] = u.email.toLowerCase();
          emailToUserId[u.email.toLowerCase()] = u.id;
        }
      }
      if (users.length < 1000) break;
      pg++;
    }
    console.log(`Loaded ${Object.keys(userIdToEmail).length} auth users`);

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
    allProfiles = allProfiles.filter(p => !adminSet.has(p.user_id));
    console.log(`Loaded ${allProfiles.length} profiles`);

    // 4. Get active subs grouped by user
    const subsByUser: Record<string, any[]> = {};
    from = 0;
    while (true) {
      const { data } = await sb.from("subscriptions")
        .select("id, name, user_id, status, raw_data")
        .eq("type", "proxybr")
        .in("status", ["active", "pending_renewal"])
        .range(from, from + 999);
      if (!data?.length) break;
      for (const sub of data) {
        if (!subsByUser[sub.user_id]) subsByUser[sub.user_id] = [];
        subsByUser[sub.user_id].push({
          id: sub.id,
          name: sub.name,
          user_id: sub.user_id,
          status: sub.status,
          product_name: sub.raw_data?.product?.name || sub.name,
        });
      }
      if (data.length < 1000) break;
      from += 1000;
    }
    console.log(`Loaded subscriptions for ${Object.keys(subsByUser).length} users`);

    // Sort: most active subs first
    allProfiles.sort((a: any, b: any) => (subsByUser[b.user_id]?.length || 0) - (subsByUser[a.user_id]?.length || 0));

    const total = allProfiles.length;
    const endIdx = Math.min(CHUNK_SIZE, total);
    const isLastChunk = endIdx >= total;

    // Update status
    await sb.from("site_settings").upsert({
      key: "credentials_job",
      value: JSON.stringify({
        status: "in_progress",
        timestamp: Date.now(),
        progress: 0,
        processed: 0,
        total,
      }),
    }, { onConflict: "key" });

    // Process first chunk
    const credentials: any[] = [];
    const errors: string[] = [];
    let processed = 0;

    for (let i = 0; i < endIdx; i++) {
      const profile = allProfiles[i];
      const email = userIdToEmail[profile.user_id];
      if (!email) {
        errors.push(`${profile.full_name || profile.user_id}: Sem email`);
        processed++;
        continue;
      }

      const subs = subsByUser[profile.user_id] || [];
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
        ? subs.map((s: any) => s.product_name || s.name).join(", ")
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

    console.log(`First chunk done: ${processed}/${total}`);

    if (!isLastChunk) {
      // Save partial with ALL cached data so continue calls are fast
      const partialFile = `credentials/partial_${Date.now()}.json`;
      const partialData = {
        allProfiles,
        userIdToEmail,
        emailToUserId,
        subsByUser,
        adminUserIds,
        credentials,
        errors,
      };
      const blob = new Blob([JSON.stringify(partialData)], { type: "application/json" });
      await sb.storage.from("documents").upload(partialFile, blob, { contentType: "application/json", upsert: true });

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

    // Small dataset - done in one chunk
    const partialData = { allProfiles, userIdToEmail, emailToUserId, subsByUser, adminUserIds, credentials, errors };
    return await finalizeJob(sb, credentials, errors, partialData);

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Credentials error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function finalizeJob(sb: any, credentials: any[], errors: string[], partialData: any) {
  // Handle unlinked subs
  const adminUserIds = partialData.adminUserIds || [];
  const emailToUserId = partialData.emailToUserId || {};
  const subsByUser = partialData.subsByUser || {};

  // Get all active subs for admin users (unlinked)
  for (const adminId of adminUserIds) {
    const adminSubs = subsByUser[adminId] || [];
    for (const sub of adminSubs) {
      const raw = sub.raw_data || {};
      const notes = (raw.notes || "").trim();
      if (!notes) continue;

      const emailMatch = notes.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (!emailMatch) continue;

      const email = emailMatch[0].toLowerCase();
      if (credentials.some(c => c.email === email)) continue;

      const existingUserId = emailToUserId[email];
      try {
        if (existingUserId) {
          await sb.auth.admin.updateUserById(existingUserId, {
            password: "mudar@123",
            user_metadata: { must_change_password: true },
          });
          await sb.from("subscriptions").update({ user_id: existingUserId }).eq("id", sub.id);
        } else {
          const { data: userData, error: createError } = await sb.auth.admin.createUser({
            email,
            password: "mudar@123",
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
          password: "mudar@123",
          full_name: notes || "",
          phone: "",
          active_subscriptions: 1,
          subscription_products: sub.product_name || sub.name,
          status: "Novo (criado agora)",
        });
      } catch (err: any) {
        errors.push(`${email}: ${err.message}`);
      }
    }
  }

  // Save final file
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
}
