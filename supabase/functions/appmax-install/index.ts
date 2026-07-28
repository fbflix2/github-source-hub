import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const isProd = () => ['production', 'prod'].includes((Deno.env.get('APPMAX_ENV') || '').toLowerCase())

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const prod = isProd()
    const clientId = prod
      ? Deno.env.get('APPMAX_CLIENT_ID') || Deno.env.get('APPMAX_PRODUCTION_CLIENT_ID')
      : Deno.env.get('APPMAX_SANDBOX_CLIENT_ID') || Deno.env.get('APPMAX_CLIENT_ID')
    const clientSecret = prod
      ? Deno.env.get('APPMAX_CLIENT_SECRET') || Deno.env.get('APPMAX_PRODUCTION_CLIENT_SECRET')
      : Deno.env.get('APPMAX_SANDBOX_CLIENT_SECRET') || Deno.env.get('APPMAX_CLIENT_SECRET')

    if (!clientId || !clientSecret) return json({ error: 'Credenciais do aplicativo ausentes' }, 500)

    // 1) token do aplicativo
    const authUrl = prod
      ? 'https://auth.appmax.com.br/oauth2/token'
      : 'https://auth.sandboxappmax.com.br/oauth2/token'
    const tokenRes = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
    })
    const tokenRaw = await tokenRes.text()
    if (!tokenRes.ok) return json({ step: 'oauth', status: tokenRes.status, response: tokenRaw.slice(0, 500) }, 502)
    const appToken = JSON.parse(tokenRaw)?.access_token
    if (!appToken) return json({ step: 'oauth', error: 'sem access_token', response: tokenRaw.slice(0, 500) }, 502)

    // 2) hash de autorização da instalação
    const apiUrl = prod ? 'https://api.appmax.com.br/app/authorize' : 'https://api.sandboxappmax.com.br/app/authorize'
    const body = await req.json().catch(() => ({}))
    const appId =
      (body as any)?.app_id ||
      Deno.env.get('APPMAX_APP_PUBLIC_ID') ||
      Deno.env.get('APPMAX_APP_ID') ||
      clientId
    const externalKey = (body as any)?.external_key || 'fbflix'
    const urlCallback =
      (body as any)?.url_callback ||
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/appmax-install-callback`

    const authorizeRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${appToken}` },
      body: JSON.stringify({ app_id: appId, external_key: externalKey, url_callback: urlCallback }),
    })
    const authorizeRaw = await authorizeRes.text()
    if (!authorizeRes.ok) {
      return json({ step: 'authorize', status: authorizeRes.status, response: authorizeRaw.slice(0, 800) }, 502)
    }
    const hash = JSON.parse(authorizeRaw)?.data?.token
    if (!hash) return json({ step: 'authorize', error: 'sem hash', response: authorizeRaw.slice(0, 800) }, 502)

    const installUrl = prod
      ? `https://admin.appmax.com.br/appstore/integration/${hash}`
      : `https://breakingcode.sandboxappmax.com.br/appstore/integration/${hash}`

    return json({ hash, install_url: installUrl, url_callback: urlCallback })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'erro' }, 500)
  }
})