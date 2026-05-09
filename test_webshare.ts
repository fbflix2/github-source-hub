import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const WEBSHARE_API_KEY = Deno.env.get("WEBSHARE_API_KEY");
const WEBSHARE_BASE = "https://proxy.webshare.io/api/v2";

async function check() {
  const url = `${WEBSHARE_BASE}/proxy/list/?mode=direct&page=1&page_size=100&country_code=BR`;
  const resp = await fetch(url, {
    headers: { Authorization: `Token ${WEBSHARE_API_KEY}` }
  });
  const data = await resp.json();
  console.log("BR Proxies found:", data.results?.length || 0);
  if (data.results?.length > 0) {
    console.log("First BR proxy country:", data.results[0].country_code);
  }
}

check();
