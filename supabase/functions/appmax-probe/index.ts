import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Diagnostico: descobre em qual host/formato o access-token da Appmax e valido.
const TOKENS: Record<string, string | undefined> = {
  APPMAX_SANDBOX_ACCESS_TOKEN: Deno.env.get('APPMAX_SANDBOX_ACCESS_TOKEN') || undefined,
  APPMAX_ACCESS_TOKEN: Deno.env.get('APPMAX_ACCESS_TOKEN') || undefined,
  APPMAX_PRODUCTION_ACCESS_TOKEN: Deno.env.get('APPMAX_PRODUCTION_ACCESS_TOKEN') || undefined,
}

const HOSTS = [
  'https://homolog.sandboxappmax.com.br',
  'https://breakingcode.sandboxappmax.com.br',
  'https://admin.sandboxappmax.com.br',
  'https://admin.appmax.com.br',
]

const PATHS = ['/api/v3/customer', '/api/v1/customer']

function shape(t: string) {
  return {
    length: t.length,
    blocks: t.split('-').map((b) => b.length).join('-'),
    prefix: t.slice(0, 2),
    has_space: /\s/.test(t),
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const results: unknown[] = []
  const shapes: Record<string, unknown> = {}

  for (const [name, raw] of Object.entries(TOKENS)) {
    if (!raw) continue
    const token = raw.trim()
    shapes[name] = shape(token)

    for (const host of HOSTS) {
      for (const path of PATHS) {
        for (const mode of ['body', 'bearer'] as const) {
          const url = `${host}${path}`
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          }
          const payload: Record<string, unknown> = {
            firstname: 'Teste',
            lastname: 'Probe',
            email: 'probe@example.com',
            telephone: '11999999999',
          }
          if (mode === 'body') payload['access-token'] = token
          else headers['Authorization'] = `Bearer ${token}`

          try {
            const r = await fetch(url, {
              method: 'POST',
              headers,
              body: JSON.stringify(payload),
            })
            const text = await r.text()
            results.push({ secret: name, host, path, mode, status: r.status, body: text.slice(0, 200) })
          } catch (e) {
            results.push({ secret: name, host, path, mode, error: e instanceof Error ? e.message : 'fetch error' })
          }
        }
      }
    }
  }

  return new Response(
    JSON.stringify({ shapes, results }, null, 2),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
