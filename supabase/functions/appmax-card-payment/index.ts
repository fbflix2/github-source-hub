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

// Appmax hosts:
// - API atual/AppStore: https://api.appmax.com.br + OAuth/Bearer
// - API legada por loja: https://admin.appmax.com.br ou <loja>.sandboxappmax.com.br + access-token no body
const SANDBOX_BASE = 'https://breakingcode.sandboxappmax.com.br'
const PROD_BASE = 'https://admin.appmax.com.br'
const SANDBOX_API_BASE = 'https://api.sandboxappmax.com.br'
const PROD_API_BASE = 'https://api.appmax.com.br'

// OAuth2 (client_credentials) — https://appmax.readme.io/reference/instalacao-do-aplicativo
const SANDBOX_AUTH = 'https://auth.sandboxappmax.com.br/oauth2/token'
const PROD_AUTH = 'https://auth.appmax.com.br/oauth2/token'

function isProd(): boolean {
  const env = (Deno.env.get('APPMAX_ENV') || '').toLowerCase()
  return env === 'production' || env === 'prod'
}

function normalizeLegacyBase(raw: string | null | undefined): string {
  return String(raw || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api(\/v\d+)?$/, '')
}

function getLegacyApiBases(): string[] {
  const explicit = normalizeLegacyBase(Deno.env.get('APPMAX_API_BASE'))
  const fallback = isProd() ? PROD_BASE : SANDBOX_BASE

  // APPMAX_API_BASE deve ser respeitado quando configurado, porque a API v3
  // legada da Appmax pode ser amarrada ao host específico da loja/ambiente.
  // Em produção também tentamos o host sandbox por último apenas para detectar
  // token de sandbox salvo por engano e devolver uma mensagem clara, sem seguir
  // com cobrança real no ambiente errado.
  return Array.from(new Set([explicit, fallback, SANDBOX_BASE].filter(Boolean)))
}

const API_BASES = getLegacyApiBases()
const API_BASE = API_BASES[0]

function resolveModernApiBase(): string {
  return isProd() ? PROD_API_BASE : SANDBOX_API_BASE
}

const MODERN_API_BASE = resolveModernApiBase()

// Appmax API v3 does NOT use OAuth. Every request carries the API token
// as the `access-token` field in the JSON body. Client ID/Secret are app
// installation credentials and are not accepted by the sales/payment API.
// Merchant token (API v3 sales) — opcional, enviado no corpo como `access-token`
function getMerchantToken(): string | null {
  if (isProd()) {
    return trimSecret(
      Deno.env.get('APPMAX_PRODUCTION_ACCESS_TOKEN') ||
      Deno.env.get('APPMAX_ACCESS_TOKEN') ||
      null
    )
  }
  return trimSecret(
    Deno.env.get('APPMAX_SANDBOX_ACCESS_TOKEN') ||
    Deno.env.get('APPMAX_ACCESS_TOKEN') ||
    null
  )
}

function trimSecret(value: string | null | undefined): string | null {
  const cleaned = String(value || '').trim()
  return cleaned || null
}

// OAuth2 client_credentials: gera o Bearer token do aplicativo
let cachedBearer: { token: string; expiresAt: number } | null = null

async function getAppBearerToken(): Promise<string | null> {
  if (cachedBearer && cachedBearer.expiresAt > Date.now() + 30_000) return cachedBearer.token

  const prod = isProd()
  // Credenciais do MERCHANT (loja instalada) têm prioridade — são as aceitas
  // pela API transacional. As credenciais do aplicativo servem só p/ instalação.
  const clientId = prod
    ? Deno.env.get('APPMAX_MERCHANT_CLIENT_ID') ||
      Deno.env.get('APPMAX_PRODUCTION_MERCHANT_CLIENT_ID') ||
      Deno.env.get('APPMAX_CLIENT_ID')
    : Deno.env.get('APPMAX_SANDBOX_MERCHANT_CLIENT_ID') ||
      Deno.env.get('APPMAX_MERCHANT_CLIENT_ID') ||
      Deno.env.get('APPMAX_SANDBOX_CLIENT_ID') ||
      Deno.env.get('APPMAX_CLIENT_ID')
  const clientSecret = prod
    ? Deno.env.get('APPMAX_MERCHANT_CLIENT_SECRET') ||
      Deno.env.get('APPMAX_PRODUCTION_MERCHANT_CLIENT_SECRET') ||
      Deno.env.get('APPMAX_CLIENT_SECRET')
    : Deno.env.get('APPMAX_SANDBOX_MERCHANT_CLIENT_SECRET') ||
      Deno.env.get('APPMAX_MERCHANT_CLIENT_SECRET') ||
      Deno.env.get('APPMAX_SANDBOX_CLIENT_SECRET') ||
      Deno.env.get('APPMAX_CLIENT_SECRET')

  if (!clientId || !clientSecret) return null

  // Tenta o host do ambiente e, em caso de invalid_client, o outro host
  const urls = prod ? [PROD_AUTH, SANDBOX_AUTH] : [SANDBOX_AUTH, PROD_AUTH]
  for (const url of urls) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })
    const raw = await res.text()
    if (!res.ok) {
      console.error(`[appmax-card-payment] oauth HTTP ${res.status} @ ${url} :: ${raw.slice(0, 500)}`)
      continue
    }
    let data: any = {}
    try { data = JSON.parse(raw) } catch { continue }
    const token = data?.access_token
    if (!token) continue
    cachedBearer = { token, expiresAt: Date.now() + (Number(data.expires_in || 3600) * 1000) }
    console.log(`[appmax-card-payment] oauth token OK @ ${url}`)
    return token
  }
  return null
}

