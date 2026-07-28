import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SAFE_BM_PRODUCT_ID = 'e5118c63-ed52-4f4e-8983-f44c1ba0d17b'

const APPROVED_EVENTS = [
  'OrderPaid',
  'OrderApproved',
  'OrderPaidByPix',
  'PaymentApproved',
  'order.paid',
  'order.approved',
]

const FAILED_EVENTS = [
  'OrderRefund',
  'OrderRefused',
  'OrderBilletOverdue',
  'PaymentRefused',
  'order.refused',
  'order.refunded',
]

async function fulfillMissingStockItems(admin: any, orderId: string) {
  const { data: orderItems } = await admin
    .from('order_items')
    .select('id, product_id, delivery_data')
    .eq('order_id', orderId)

  let fulfilled = 0

  for (const oi of orderItems || []) {
    if (!oi.product_id || oi.product_id === SAFE_BM_PRODUCT_ID) continue
    const dd = oi.delivery_data && typeof oi.delivery_data === 'object' ? oi.delivery_data : null
    if (dd?.type || dd?.bmLinks || dd?.linkPerfil || dd?.idPerfil) continue

    const { data: product } = await admin
      .from('products').select('icon_type').eq('id', oi.product_id).maybeSingle()
    if (product?.icon_type === 'proxy') continue

    const { count } = await admin
      .from('stock_items').select('id', { count: 'exact', head: true }).eq('order_item_id', oi.id)
    if ((count || 0) > 0) continue

    const { data: result, error } = await admin.rpc('fulfill_order_item', {
      p_order_item_id: oi.id,
      p_product_id: oi.product_id,
    })
    if (error) {
      console.error(`[appmax-webhook] fulfill error ${oi.id}:`, error.message)
      continue
    }
    if (result?.success && Number(result?.linked_count || 0) > 0) fulfilled += 1
  }

  if (fulfilled > 0) {
    await admin.from('orders').update({ status: 'completed' }).eq('id', orderId)
  }
  return fulfilled
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const raw = await req.text()
    let payload: any
    try {
      payload = JSON.parse(raw)
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Optional shared-secret validation (set APPMAX_WEBHOOK_SECRET to enable)
    const expectedSecret = Deno.env.get('APPMAX_WEBHOOK_SECRET')
    if (expectedSecret) {
      const url = new URL(req.url)
      const provided =
        req.headers.get('x-appmax-token') ||
        req.headers.get('x-webhook-secret') ||
        url.searchParams.get('secret') ||
        payload?.access_token
      if (provided !== expectedSecret) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const event: string = String(payload?.event || payload?.type || '')
    const data = payload?.data ?? payload
    // external_reference / bundle carries our internal payment id
    const paymentRef: string | null =
      data?.external_reference || data?.bundle || data?.upsell_id || null
    const appmaxOrderId = data?.id ? String(data.id) : null

    console.log('[appmax-webhook] event:', event, 'ref:', paymentRef, 'appmax id:', appmaxOrderId)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Always keep an audit trail of raw events
    await admin.from('webhook_logs').insert({
      source: 'appmax',
      event,
      payload,
    }).then(() => {}, () => {})

    if (!paymentRef) {
      return new Response(JSON.stringify({ received: true, matched: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: payment } = await admin
      .from('payments')
      .select('id, order_id, status, metadata')
      .eq('id', paymentRef)
      .maybeSingle()

    if (!payment) {
      return new Response(JSON.stringify({ received: true, matched: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const isApproved = APPROVED_EVENTS.includes(event)
    const isFailed = FAILED_EVENTS.includes(event)

    if (!isApproved && !isFailed) {
      return new Response(JSON.stringify({ received: true, ignored: event }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await admin.from('payments').update({
      status: isApproved ? 'completed' : 'failed',
      gateway_reference: appmaxOrderId || undefined,
      metadata: {
        ...(payment.metadata && typeof payment.metadata === 'object' ? payment.metadata : {}),
        gateway: 'appmax',
        appmax_event: event,
        appmax_order_id: appmaxOrderId,
      },
    }).eq('id', payment.id)

    if (isApproved && payment.order_id) {
      const fulfilled = await fulfillMissingStockItems(admin, payment.order_id)
      console.log(`[appmax-webhook] fulfilled ${fulfilled} item(s) for order ${payment.order_id}`)
    }

    if (isFailed && payment.order_id) {
      await admin.from('orders').update({ status: 'payment_failed' }).eq('id', payment.order_id)
    }

    return new Response(JSON.stringify({ received: true, matched: true, status: isApproved ? 'approved' : 'failed' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('[appmax-webhook] error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})