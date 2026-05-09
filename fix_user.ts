import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const WEBSHARE_API_KEY = process.env.WEBSHARE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const userId = "c975df46-ebef-48ee-8fb3-3dbae4e1de3d";
  
  // 1. Get all active proxy IDs
  const { data: activeSubs } = await supabase
    .from("subscriptions")
    .select("raw_data")
    .in("status", ["active", "expiring"]);
    
  const activeIds = new Set();
  for (const s of activeSubs || []) {
    const pid = s.raw_data?.fbflix_proxy_id || s.raw_data?.webshare_proxy_id;
    if (pid) activeIds.add(String(pid));
  }

  // 2. Fetch BR from Webshare
  const url = "https://proxy.webshare.io/api/v2/proxy/list/?mode=direct&page=1&page_size=250&country_code=BR";
  const resp = await fetch(url, { headers: { Authorization: `Token ${WEBSHARE_API_KEY}` } });
  const data = await resp.json();
  const available = data.results.find(p => p.valid && !activeIds.has(String(p.id)));

  if (!available) {
    console.log("ERROR: No unassigned BR proxies found!");
    return;
  }

  console.log(`Found unassigned BR proxy: ${available.id} (${available.city_name})`);

  // 3. Update the user's subscription
  // Find the sub with Dallas proxy
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, raw_data")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (sub) {
    const newRawData = {
      ...sub.raw_data,
      fbflix_proxy_id: available.id,
      proxy_address: available.proxy_address,
      port: available.port,
      username: available.username,
      password: available.password,
      country_code: available.country_code,
      city_name: available.city_name,
    };

    const { error } = await supabase
      .from("subscriptions")
      .update({ raw_data: newRawData })
      .eq("id", sub.id);

    if (error) console.log("Update error:", error);
    else console.log("Successfully updated subscription!");
  } else {
    console.log("No active subscription found for user.");
  }
}
run();
