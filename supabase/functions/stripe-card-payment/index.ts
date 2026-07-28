import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const STRIPE_API = 'https://api.stripe.com/v1'

function form(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    sp.append(k, String(v))
  }
  return sp.toString()
}

async function stripeFetch(secret: string, path: string, body?: string) {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const secret = (Deno.env.get('STRIPE_SECRET_KEY') || '').trim()
    if (!secret) return json({ error: 'STRIPE_SECRET_KEY não configurada' }, 500)

    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Não autorizado' }, 401)

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (authError || !authData?.user?.id) return json({ error: 'Token inválido' }, 401)
    const userId = authData.user.id

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const body = await req.json().catch(() => ({}))
    const action = String(body.action || 'create_intent')

    // Vincula o pedido ao pagamento depois que o pedido é criado no checkout
    if (action === 'attach_order') {
      const paymentId = String(body.payment_id || '')
      const orderId = String(body.order_id || '')
      if (!paymentId || !orderId) return json({ error: 'payment_id e order_id obrigatórios' }, 400)

      const { data: payment } = await admin
        .from('payments')
        .select('id, user_id, gateway_reference, metadata')
        .eq('id', paymentId)
        .maybeSingle()

      if (!payment || payment.user_id !== userId) return json({ error: 'Pagamento não encontrado' }, 404)

      await admin.from('payments').update({ order_id: orderId }).eq('id', paymentId)

      if (payment.gateway_reference) {
        await stripeFetch(
          secret,
          `/payment_intents/${payment.gateway_reference}`,
          form({ 'metadata[order_id]': orderId }),
        )
      }
      return json({ success: true })
    }

    if (action === 'status') {
      const paymentId = String(body.payment_id || '')
      const { data: payment } = await admin
        .from('payments')
        .select('id, user_id, status, gateway_reference')
        .eq('id', paymentId)
        .maybeSingle()
      if (!payment || payment.user_id !== userId) return json({ error: 'Pagamento não encontrado' }, 404)

      let stripeStatus: string | null = null
      if (payment.gateway_reference) {
        const pi = await stripeFetch(secret, `/payment_intents/${payment.gateway_reference}`)
        stripeStatus = pi.data?.status || null
        if (stripeStatus === 'succeeded' && payment.status !== 'completed') {
          await admin.from('payments').update({ status: 'completed' }).eq('id', payment.id)
        }
      }
      return json({ status: payment.status, stripe_status: stripeStatus })
    }

    // create_intent
    const amount = Number(body.amount)
    if (!amount || amount < 5) return json({ error: 'Valor mínimo para cartão: R$ 5,00' }, 400)

    const { data: profile } = await admin
      .from('profiles')
      .select('card_payment_enabled, full_name, cpf, phone, stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!profile?.card_payment_enabled) {
      return json({ error: 'Pagamento via cartão não habilitado para sua conta' }, 403)
    }

    const { data: userInfo } = await admin.auth.admin.getUserById(userId)
    const email = userInfo?.user?.email || `cliente-${userId.slice(0, 8)}@fbflix.com.br`

    // Cliente Stripe (reaproveitado para cobranças recorrentes futuras)
    let customerId = (profile as any)?.stripe_customer_id as string | null
    if (!customerId) {
      const created = await stripeFetch(
        secret,
        '/customers',
        form({
          email,
          name: profile?.full_name || undefined,
          phone: (profile as any)?.phone || undefined,
          'metadata[user_id]': userId,
          'metadata[cpf]': (profile?.cpf || '').replace(/\D/g, '') || undefined,
        }),
      )
      if (!created.ok) {
        console.error('[stripe-card-payment] customer error', created.data)
        return json({ error: created.data?.error?.message || 'Erro ao criar cliente na Stripe' }, 502)
      }
      customerId = created.data.id
      await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('user_id', userId)
    }

    const code = `STRIPE-${Date.now()}`
    const { data: payment, error: paymentError } = await admin
      .from('payments')
      .insert({
        user_id: userId,
        amount,
        code,
        gateway: 'stripe',
        status: 'pending',
        order_id: body.order_id || null,
        metadata: { method: 'card', type: body.order_id ? 'order_payment' : 'wallet_recharge' },
      })
      .select('id')
      .single()

    if (paymentError || !payment) {
      console.error('[stripe-card-payment] payment insert error', paymentError)
      return json({ error: 'Erro ao registrar pagamento' }, 500)
    }

    const isSubscription = !!body.subscription
    const intent = await stripeFetch(
      secret,
      '/payment_intents',
      form({
        amount: Math.round(amount * 100),
        currency: 'brl',
        customer: customerId!,
        description: body.description || `FBFLIX - ${code}`,
        'payment_method_types[0]': 'card',
        // salva o cartão para renovações automáticas de assinatura
        setup_future_usage: isSubscription ? 'off_session' : undefined,
        'metadata[user_id]': userId,
        'metadata[payment_id]': payment.id,
        'metadata[order_id]': body.order_id || '',
        'metadata[subscription]': isSubscription ? 'true' : 'false',
      }),
    )

    if (!intent.ok) {
      console.error('[stripe-card-payment] intent error', intent.data)
      await admin.from('payments').update({ status: 'failed' }).eq('id', payment.id)
      return json({ error: intent.data?.error?.message || 'Erro ao iniciar pagamento na Stripe' }, 502)
    }

    await admin
      .from('payments')
      .update({ gateway_reference: intent.data.id })
      .eq('id', payment.id)

    return json({
      payment_id: payment.id,
      client_secret: intent.data.client_secret,
      publishable_key: (Deno.env.get('STRIPE_PUBLISHABLE_KEY') || '').trim() || null,
    })
  } catch (err) {
    console.error('[stripe-card-payment] error', err)
    return json({ error: err instanceof Error ? err.message : 'Erro desconhecido' }, 500)
  }
})