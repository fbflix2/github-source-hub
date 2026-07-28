import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Health check / validation endpoint required by Appmax app installation.
// Must return a dynamic external_id (UUID) on every call — never a fixed value.
Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  return new Response(
    JSON.stringify({
      status: 'ok',
      external_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
  )
})