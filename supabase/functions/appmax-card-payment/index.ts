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

// Sandbox by default. Set APPMAX_API_BASE to the production host after approval.
const API_BASE = (Deno.env.get('APPMAX_API_BASE') || 'https://homolog.sandboxappmax.com.br').replace(/\/+$/, '')

let cachedToken: { value: string; expiresAt: number } | null = null

async function getAppmaxToken(): Promise<string> {
  const direct = Deno.env.get('APPMAX_ACCESS_TOKEN')
  if (direct) return direct

  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value

  const clientId = Deno.env.get('APPMAX_SANDBOX_CLIENT_ID')
  const clientSecret = Deno.env.get('APPMAX_SANDBOX_CLIENT_SECRET')
  if (!clientId || !clientSecret) throw new Error('Credenciais Appmax não configuradas')

  const res = await fetch(`${API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  const data = await res.json().catch(() => ({}))
  const token = data?.access_token || data?.data?.access_token
  if (!res.ok || !token) {
    console.error('[appmax-card-payment] token error', res.status)
    throw new Error('Falha ao autenticar na Appmax')
  }
  const ttl = Number(data?.expires_in || 3000) * 1000
  cachedToken = { value: token, expiresAt: Date.now() + ttl }
  return token
}

async function appmaxPost(path: string, token: string, payload: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/api/v3/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ 'access-token': token, ...payload }),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

const onlyDigits = (v: unknown) => String(v ?? '').replace(/\D/g, '')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // ---- Auth ----
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Não autorizado' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace('Bearer ', ''),
    )
    if (claimsError || !claimsData?.claims?.sub) return json({ error: 'Token inválido' }, 401)
    const userId = String(claimsData.claims.sub)
    const userEmail = String(claimsData.claims.email || '')

    // ---- Input validation ----
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return json({ error: 'Requisição inválida' }, 400)

    const amount = Number((body as any).amount)
    const orderId: string | null = (body as any).order_id || null
    const installments = Math.min(Math.max(Number((body as any).installments || 1), 1), 12)
    const card = (body as any).card || {}

    if (!Number.isFinite(amount) || amount < 1) return json({ error: 'Valor mínimo: R$ 1,00' }, 400)
    if (orderId && !/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: 'Pedido inválido' }, 400)

    const cardNumber = onlyDigits(card.number)
    const cardCvv = onlyDigits(card.cvv)
    const cardMonth = onlyDigits(card.month)
    const cardYear = onlyDigits(card.year)
    const cardName = String(card.name || '').trim()
    const docNumber = onlyDigits((body as any).cpf)
    const phone = onlyDigits((body as any).phone)

    if (cardNumber.length < 13 || cardNumber.length > 19) return json({ error: 'Número do cartão inválido' }, 400)
    if (cardCvv.length < 3 || cardCvv.length > 4) return json({ error: 'CVV inválido' }, 400)
    if (cardMonth.length !== 2 || Number(cardMonth) < 1 || Number(cardMonth) > 12) return json({ error: 'Mês de validade inválido' }, 400)
    if (cardYear.length !== 4) return json({ error: 'Ano de validade inválido' }, 400)
    if (cardName.length < 3 || cardName.length > 60) return json({ error: 'Nome no cartão inválido' }, 400)
    if (docNumber.length !== 11) return json({ error: 'CPF inválido' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: profile } = await admin
      .from('profiles')
      .select('card_payment_enabled, full_name, phone')
      .eq('user_id', userId)
      .maybeSingle()

    if (!profile?.card_payment_enabled) {
      return json({ error: 'Pagamento via cartão não habilitado para sua conta' }, 403)
    }

    // Order must belong to the caller
    if (orderId) {
      const { data: order } = await admin
        .from('orders').select('id, user_id').eq('id', orderId).maybeSingle()
      if (!order || order.user_id !== userId) return json({ error: 'Pedido não encontrado' }, 404)
    }

    // ---- Local payment record ----
    const code = `APPMAX-${Date.now()}`
    const { data: payment, error: paymentError } = await admin
      .from('payments')
      .insert({
        user_id: userId,
        amount,
        code,
        gateway: 'appmax',
        status: 'pending',
        order_id: orderId,
        metadata: { type: orderId ? 'order_payment' : 'wallet_recharge', method: 'card', gateway: 'appmax' },
      })
      .select('id')
      .single()

    if (paymentError || !payment) {
      console.error('[appmax-card-payment] payment insert error', paymentError?.message)
      return json({ error: 'Erro ao criar pagamento' }, 500)
    }

    // ---- Appmax flow: customer -> order -> credit card ----
    const token = await getAppmaxToken()
    const fullName = (profile?.full_name || cardName).trim()
    const firstName = fullName.split(' ')[0] || 'Cliente'
    const lastName = fullName.split(' ').slice(1).join(' ') || 'FBFlix'
    const telephone = phone || onlyDigits(profile?.phone) || '11999999999'

    const customerRes = await appmaxPost('customer', token, {
      firstname: firstName,
      lastname: lastName,
      email: userEmail || `cliente-${userId.slice(0, 8)}@fbflix.com.br`,
      telephone,
      document_number: docNumber,
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0',
    })
    const customerId = customerRes.data?.data?.id || customerRes.data?.id
    if (!customerRes.ok || !customerId) {
      console.error('[appmax-card-payment] customer error', customerRes.status, JSON.stringify(customerRes.data))
      await admin.from('payments').update({ status: 'failed' }).eq('id', payment.id)
      return json({ error: 'Não foi possível iniciar o pagamento' }, 502)
    }

    const orderRes = await appmaxPost('order', token, {
      customer_id: customerId,
      products: [
        {
          sku: orderId ? `ORDER-${orderId.slice(0, 8)}` : 'WALLET',
          name: orderId ? 'Pedido FBFlix' : 'Recarga de saldo',
          qty: 1,
          price: amount,
          digital_product: 1,
        },
      ],
      total: amount,
      shipping: 0,
      discount: 0,
      external_reference: payment.id,
    })
    const appmaxOrderId = orderRes.data?.data?.id || orderRes.data?.id
    if (!orderRes.ok || !appmaxOrderId) {
      console.error('[appmax-card-payment] order error', orderRes.status, JSON.stringify(orderRes.data))
      await admin.from('payments').update({ status: 'failed' }).eq('id', payment.id)
      return json({ error: 'Não foi possível iniciar o pagamento' }, 502)
    }

    const payRes = await appmaxPost('payment/credit-card', token, {
      cart: { order_id: appmaxOrderId },
      customer: { customer_id: customerId },
      payment: {
        CreditCard: {
          number: cardNumber,
          cvv: cardCvv,
          month: Number(cardMonth),
          year: Number(cardYear),
          document_number: docNumber,
          name: cardName,
          installments,
          soft_descriptor: 'FBFLIX',
        },
      },
    })

    const approved = payRes.ok && (payRes.data?.success === true || payRes.data?.data?.status === 'aprovado')
    const gatewayMessage: string =
      payRes.data?.text || payRes.data?.message || payRes.data?.data?.status || 'Pagamento recusado'

    await admin.from('payments').update({
      status: approved ? 'completed' : 'failed',
      gateway_reference: String(appmaxOrderId),
      metadata: {
        type: orderId ? 'order_payment' : 'wallet_recharge',
        method: 'card',
        gateway: 'appmax',
        appmax_order_id: String(appmaxOrderId),
        appmax_customer_id: String(customerId),
        appmax_message: gatewayMessage,
        installments,
      },
    }).eq('id', payment.id)

    if (!approved) {
      console.error('[appmax-card-payment] payment refused', payRes.status)
      return json({ error: gatewayMessage, payment_id: payment.id, status: 'refused' }, 200)
    }

    // Fulfillment is handled by appmax-webhook (OrderPaid / OrderApproved).
    return json({ payment_id: payment.id, appmax_order_id: String(appmaxOrderId), status: 'approved' })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('[appmax-card-payment] error:', msg)
    return json({ error: 'Erro ao processar pagamento' }, 500)
  }
})
