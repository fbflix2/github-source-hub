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

      const { itemId, profileId: rawProfileId, email } = await req.json()

      if (!rawProfileId || !email) {
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

      // 2. Buscar o ID real do perfil no Lauth (pois o rawProfileId pode ser o ID do Facebook usado como nome no Lauth)
      console.log(`Searching for Lauth profile: ${rawProfileId}`)
      
      const listResponse = await fetch(`https://api.lauth.com.br/v1/profiles/list`, {
        headers: {
          'Authorization': `Bearer ${apiKeyData.token}`,
          'Accept': 'application/json'
        }
      })

      if (!listResponse.ok) {
        throw new Error(`Erro ao listar perfis do Lauth: ${listResponse.statusText}`)
      }

      const listData = await listResponse.json()
      const profiles = listData.data || []
      
      // Tentar encontrar por ID exato ou por Nome (ID do Facebook)
      const targetProfile = profiles.find((p: any) => 
        p.id === rawProfileId || 
        (p.info && p.info.name === rawProfileId) ||
        (p.info && p.info.name && p.info.name.includes(rawProfileId))
      )

      if (!targetProfile) {
        console.error(`Profile not found in Lauth: ${rawProfileId}`)
        return new Response(JSON.stringify({ 
          success: false, 
          message: `Perfil "${rawProfileId}" não encontrado no Lauth. Verifique se o nome do perfil no Lauth coincide com o ID cadastrado.` 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        })
      }

      const actualLauthId = targetProfile.id
      console.log(`Found Lauth profile: ${targetProfile.info?.name} (ID: ${actualLauthId})`)

      // 3. Chamar API do Lauth para transferir o perfil
      const response = await fetch(`https://api.lauth.com.br/v1/profiles/transfer`, {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${apiKeyData.token}`,
         'Content-Type': 'application/json',
         'Accept': 'application/json'
       },
       body: JSON.stringify({
          profile_id: actualLauthId,
         email: email
       })
     })

     const result = await response.json()

     if (response.ok) {
        // Dispara WhatsApp de confirmação ao cliente (não bloqueia resposta)
        try {
          if (itemId) {
            const { data: oi } = await supabase
              .from('order_items')
              .select('name, order_id, orders:order_id(user_id, code)')
              .eq('id', itemId)
              .maybeSingle();

            const userId = (oi as any)?.orders?.user_id;
            const orderCode = (oi as any)?.orders?.code;
            const productName = (oi as any)?.name || 'seu perfil';

            if (userId) {
              const { data: prof } = await supabase
                .from('profiles')
                .select('phone, full_name')
                .eq('user_id', userId)
                .maybeSingle();

              const phone = (prof?.phone || '').replace(/\D/g, '');
              if (phone) {
                const firstName = (prof?.full_name || '').split(' ')[0] || 'cliente';
                const message =
                  `Olá, ${firstName}! 👋\n\n` +
                  `Sua compra *${productName}*${orderCode ? ` (pedido ${orderCode})` : ''} ` +
                  `acaba de ser entregue diretamente no seu *Lauth* (${email}). ✅\n\n` +
                  `Basta acessar sua conta no Lauth para começar a usar.\n\n` +
                  `Obrigado pela compra! 💚\n_FBFlix_`;

                await supabase.functions.invoke('wapi-send', {
                  body: { action: 'send-text', phone, message },
                });
              }
            }
          }
        } catch (notifyErr) {
          console.error('Falha ao enviar WhatsApp de confirmação Lauth:', notifyErr);
        }

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