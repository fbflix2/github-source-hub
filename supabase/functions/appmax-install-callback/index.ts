import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  const query = Object.fromEntries(url.searchParams.entries())
  let body: unknown = null
  try {
    body = await req.json()
  } catch {
    body = null
  }

  // Appmax posts the merchant credentials here after the app is installed.
  console.log('[appmax-install-callback] query:', JSON.stringify(query))
  console.log('[appmax-install-callback] body:', JSON.stringify(body))

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
})