import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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

    const { amount, pix_key, pix_key_type, pix_key_name, description } = await req.json();
    const value = Number(amount);
    if (!value || value <= 0) {
      return new Response(JSON.stringify({ error: "Valor inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!pix_key || !pix_key_type) {
      return new Response(JSON.stringify({ error: "Chave PIX obrigatória" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get admin phone
    const { data: profile } = await admin
      .from("profiles")
      .select("phone, full_name")
      .eq("user_id", userId)
      .maybeSingle();
    const phone = (profile?.phone || "").replace(/\D/g, "");
    if (!phone || phone.length < 10) {
      return new Response(JSON.stringify({ error: "Seu WhatsApp não está cadastrado no perfil" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { data: withdrawal, error: wErr } = await admin
      .from("openpix_withdrawals")
      .insert({
        requested_by: userId,
        amount: value,
        pix_key,
        pix_key_type,
        pix_key_name: pix_key_name || null,
        description: description || null,
        confirmation_code: code,
        expires_at: expiresAt,
        status: "pending",
      })
      .select("id")
      .single();

    if (wErr) throw new Error("Erro ao criar saque: " + wErr.message);

    // Send WhatsApp
    const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
    const maskedKey = pix_key.length > 12 ? pix_key.slice(0, 4) + "***" + pix_key.slice(-4) : pix_key;
    const message =
`🔐 *FBFlix — Confirmação de Saque OpenPix*

Solicitação de saque recebida:
💰 Valor: *${brl}*
🔑 Chave PIX: ${pix_key_type.toUpperCase()} — ${maskedKey}
${pix_key_name ? `📝 Destino: ${pix_key_name}\n` : ""}
Código de confirmação:

*${code}*

⏱️ Válido por 10 minutos.

Se não foi você, IGNORE esta mensagem e o saque será cancelado automaticamente.`;

    const waRes = await fetch(`${SUPABASE_URL}/functions/v1/wapi-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        action: "send-text",
        phone,
        message,
        event_key: "openpix_withdraw_code",
        user_id: userId,
      }),
    });
    const waText = await waRes.text();
    console.log("wapi-send:", waRes.status, waText.slice(0, 300));

    if (!waRes.ok) {
      await admin.from("openpix_withdrawals").update({ status: "failed", error_message: "Falha ao enviar código WhatsApp" }).eq("id", withdrawal.id);
      return new Response(JSON.stringify({ error: "Falha ao enviar código no WhatsApp" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, withdrawal_id: withdrawal.id, expires_at: expiresAt }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});