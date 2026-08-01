import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import webpush from "npm:web-push@3.6.7";
import { z } from "npm:zod@3.23.8";

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:contato@fbflix.com.br";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const RequestSchema = z.object({
  user_id: z.string().uuid().optional(),
  user_ids: z.array(z.string().uuid()).max(500).optional(),
  title: z.string().min(1).max(120),
  body: z.string().max(500).optional(),
  url: z.string().max(500).optional(),
  icon: z.string().max(500).optional(),
  tag: z.string().max(120).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const internalKey = Deno.env.get("PUSH_TRIGGER_KEY");
    const isInternal = !!internalKey && req.headers.get("x-internal-secret") === internalKey;
    const authorization = req.headers.get("Authorization");
    if (!isInternal && !authorization) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supa = createClient(supabaseUrl, serviceRoleKey);

    let callerId: string | undefined;
    let callerIsStaff = false;
    if (!isInternal) {
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authorization! } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: claimsData } = await authClient.auth.getClaims(authorization!.replace(/^Bearer\s+/i, ""));
      callerId = claimsData?.claims?.sub as string | undefined;
      if (!callerId) {
        return new Response(JSON.stringify({ error: "Sessão inválida" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: role } = await supa
        .from("user_roles").select("role").eq("user_id", callerId)
        .in("role", ["admin", "moderator"]).maybeSingle();
      callerIsStaff = !!role;
    }

    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { title, body, url, icon, tag } = parsed.data;

    let targets = [...new Set([...(parsed.data.user_ids || []), ...(parsed.data.user_id ? [parsed.data.user_id] : [])])];
    if (!isInternal && !callerIsStaff) targets = [callerId!];
    if (targets.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no targets" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subs, error } = await supa
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("scope", "client")
      .in("user_id", targets);
    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      title,
      body: body || "",
      url: url || "/",
      icon,
      tag: tag || "fbflix-cliente",
    });

    let sent = 0;
    const staleIds: string[] = [];
    await Promise.all(subs.map(async (s: any) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        sent++;
      } catch (e: any) {
        const status = e?.statusCode;
        if (status === 404 || status === 410) staleIds.push(s.id);
        console.error("client push error:", status, e?.body || e?.message);
      }
    }));

    if (staleIds.length > 0) await supa.from("push_subscriptions").delete().in("id", staleIds);

    return new Response(JSON.stringify({ sent, attempted: subs.length, removed: staleIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
