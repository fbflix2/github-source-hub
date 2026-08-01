import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import webpush from "npm:web-push@3.6.7";
import { z } from "npm:zod@3.23.8";

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:contato@fbflix.com.br";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const RequestSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().max(500).optional(),
  url: z.string().max(500).optional(),
  icon: z.string().max(500).optional(),
  tag: z.string().max(120).optional(),
  user_id: z.string().uuid().optional(),
  endpoint: z.string().url().max(3000).optional(),
  delay_ms: z.number().int().min(0).max(10000).optional(),
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error("Configuração Supabase ausente");

    let callerId: string | undefined;
    if (!isInternal) {
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authorization! } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(authorization!.replace(/^Bearer\s+/i, ""));
      callerId = claimsData?.claims?.sub as string | undefined;
      if (claimsError || !callerId) {
        return new Response(JSON.stringify({ error: "Sessão inválida" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const parsedBody = RequestSchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return new Response(JSON.stringify({ error: parsedBody.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { title, body, url, icon, tag, user_id, endpoint, delay_ms } = parsedBody.data;

    const supa = createClient(supabaseUrl, serviceRoleKey);
    if (!isInternal) {
      const { data: callerRole } = await supa
        .from("user_roles")
        .select("role")
        .eq("user_id", callerId!)
        .in("role", ["admin", "moderator"])
        .maybeSingle();
      if (!callerRole || (user_id && user_id !== callerId)) {
        return new Response(JSON.stringify({ error: "Acesso restrito à equipe" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let targetIds: string[] = [];
    if (user_id && !isInternal) {
      targetIds = [callerId!];
    } else {
      const { data: roles, error: rolesErr } = await supa
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "moderator"]);
      if (rolesErr) throw rolesErr;
      targetIds = [...new Set((roles || []).map((r: any) => r.user_id))];
    }

    if (targetIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no admins" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let subscriptionsQuery = supa
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("scope", "admin")
      .in("user_id", targetIds);
    if (endpoint) subscriptionsQuery = subscriptionsQuery.eq("endpoint", endpoint);
    const { data: subs, error } = await subscriptionsQuery;

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      title,
      body: body || "",
      url: url || "/admin",
      icon,
      tag: tag || "fbflix-admin",
    });

    let sent = 0;
    const staleIds: string[] = [];
    const providerStatuses: number[] = [];

    if (delay_ms) await new Promise((resolve) => setTimeout(resolve, delay_ms));

    await Promise.all(subs.map(async (s: any) => {
      try {
        const result = await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        providerStatuses.push(result.statusCode);
        sent++;
      } catch (e: any) {
        const status = e?.statusCode;
        if (status === 404 || status === 410) staleIds.push(s.id);
        console.error("admin push error:", status, e?.body || e?.message);
      }
    }));

    if (staleIds.length > 0) {
      await supa.from("push_subscriptions").delete().in("id", staleIds);
    }

    return new Response(JSON.stringify({
      sent,
      removed: staleIds.length,
      attempted: subs.length,
      provider_statuses: providerStatuses,
      reason: sent === 0 ? "A entrega foi recusada pelo serviço de notificações deste aparelho" : undefined,
    }), {
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
