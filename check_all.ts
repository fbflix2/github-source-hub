const WEBSHARE_API_KEY = process.env.WEBSHARE_API_KEY;
const url = "https://proxy.webshare.io/api/v2/proxy/list/?mode=direct&page=1&page_size=250&country_code=BR";

async function run() {
  const resp = await fetch(url, { headers: { Authorization: `Token ${WEBSHARE_API_KEY}` } });
  const data = await resp.json();
  const ids = data.results.filter(p => p.valid).map(p => p.id);
  console.log(JSON.stringify(ids));
}
run();
