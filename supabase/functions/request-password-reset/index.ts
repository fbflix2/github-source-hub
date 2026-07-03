import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "email obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const emailNorm = email.trim().toLowerCase();

    // Find user by email
    const { data: userIdRow } = await admin.rpc("get_user_id_by_email", { target_email: emailNorm });
    const userId = (userIdRow as string) || null;
    console.log("[request-password-reset] email:", emailNorm, "userId:", userId);

    // Always return a generic success to avoid leaking whether the email exists.
    const genericOk = () =>
      new Response(
        JSON.stringify({ success: true, message: "Se o email estiver cadastrado, um código foi enviado ao WhatsApp." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    if (!userId) {
      console.log("[request-password-reset] no user found for email");
      return genericOk();
    }

    // Fetch profile phone
    const { data: profile } = await admin
      .from("profiles")
      .select("phone, full_name")
      .eq("user_id", userId)
      .maybeSingle();

    const phoneRaw = profile?.phone || "";
    const phone = onlyDigits(phoneRaw);
    console.log("[request-password-reset] phone:", phone, "len:", phone.length);
    if (!phone || phone.length < 10) {
      console.log("[request-password-reset] phone missing or too short");
      return genericOk();
    }

    // Invalidate previous active codes
    await admin
      .from("password_reset_codes")
      .update({ used: true })
      .eq("email", emailNorm)
      .eq("used", false);

    // Generate & store new code (15 min expiry)
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await admin.from("password_reset_codes").insert({
      user_id: userId,
      email: emailNorm,
      phone,
      code,
      expires_at: expiresAt,
    });

    // Build message
    const origin = req.headers.get("origin") || "https://fbflix.com.br";
    const link = `${origin}/reset-password?email=${encodeURIComponent(emailNorm)}`;
    const firstName = (profile?.full_name || "").trim().split(/\s+/)[0] || "";
    const greeting = firstName ? `Olá, ${firstName}!` : "Olá!";
    const message =
      `${greeting}\n\n` +
      `Somos da *FBFLIX*. Foi solicitada uma troca de senha para a sua conta.\n\n` +
      `🔐 *Código de confirmação:* ${code}\n` +
      `Válido por *15 minutos*.\n\n` +
      `Se *não foi você* que solicitou, ignore esta mensagem — sua conta continua segura.\n\n` +
      `Se foi você, acesse o link abaixo, informe o código e defina uma nova senha:\n${link}\n\n` +
      `Nunca compartilhe este código com ninguém. A FBFLIX jamais pedirá sua senha.`;

    // Send via wapi-send (fire and forget-ish, but we await to catch errors)
    try {
      const wapiRes = await fetch(`${SUPABASE_URL}/functions/v1/wapi-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ANON}`,
          apikey: ANON,
        },
        body: JSON.stringify({
          action: "send-text",
          phone,
          message,
          user_id: userId,
          event_key: "password_reset_code",
        }),
      });
      const wapiText = await wapiRes.text();
      console.log("[request-password-reset] wapi-send status:", wapiRes.status, "body:", wapiText.slice(0, 300));
    } catch (e) {
      console.error("wapi-send failed:", e);
    }

    return genericOk();
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});