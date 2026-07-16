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

    // Saldo da conta
    const accountRes = await fetch('https://api.openpix.com.br/api/v1/account/', {
      headers: { Authorization: appId },
    });
    const accountData = await accountRes.json();

    // Recebimentos de hoje (BRT = UTC-3)
    const now = new Date();
    const brtOffsetMs = -3 * 60 * 60 * 1000;
    const brtNow = new Date(now.getTime() + brtOffsetMs);
    const brtStart = new Date(Date.UTC(brtNow.getUTCFullYear(), brtNow.getUTCMonth(), brtNow.getUTCDate(), 0, 0, 0));
    const startUtc = new Date(brtStart.getTime() - brtOffsetMs);
    const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);

    const chargesRes = await fetch(
      `https://api.openpix.com.br/api/v1/charge?status=COMPLETED&start=${startUtc.toISOString()}&end=${endUtc.toISOString()}`,
      { headers: { Authorization: appId } }
    );
    const chargesData = await chargesRes.json();
    const charges = chargesData.charges || [];
    const todayTotalCents = charges.reduce((s: number, c: any) => s + (c.value || 0), 0);
    const todayFeesCents = charges.reduce((s: number, c: any) => s + (c.fee || 0), 0);

    const account = accountData.accounts?.[0] || null;

    return new Response(
      JSON.stringify({
        account: account
          ? {
              accountId: account.accountId,
              officialName: account.officialName,
              tradeName: account.tradeName,
              branch: account.branch,
              account: account.account,
              accountName: account.accountName,
              balance: {
                total: (account.balance?.total || 0) / 100,
                available: (account.balance?.available || 0) / 100,
                blocked: (account.balance?.blocked || 0) / 100,
              },
            }
          : null,
        today: {
          count: charges.length,
          total: todayTotalCents / 100,
          fees: todayFeesCents / 100,
          charges: charges.map((c: any) => ({
            value: (c.value || 0) / 100,
            fee: (c.fee || 0) / 100,
            paidAt: c.paidAt,
            comment: c.comment,
            customer: c.customer?.name,
            correlationID: c.correlationID,
            identifier: c.identifier,
            transactionID: c.transactionID,
            endToEndId: c.endToEndId,
            status: c.status,
          })),
        },
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