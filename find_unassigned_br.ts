import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const WEBSHARE_API_KEY = process.env.WEBSHARE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // 1. Get all assigned IDs
  const { data: existingSubs } = await supabase
    .from("subscriptions")
    .select("raw_data")
    .in("type", ["proxyfbflix", "webshare"])
    .in("status", ["active", "expiring"]);
    
  const assigned = new Set();
  for (const s of (existingSubs || [])) {
    const pid = s.raw_data?.fbflix_proxy_id || s.raw_data?.webshare_proxy_id;
    if (pid) assigned.add(String(pid));
  }

  // 2. Fetch BR from Webshare
  const url = "https://proxy.webshare.io/api/v2/proxy/list/?mode=direct&page=1&page_size=250&country_code=BR";
  const resp = await fetch(url, { headers: { Authorization: `Token ${WEBSHARE_API_KEY}` } });
  const data = await resp.json();
  
  for (const p of (data.results || [])) {
    if (p.valid && !assigned.has(String(p.id))) {
      console.log(`FOUND_UNASSIGNED|${p.id}|${p.proxy_address}|${p.port}|${p.username}|${p.password}|${p.country_code}|${p.city_name}`);
      break;
    }
  }
}
run();
