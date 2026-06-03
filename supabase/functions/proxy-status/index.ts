import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SERVICES = [
  {
    key: "proxy_api",
    label: "API de Proxies",
    url: "https://proxy.webshare.io/api/v2/profile/",
    // Expect 401 when unauthenticated => API alive. 5xx/404 => down.
    healthyStatuses: [200, 401, 403],
  },
  {
    key: "proxy_network",
    label: "Rede de Proxies",
    url: "https://proxy.webshare.io/api/v2/proxy/config/",
    healthyStatuses: [200, 401, 403],
  },
  {
    key: "dashboard",
    label: "Painel FBFlix",
    url: "https://fbflix.com.br",
    healthyStatuses: [200, 301, 302, 304],
  },
] as const;

type ServiceKey = (typeof SERVICES)[number]["key"];

// ---------------------------------------------------------------------------
// Webshare Statuspage mirror — Webshare powers our proxy network, so we mirror
// their public status page (status.webshare.io) and rebrand it as FBFlix.
// ---------------------------------------------------------------------------
const WS_STATUSPAGE = "https://status.webshare.io/api/v2";

function rebrand(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/Webshare Proxy/gi, "Proxy FBFlix")
    .replace(/Webshare/gi, "Proxy FBFlix");
}

async function fetchUpstreamStatus() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const [summaryResp, incidentsResp] = await Promise.all([
      fetch(`${WS_STATUSPAGE}/summary.json`, { signal: controller.signal }),
      fetch(`${WS_STATUSPAGE}/incidents.json?limit=20`, { signal: controller.signal }),
    ]);
    clearTimeout(timeout);
    if (!summaryResp.ok) return null;
    const summary = await summaryResp.json();
    const incidentsJson = incidentsResp.ok ? await incidentsResp.json() : { incidents: [] };

    return {
      status: {
        indicator: summary?.status?.indicator || "none", // none|minor|major|critical
        description: rebrand(summary?.status?.description) || "Todos os sistemas operacionais",
      },
      components: (summary?.components || [])
        .filter((c: any) => !c.group_id) // skip groups
        .map((c: any) => ({
          id: c.id,
          name: rebrand(c.name),
          status: c.status, // operational|degraded_performance|partial_outage|major_outage|under_maintenance
        })),
      incidents: ((incidentsJson?.incidents || []) as any[]).slice(0, 10).map((i) => ({
        id: i.id,
        name: rebrand(i.name),
        status: i.status, // investigating|identified|monitoring|resolved|postmortem
        impact: i.impact, // none|minor|major|critical
        created_at: i.created_at,
        updated_at: i.updated_at,
        resolved_at: i.resolved_at,
        shortlink: null, // hide upstream link
        updates: (i.incident_updates || []).slice(0, 6).map((u: any) => ({
          status: u.status,
          body: rebrand(u.body),
          created_at: u.created_at,
        })),
      })),
    };
  } catch (e) {
    console.warn("[proxy-status] upstream fetch failed", (e as any)?.message);
    return null;
  }
}

async function probe(url: string, healthy: readonly number[]) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const resp = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": "FBFlix-Status-Monitor/1.0" },
    });
    clearTimeout(timeout);
    const latency = Date.now() - start;
    // Consume body to free connection
    try { await resp.text(); } catch { /* ignore */ }
    const ok = healthy.includes(resp.status);
    let status: "operational" | "degraded" | "down";
    if (ok && latency < 3500) status = "operational";
    else if (ok) status = "degraded";
    else status = "down";
    return { status, latency_ms: latency, http_status: resp.status, message: null as string | null };
  } catch (e: any) {
    const latency = Date.now() - start;
    return {
      status: "down" as const,
      latency_ms: latency,
      http_status: null,
      message: e?.name === "AbortError" ? "Timeout (10s)" : (e?.message || "Falha de rede"),
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Rate-limit persistent writes: only insert a new check if the last one for
    // each service is older than 45s. Always return the latest data.
    const { data: lastChecks } = await supabase
      .from("proxy_status_checks")
      .select("service, checked_at")
      .order("checked_at", { ascending: false })
      .limit(50);

    const lastByService = new Map<string, string>();
    for (const row of lastChecks || []) {
      if (!lastByService.has(row.service)) lastByService.set(row.service, row.checked_at);
    }

    const now = Date.now();
    const shouldRefresh = SERVICES.some((s) => {
      const last = lastByService.get(s.key);
      if (!last) return true;
      return now - new Date(last).getTime() > 45_000;
    });

    if (shouldRefresh) {
      const results = await Promise.all(
        SERVICES.map(async (s) => {
          const r = await probe(s.url, s.healthyStatuses);
          return { service: s.key, ...r };
        }),
      );
      await supabase.from("proxy_status_checks").insert(results);
    }

    // Read history for last 24h (limited rows per service via window-style query)
    const since = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const { data: history } = await supabase
      .from("proxy_status_checks")
      .select("service, status, latency_ms, http_status, message, checked_at")
      .gte("checked_at", since)
      .order("checked_at", { ascending: false })
      .limit(2000);

    // Build summary
    const byService: Record<string, any> = {};
    for (const s of SERVICES) {
      const rows = (history || []).filter((h) => h.service === s.key);
      const latest = rows[0];
      // uptime over the rows we have
      const opCount = rows.filter((r) => r.status === "operational").length;
      const uptime = rows.length > 0 ? (opCount / rows.length) * 100 : 100;
      byService[s.key] = {
        key: s.key,
        label: s.label,
        current: latest?.status || "unknown",
        latency_ms: latest?.latency_ms ?? null,
        last_check: latest?.checked_at ?? null,
        uptime_24h: Number(uptime.toFixed(2)),
        history: rows.slice(0, 90).reverse(), // oldest -> newest for the bar
      };
    }

    const overall = Object.values(byService).some((s: any) => s.current === "down")
      ? "down"
      : Object.values(byService).some((s: any) => s.current === "degraded")
      ? "degraded"
      : "operational";

    const upstream = await fetchUpstreamStatus();

    // If upstream reports a non-operational status, escalate our overall.
    let finalOverall = overall;
    if (upstream) {
      const ind = upstream.status.indicator;
      if (ind === "critical" || ind === "major") finalOverall = "down";
      else if (ind === "minor" && finalOverall === "operational") finalOverall = "degraded";
    }

    return new Response(
      JSON.stringify({
        overall: finalOverall,
        services: Object.values(byService),
        upstream,
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[proxy-status]", e?.message);
    return new Response(
      JSON.stringify({ error: e?.message || "Erro inesperado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});