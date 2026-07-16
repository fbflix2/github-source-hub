const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const appId = Deno.env.get('OPENPIX_APP_ID');
    if (!appId) {
      return new Response(JSON.stringify({ error: 'OPENPIX_APP_ID não configurado' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const url = new URL(req.url);
    const start = body.start || url.searchParams.get('start');
    const end = body.end || url.searchParams.get('end');
    if (!start || !end) {
      return new Response(JSON.stringify({ error: 'start e end são obrigatórios (ISO)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Pagina por toda a API até esgotar (limit 100 por página).
    const all: any[] = [];
    let skip = 0;
    const limit = 100;
    let safety = 0;
    while (safety++ < 200) {
      const res = await fetch(
        `https://api.openpix.com.br/api/v1/charge?status=COMPLETED&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&limit=${limit}&skip=${skip}`,
        { headers: { Authorization: appId } }
      );
      const data = await res.json();
      const items = data.charges || [];
      all.push(...items);
      if (items.length < limit) break;
      skip += limit;
    }

    const totalCents = all.reduce((s, c) => s + (c.value || 0), 0);
    const feesCents = all.reduce((s, c) => s + (c.fee || 0), 0);

    return new Response(
      JSON.stringify({
        count: all.length,
        total: totalCents / 100,
        fees: feesCents / 100,
        net: (totalCents - feesCents) / 100,
        charges: all.map((c: any) => ({
          value: (c.value || 0) / 100,
          fee: (c.fee || 0) / 100,
          paidAt: c.paidAt,
          createdAt: c.createdAt,
          comment: c.comment,
          customer: c.customer?.name,
          correlationID: c.correlationID,
          identifier: c.identifier,
          transactionID: c.transactionID,
          endToEndId: c.endToEndId,
          status: c.status,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});