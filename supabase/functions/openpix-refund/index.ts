import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const appId = Deno.env.get('OPENPIX_APP_ID');
    if (!appId) throw new Error('OPENPIX_APP_ID não configurado');

    const { chargeId, correlationID, value, comment, updateOrder } = await req.json();
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
    if (updateOrder && correlationID) {
      const { data: pay } = await supa
        .from('payments')
        .select('id, order_id')
        .eq('id', correlationID)
        .maybeSingle();
      if (pay?.order_id) {
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

    return new Response(
      JSON.stringify({ success: true, refund: refundData?.refund || refundData, orderUpdated }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});