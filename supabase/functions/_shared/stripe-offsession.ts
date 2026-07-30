// Cobrança automática (off-session) no cartão salvo na Stripe.
// Usado apenas pelas renovações recorrentes de Safe BM e Scale Pro.

const STRIPE_API = "https://api.stripe.com/v1";

function form(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.append(k, String(v));
  }
  return sp.toString();
}

async function stripeFetch(secret: string, path: string, body?: string) {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export interface OffSessionResult {
  ok: boolean;
  paymentIntentId?: string;
  paymentId?: string;
  error?: string;
  reason?: "no_key" | "no_customer" | "no_card" | "declined" | "error";
}

/**
 * Cobra o cartão salvo do cliente sem interação (off-session).
 * Retorna ok:true somente quando o PaymentIntent é confirmado (succeeded).
 */
export async function chargeSavedCard(
  admin: any,
  opts: {
    userId: string;
    amount: number;
    description: string;
    kind: "safe_bm_renewal" | "scale_pro_renewal";
    referenceId?: string;
  },
): Promise<OffSessionResult> {
  const secret = (Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
  if (!secret) return { ok: false, reason: "no_key", error: "STRIPE_SECRET_KEY não configurada" };

  const amount = Math.round(Number(opts.amount) * 100);
  if (!amount || amount < 100) return { ok: false, reason: "error", error: "Valor inválido para cartão" };

  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id, card_payment_enabled")
    .eq("user_id", opts.userId)
    .maybeSingle();

  const customerId = profile?.stripe_customer_id as string | null;
  if (!customerId) return { ok: false, reason: "no_customer", error: "Cliente sem cartão salvo" };

  // Descobre o cartão padrão do cliente
  const customer = await stripeFetch(secret, `/customers/${customerId}`);
  let paymentMethod: string | undefined =
    customer.data?.invoice_settings?.default_payment_method || undefined;

  if (!paymentMethod) {
    const pms = await stripeFetch(secret, `/payment_methods?customer=${customerId}&type=card&limit=1`);
    paymentMethod = pms.data?.data?.[0]?.id;
  }
  if (!paymentMethod) return { ok: false, reason: "no_card", error: "Nenhum cartão salvo" };

  const code = `STRIPE-AUTO-${Date.now()}`;
  const { data: payment } = await admin
    .from("payments")
    .insert({
      user_id: opts.userId,
      amount: Number(opts.amount),
      code,
      gateway: "stripe",
      status: "pending",
      metadata: { method: "card", type: opts.kind, auto_renewal: true, reference_id: opts.referenceId || null },
    })
    .select("id")
    .single();

  const intent = await stripeFetch(
    secret,
    "/payment_intents",
    form({
      amount,
      currency: "brl",
      customer: customerId,
      payment_method: paymentMethod,
      off_session: "true",
      confirm: "true",
      description: opts.description,
      "payment_method_types[0]": "card",
      "metadata[user_id]": opts.userId,
      "metadata[payment_id]": payment?.id,
      "metadata[kind]": opts.kind,
      "metadata[reference_id]": opts.referenceId || "",
    }),
  );

  const status = intent.data?.status;
  if (!intent.ok || status !== "succeeded") {
    if (payment?.id) {
      await admin
        .from("payments")
        .update({ status: "failed", gateway_reference: intent.data?.id || null })
        .eq("id", payment.id);
    }
    return {
      ok: false,
      reason: "declined",
      paymentId: payment?.id,
      error: intent.data?.error?.message || `Pagamento não autorizado (${status || "erro"})`,
    };
  }

  if (payment?.id) {
    await admin
      .from("payments")
      .update({ status: "completed", gateway_reference: intent.data.id })
      .eq("id", payment.id);
  }

  return { ok: true, paymentIntentId: intent.data.id, paymentId: payment?.id };
}