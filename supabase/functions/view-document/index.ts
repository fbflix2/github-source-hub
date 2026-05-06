 import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
 }
 
 serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response('ok', { headers: corsHeaders })
   }
 
   try {
     const url = new URL(req.url)
     const path = url.searchParams.get('path')
 
     if (!path) {
       return new Response("Caminho não informado", { status: 400 })
     }
 
     const supabaseAdmin = createClient(
       Deno.env.get('SUPABASE_URL') ?? '',
       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
     )
 
     const { data, error } = await supabaseAdmin.storage
       .from('documents')
       .download(path)
 
     if (error || !data) {
       return new Response("Arquivo não encontrado", { status: 404 })
     }
 
     return new Response(data, {
       headers: {
         ...corsHeaders,
         'Content-Type': data.type || 'application/octet-stream',
       },
     })
   } catch (error) {
     return new Response(JSON.stringify({ error: error.message }), {
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       status: 500,
     })
   }
 })