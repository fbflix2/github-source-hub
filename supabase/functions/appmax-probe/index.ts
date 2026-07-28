import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Diagnostico: descobre em qual host o access-token da Appmax e valido.
const TOKENS: Record<string, string | undefined> = {
  APPMAX_SANDBOX_ACCESS_TOKEN: Deno.env.get('APPMAX_SANDBOX_ACCESS_TOKEN') || undefined,
  APPMAX_ACCESS_TOKEN: Deno.env.get('APPMAX_ACCESS_TOKEN') || undefined,
  APPMAX_PRODUCTION_ACCESS_TOKEN: Deno.env.get('APPMAX_PRODUCTION_ACCESS_TOKEN') || undefined,
}

const HOSTS = [
  'https://homolog.sandboxappmax.com.br',
  'https://api.sandboxappmax.com.br',
  'https://admin.sandboxappmax.com.br',
  'https://admin.appmax.com.br',
  'https://api.appmax.com.br',
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const results: unknown[] = []
  for (const [name, token] of Object.entries(TOKENS)) {
    if (!token) continue
    for (const host of HOSTS) {
      const url = `${host}/api/v3/customer`
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            'access-token': token.trim(),
            firstname: 'Teste',
            lastname: 'Probe',
            email: 'probe@example.com',
            telephone: '11999999999',
          }),
        })
        const text = await r.text()
        results.push({ secret: name, host, status: r.status, body: text.slice(0, 300) })
      } catch (e) {
        results.push({ secret: name, host, error: e instanceof Error ? e.message : 'fetch error' })
      }
    }
  }

  return new Response(
    JSON.stringify({ tokens_present: Object.keys(TOKENS).filter((k) => !!TOKENS[k]), results }, null, 2),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
