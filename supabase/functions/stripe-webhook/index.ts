import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Verificação da assinatura do webhook (HMAC SHA-256, esquema oficial da Stripe)
async function verifySignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const [k, ...rest] = p.split('=')
      return [k.trim(), rest.join('=')]
    }),
  ) as Record<string, string>

  const timestamp = parts['t']
  const signature = parts['v1']
  if (!timestamp || !signature) return false

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`))
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  if (expected.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const webhookSecret = (Deno.env.get('STRIPE_WEBHOOK_SECRET') || '').trim()
  const payload = await req.text()
  const signature = req.headers.get('stripe-signature') || ''

  if (webhookSecret) {
    const valid = await verifySignature(payload, signature, webhookSecret)
    if (!valid) {
      console.error('[stripe-webhook] assinatura inválida')
      return new Response('invalid signature', { status: 400, headers: corsHeaders })
    }
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const event = JSON.parse(payload)
    const type = String(event?.type || '')
    const object = event?.data?.object || {}
    console.log('[stripe-webhook] evento', type, object?.id)

    if (type === 'payment_intent.succeeded') {
      const paymentId = object?.metadata?.payment_id
      const orderId = object?.metadata?.order_id

      if (paymentId) {
        await admin.from('payments').update({ status: 'completed' }).eq('id', paymentId)
      }

      if (orderId) {
        const { data: order } = await admin
          .from('orders')
          .select('id, status')
          .eq('id', orderId)
          .maybeSingle()

        if (order && !['completed', 'refunded', 'cancelled'].includes(String(order.status))) {
          const { data: items } = await admin
            .from('order_items')
            .select('id, product_id, delivery_data')
            .eq('order_id', orderId)

          for (const item of items || []) {
            if (!item.product_id) continue
            const dd = item.delivery_data && typeof item.delivery_data === 'object'
              ? (item.delivery_data as Record<string, unknown>)
              : null
            if (dd?.type || dd?.bmLinks || dd?.linkPerfil || dd?.idPerfil) continue

            const { data: prod } = await admin
              .from('products')
              .select('icon_type')
              .eq('id', item.product_id)
              .maybeSingle()
            if (prod?.icon_type === 'proxy') continue

            await admin.rpc('fulfill_order_item', {
              p_order_item_id: item.id,
              p_product_id: item.product_id,
            })
          }

          await admin.from('orders').update({ status: 'completed' }).eq('id', orderId)
        }
      }
    }

    if (type === 'payment_intent.payment_failed') {
      const paymentId = object?.metadata?.payment_id
      const orderId = object?.metadata?.order_id
      if (paymentId) await admin.from('payments').update({ status: 'failed' }).eq('id', paymentId)
      if (orderId) await admin.from('orders').update({ status: 'payment_failed' }).eq('id', orderId)
    }

    if (type === 'charge.refunded') {
      const pi = object?.payment_intent
      if (pi) await admin.from('payments').update({ status: 'refunded' }).eq('gateway_reference', pi)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[stripe-webhook] erro', err)
    return new Response('error', { status: 500, headers: corsHeaders })
  }
})