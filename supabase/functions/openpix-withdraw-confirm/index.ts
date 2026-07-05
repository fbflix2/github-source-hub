import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENPIX_APP_ID = Deno.env.get("OPENPIX_APP_ID");
    if (!OPENPIX_APP_ID) throw new Error("OPENPIX_APP_ID não configurado");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authed = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await authed.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Apenas admin pode sacar" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { withdrawal_id, code } = await req.json();
    if (!withdrawal_id || !code) {
      return new Response(JSON.stringify({ error: "Dados incompletos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: w, error: wErr } = await admin
      .from("openpix_withdrawals")
      .select("*")
      .eq("id", withdrawal_id)
      .eq("requested_by", userId)
      .maybeSingle();

    if (wErr || !w) {
      return new Response(JSON.stringify({ error: "Saque não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (w.status !== "pending") {
      return new Response(JSON.stringify({ error: `Saque com status: ${w.status}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (new Date(w.expires_at) < new Date()) {
      await admin.from("openpix_withdrawals").update({ status: "expired" }).eq("id", w.id);
      return new Response(JSON.stringify({ error: "Código expirado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (String(w.confirmation_code).trim() !== String(code).trim()) {
      return new Response(JSON.stringify({ error: "Código inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark confirmed
    await admin.from("openpix_withdrawals").update({ status: "confirmed", confirmed_at: new Date().toISOString() }).eq("id", w.id);

    // Call OpenPix transfer endpoint
    // Docs: https://developers.openpix.com.br/api#tag/transfer
    const correlationID = `WD-${w.id}`;
    const payload = {
      value: Math.round(Number(w.amount) * 100),
      correlationID,
      destinationAlias: w.pix_key,
      destinationAliasType: (w.pix_key_type || "").toUpperCase(),
      comment: (w.description || `Saque ${correlationID}`).slice(0, 140),
    };

    const opRes = await fetch("https://api.openpix.com.br/api/v1/transfer", {
      method: "POST",
      headers: {
        Authorization: OPENPIX_APP_ID,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const opText = await opRes.text();
    let opData: any = null;
    try { opData = JSON.parse(opText); } catch { opData = { raw: opText }; }
    console.log("OpenPix transfer status:", opRes.status, opText.slice(0, 500));

    if (!opRes.ok) {
      await admin.from("openpix_withdrawals").update({
        status: "failed",
        error_message: `OpenPix [${opRes.status}]: ${opText.slice(0, 400)}`,
      }).eq("id", w.id);
      return new Response(JSON.stringify({ error: `Falha OpenPix: ${opData?.error || opData?.message || opRes.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const txId = opData?.transaction?.transactionID || opData?.transfer?.transactionID || opData?.transactionID || correlationID;

    await admin.from("openpix_withdrawals").update({
      status: "executed",
      openpix_transaction_id: txId,
      executed_at: new Date().toISOString(),
    }).eq("id", w.id);

    return new Response(JSON.stringify({ success: true, transaction_id: txId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});