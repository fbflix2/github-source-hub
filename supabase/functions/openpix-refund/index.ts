import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const appId = Deno.env.get('OPENPIX_APP_ID');
    if (!appId) throw new Error('OPENPIX_APP_ID não configurado');

    const { chargeId, correlationID, value, comment, updateOrder, customerPhone, customerName } = await req.json();
    if (!chargeId) throw new Error('chargeId é obrigatório');
    if (!value || value <= 0) throw new Error('value (centavos) é obrigatório');

    // Auth: verifica admin
    const authHeader = req.headers.get('Authorization') || '';
    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: userData } = await supa.auth.getUser(token);
    if (!userData?.user) throw new Error('Não autenticado');
    const { data: roleRow } = await supa
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .in('role', ['admin', 'moderator'])
      .maybeSingle();
    if (!roleRow) throw new Error('Acesso negado');

    const refundCorrelationID = `refund-${chargeId.slice(-12)}-${Date.now()}`;
    const refundRes = await fetch('https://api.openpix.com.br/api/v1/refund', {
      method: 'POST',
      headers: { Authorization: appId, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chargeId,
        correlationID: refundCorrelationID,
        value, // em centavos
        comment: (comment || 'Estorno').slice(0, 140),
      }),
    });
    const refundData = await refundRes.json();
    if (!refundRes.ok) {
      return new Response(
        JSON.stringify({ error: refundData?.error || refundData?.message || 'Falha no estorno', details: refundData }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualiza pedido se solicitado
    let orderUpdated = false;
    let orderTotalCents = 0;
    let waPhone: string | null = customerPhone || null;
    let waName: string | null = customerName || null;
    let orderCode: string | null = null;
    if (updateOrder && correlationID) {
      const { data: pay } = await supa
        .from('payments')
        .select('id, order_id')
        .eq('id', correlationID)
        .maybeSingle();
      if (pay?.order_id) {
        const { data: ord } = await supa
          .from('orders')
          .select('id, code, total, user_id')
          .eq('id', pay.order_id)
          .maybeSingle();
        orderCode = ord?.code || null;
        orderTotalCents = Math.round(Number(ord?.total || 0) * 100);
        if (!waPhone && ord?.user_id) {
          const { data: prof } = await supa
            .from('profiles')
            .select('phone, full_name')
            .eq('user_id', ord.user_id)
            .maybeSingle();
          waPhone = prof?.phone || null;
          waName = waName || prof?.full_name || null;
        }
        await supa
          .from('orders')
          .update({ status: 'refunded', updated_at: new Date().toISOString() })
          .eq('id', pay.order_id);
        await supa
          .from('payments')
          .update({ status: 'refunded' })
          .eq('id', pay.id);
        orderUpdated = true;
      }
    }

    // Envia WhatsApp para o cliente
    let whatsappSent = false;
    if (waPhone) {
      try {
        const reais = (value / 100).toFixed(2).replace('.', ',');
        const isPartial = orderTotalCents > 0 && value < orderTotalCents;
        const firstName = (waName || '').split(' ')[0] || 'Olá';
        const refText = orderCode ? ` do pedido *${orderCode}*` : '';
        const partialLine = isPartial
          ? `Efetuamos um estorno *parcial* no valor de *R$ ${reais}*${refText}.`
          : `Efetuamos o *estorno total* no valor de *R$ ${reais}*${refText}.`;
        const message =
          `Olá, ${firstName}! 👋\n\n` +
          `${partialLine}\n\n` +
          `O valor será devolvido em sua chave PIX de origem em até *1 hora útil*. ` +
          `Caso não receba, entre em contato com nosso suporte.\n\n` +
          `Obrigado!`;
        const waRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/wapi-send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          },
          body: JSON.stringify({ action: 'send-text', phone: waPhone, message }),
        });
        whatsappSent = waRes.ok;
      } catch (e) {
        console.error('wapi-send failed:', e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, refund: refundData?.refund || refundData, orderUpdated, whatsappSent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});