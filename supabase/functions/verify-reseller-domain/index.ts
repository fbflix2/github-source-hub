import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function resolveDns(name: string, type: "TXT" | "CNAME"): Promise<string[]> {
  try {
    const r = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
      { headers: { accept: "application/dns-json" } },
    );
    if (!r.ok) return [];
    const data = await r.json();
    const answers = (data.Answer ?? []) as { data: string }[];
    return answers.map((a) => a.data.replace(/^"|"$/g, "").replace(/"\s+"/g, ""));
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { reseller_id } = await req.json().catch(() => ({}));
    if (!reseller_id) return json({ error: "reseller_id obrigatório" }, 400);

    const { data: reseller, error } = await supabase
      .from("resellers")
      .select("id, custom_domain")
      .eq("id", reseller_id)
      .maybeSingle();

    if (error || !reseller) return json({ error: "Revendedor não encontrado" }, 404);
    if (!reseller.custom_domain) return json({ error: "Nenhum domínio configurado" }, 400);

    const domain = reseller.custom_domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const parts = domain.split(".");
    if (parts.length < 3) {
      return json({
        error: "Use um subdomínio (ex: painel.suamarca.com.br). O domínio raiz não é permitido.",
      }, 400);
    }
    const rootDomain = parts.slice(-2).join(".");
    const expectedToken = `fbflix-reseller=${reseller.id}`;

    // 1) TXT em _fbflix-verify.<root>
    const txtRecords = await resolveDns(`_fbflix-verify.${rootDomain}`, "TXT");
    const txtOk = txtRecords.some((r) => r.replace(/\s+/g, "") === expectedToken);

    // 2) CNAME apontando para cname.fbflix.com.br
    const cnameRecords = await resolveDns(domain, "CNAME");
    const cnameOk = cnameRecords.some((r) =>
      r.replace(/\.$/, "").toLowerCase() === "cname.fbflix.com.br",
    );

    let newStatus: "verified" | "failed" | "pending" = "pending";
    let message = "";

    if (txtOk && cnameOk) {
      newStatus = "verified";
      message = "Domínio verificado com sucesso!";
    } else if (!txtOk && !cnameOk) {
      newStatus = "failed";
      message = "Nenhum dos registros foi encontrado. Verifique CNAME e TXT no seu registrador.";
    } else if (!txtOk) {
      newStatus = "failed";
      message = `Registro TXT não encontrado em _fbflix-verify.${rootDomain}. Verifique o valor: ${expectedToken}`;
    } else {
      newStatus = "failed";
      message = `CNAME de ${domain} deve apontar para cname.fbflix.com.br`;
    }

    await supabase
      .from("resellers")
      .update({ domain_status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", reseller.id);

    return json({
      success: true,
      status: newStatus,
      message,
      checks: {
        txt: { host: `_fbflix-verify.${rootDomain}`, expected: expectedToken, found: txtRecords, ok: txtOk },
        cname: { host: domain, expected: "cname.fbflix.com.br", found: cnameRecords, ok: cnameOk },
      },
    });
  } catch (e) {
    console.error("[verify-reseller-domain]", e);
    return json({ error: (e as Error).message ?? "Erro inesperado" }, 500);
  }
});