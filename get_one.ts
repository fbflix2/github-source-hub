const WEBSHARE_API_KEY = process.env.WEBSHARE_API_KEY;
const url = "https://proxy.webshare.io/api/v2/proxy/list/?mode=direct&page=1&page_size=250&country_code=BR";

async function run() {
  const resp = await fetch(url, { headers: { Authorization: `Token ${WEBSHARE_API_KEY}` } });
  const data = await resp.json();
  const found = data.results.find(p => p.id === "d-17371142803");
  console.log(JSON.stringify(found));
}
run();
