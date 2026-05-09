const WEBSHARE_API_KEY = process.env.WEBSHARE_API_KEY;
const WEBSHARE_BASE = "https://proxy.webshare.io/api/v2";

async function run() {
  const url = `${WEBSHARE_BASE}/proxy/list/?mode=direct&page=1&page_size=250&country_code=BR`;
  const resp = await fetch(url, { headers: { Authorization: `Token ${WEBSHARE_API_KEY}` } });
  const data = await resp.json();
  const results = data.results || [];

  for (const p of results) {
    if (p.valid) {
      console.log(`${p.id}|${p.proxy_address}|${p.port}|${p.username}|${p.password}|${p.country_code}|${p.city_name}`);
    }
  }
}
run();
