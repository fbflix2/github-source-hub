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
      .select("id, custom_domain, lovable_verify_token")
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
    const subHost = parts[0];
    const expectedA = "185.158.133.1";
    const verifyToken = (reseller.lovable_verify_token || "").trim();
    const expectedTxt = verifyToken ? `lovable_verify=${verifyToken}` : "";

    // 1) A record no subdomínio deve apontar para 185.158.133.1
    const aRecords = await resolveDns(domain, "A");
    const aOk = aRecords.includes(expectedA);

    // 2) TXT em _lovable.<subHost>.<root> = lovable_verify=<token>
    const txtHost = `_lovable.${domain}`;
    const txtRecords = await resolveDns(txtHost, "TXT");
    const txtOk = !!expectedTxt && txtRecords.some(
      (r) => r.replace(/\s+/g, "").toLowerCase() === expectedTxt.toLowerCase(),
    );

    let newStatus: "verified" | "failed" | "pending" = "pending";
    let message = "";

    if (!expectedTxt) {
      newStatus = "pending";
      message = "Aguardando token de verificação do suporte FBFlix. Assim que o token for liberado, clique em Verificar novamente.";
    } else if (aOk && txtOk) {
      newStatus = "verified";
      message = "Domínio verificado com sucesso!";
    } else if (!aOk && !txtOk) {
      newStatus = "failed";
      message = "Nenhum dos registros foi encontrado. Verifique o A e o TXT no seu registrador.";
    } else if (!aOk) {
      newStatus = "failed";
      message = `Registro A de ${domain} deve apontar para ${expectedA}.`;
    } else {
      newStatus = "failed";
      message = `Registro TXT em ${txtHost} não encontrado. Valor esperado: ${expectedTxt}`;
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
        a: { host: domain, expected: expectedA, found: aRecords, ok: aOk },
        txt: { host: txtHost, expected: expectedTxt, found: txtRecords, ok: txtOk },
      },
    });
  } catch (e) {
    console.error("[verify-reseller-domain]", e);
    return json({ error: (e as Error).message ?? "Erro inesperado" }, 500);
  }
});