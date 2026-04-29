 import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
 }

 serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response(null, { headers: corsHeaders })
   }

   try {
     const supabase = createClient(
       Deno.env.get('SUPABASE_URL') ?? '',
       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
     )

     const { itemId, profileId, email } = await req.json()

     if (!profileId || !email) {
       return new Response(JSON.stringify({ success: false, message: 'Dados insuficientes' }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         status: 400
       })
     }

     // 1. Buscar a chave API do Lauth cadastrada pelo Admin
     const { data: apiKeyData, error: keyError } = await supabase
       .from('api_keys')
       .select('token')
       .ilike('name', '%lauth%')
       .eq('status', 'active')
       .maybeSingle()

     if (keyError || !apiKeyData) {
       console.error('Lauth API Key not found in api_keys table')
       return new Response(JSON.stringify({ 
         success: false, 
         message: 'Configuração do Lauth não encontrada. O administrador precisa cadastrar a "Lauth" API Key em Admin > API.' 
       }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         status: 200 // Return 200 so the frontend can show the message
       })
     }

     // 2. Chamar API do Lauth para transferir o perfil
     // Usando o padrão deduzido da documentação e ajuda do Lauth
     const response = await fetch(`https://api.lauth.com.br/v1/profiles/transfer`, {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${apiKeyData.token}`,
         'Content-Type': 'application/json',
         'Accept': 'application/json'
       },
       body: JSON.stringify({
         profile_id: profileId,
         email: email
       })
     })

     const result = await response.json()

     if (response.ok) {
       return new Response(JSON.stringify({ success: true, data: result }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         status: 200
       })
     } else {
       console.error('Lauth API error:', result)
       return new Response(JSON.stringify({ 
         success: false, 
         message: result.message || 'Erro na API do Lauth ao transferir perfil.' 
       }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         status: 200
       })
     }

   } catch (error) {
     console.error('Function error:', error)
     return new Response(JSON.stringify({ success: false, message: error.message }), {
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       status: 500
     })
   }
 })