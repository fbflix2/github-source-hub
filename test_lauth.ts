import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

const { data: apiKeyData } = await supabase
  .from('api_keys')
  .select('token')
  .ilike('name', '%lauth%')
  .eq('status', 'active')
  .maybeSingle()

if (!apiKeyData) {
  console.log("No Lauth API key found")
  Deno.exit(0)
}

const resp = await fetch('https://api.lauth.com.br/v1/profiles', {
  headers: {
    'Authorization': `Bearer ${apiKeyData.token}`,
    'Accept': 'application/json'
  }
})

console.log("Status:", resp.status)
const data = await resp.json()
console.log("Data:", JSON.stringify(data, null, 2))