async function appmaxPost(
  base: string,
  path: string,
  auth: { bearer: string | null; merchant: string | null },
  payload: Record<string, unknown>,
) {
  const url = `${base}/api/v3/${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (auth.bearer) headers.Authorization = `Bearer ${auth.bearer}`
  const body: Record<string, unknown> = { ...payload }
  if (auth.merchant) body['access-token'] = auth.merchant
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const raw = await res.text()
  let data: any = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    data = { raw: raw.slice(0, 500) }
  }
  if (!res.ok || data?.success === false) {
    console.error(`[appmax-card-payment] ${path} HTTP ${res.status} @ ${url} :: ${raw.slice(0, 800)}`)
  }
  return { ok: res.ok && data?.success !== false, status: res.status, data }
}

async function appmaxPostV1(
  path: string,
  bearer: string,
  payload: Record<string, unknown>,
) {
  const url = `${MODERN_API_BASE}/v1/${path.replace(/^\/+/, '')}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify(payload),
  })
  const raw = await res.text()
  let data: any = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    data = { raw: raw.slice(0, 500) }
  }
  if (!res.ok || data?.success === false) {
    console.error(`[appmax-card-payment] v1 ${path} HTTP ${res.status} @ ${url} :: ${raw.slice(0, 800)}`)
  }
  return { ok: res.ok && data?.success !== false, status: res.status, data }
}

function cents(value: number): number {
  return Math.round(Number(value || 0) * 100)
}

function extractCustomerIdV1(data: any): string | number | null {
  return data?.data?.customer?.id || data?.data?.id || data?.customer?.id || data?.id || null
}

function extractOrderIdV1(data: any): string | number | null {
  return data?.data?.order?.id || data?.data?.id || data?.order?.id || data?.id || null
}

function looksInvalidToken(status: number, data: any): boolean {
  const text = String(data?.text || data?.message || data?.error?.message || data?.raw || '').toLowerCase()
  return status === 401 || status === 403 || text.includes('invalid access token') || text.includes('unauthorized') || text.includes('invalid token')
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
    const merchant = getMerchantToken()
    // O access-token do painel é a credencial oficial da API v3.
    // Só tentamos OAuth quando ele não existir.
    const bearer = merchant ? null : await getAppBearerToken()
    if (!bearer && !merchant) {
      console.error('[appmax-card-payment] sem credenciais Appmax (client_id/secret ou access-token)')
      return json({ error: 'Gateway de cartão não configurado' }, 500)
    }
    const auth = { bearer, merchant }
    const fullName = (profile?.full_name || cardName).trim()
    const firstName = fullName.split(' ')[0] || 'Cliente'
    const lastName = fullName.split(' ').slice(1).join(' ') || 'FBFlix'
    // Appmax espera telefone BR com 10 ou 11 dígitos (sem DDI)
    let telephone = phone || onlyDigits(profile?.phone) || '11999999999'
    if (telephone.startsWith('55') && telephone.length > 11) telephone = telephone.slice(2)
    if (telephone.length < 10 || telephone.length > 11) telephone = '11999999999'

    console.log(`[appmax-card-payment] bases=${API_BASES.join(',')} customer=${firstName} tel=${telephone.length}d env=${isProd() ? 'prod' : 'sandbox'}`)

    // O endpoint /customer NÃO recebe CPF — ele vai apenas no payload do cartão
    const customerPayload = {
      firstname: firstName,
      lastname: lastName,
      email: userEmail || `cliente-${userId.slice(0, 8)}@fbflix.com.br`,
      telephone,
      document_number: docNumber,
      postcode: '01310100',
      address_street: 'Avenida Paulista',
      address_street_number: '1000',
      address_street_complement: '',
      address_street_district: 'Bela Vista',
      address_city: 'Sao Paulo',
      address_state: 'SP',
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0',
    }

    let selectedBase = API_BASE
    let customerRes: any = null
    let customerId: string | number | null = null
    for (const base of API_BASES) {
      customerRes = await appmaxPost(base, 'customer', auth, customerPayload)
      customerId = customerRes.data?.data?.id || customerRes.data?.id || null
      if (customerRes.ok && customerId) {
        selectedBase = base
        break
      }
      // Se o erro não for de token/host, não adianta tentar outro host.
      if (!looksInvalidToken(customerRes.status, customerRes.data)) break
    }

    if (!customerRes.ok || !customerId) {
      console.error('[appmax-card-payment] customer error', customerRes.status, JSON.stringify(customerRes.data))
      await admin.from('payments').update({ status: 'failed' }).eq('id', payment.id)
      const invalidToken = looksInvalidToken(customerRes.status, customerRes.data)
      return json({
        error: invalidToken
          ? 'Appmax: token não pertence ao ambiente/loja configurado. Verifique se a chave é da loja de produção correta.'
          : `Appmax: ${customerRes.data?.text || 'não foi possível iniciar o pagamento'}`,
      }, 502)
    }

    if (isProd() && /sandboxappmax\.com\.br/i.test(selectedBase)) {
      console.error('[appmax-card-payment] production env with sandbox-only Appmax token/base', selectedBase)
      await admin.from('payments').update({ status: 'failed' }).eq('id', payment.id)
      return json({
        error: 'Appmax: a chave salva é válida somente no sandbox. Para cartão real, a Appmax precisa liberar/fornecer a chave da loja em produção.',
      }, 502)
    }

    const orderRes = await appmaxPost(selectedBase, 'order', auth, {
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
      return json({ error: `Appmax: ${orderRes.data?.text || 'não foi possível criar o pedido'}` }, 502)
    }

    const payRes = await appmaxPost(selectedBase, 'payment/credit-card', auth, {
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
