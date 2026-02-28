const PROXYBR_API_KEY = Deno.env.get("PROXYBR_API_KEY")!;

Deno.test("Check raw API response", async () => {
  for (const code of ["2511284139", "2602019500"]) {
    const resp = await fetch(`https://painel.proxybr.com.br/api/subscriptions/${code}`, {
      headers: { "Accept": "application/json", "X-API-Key": PROXYBR_API_KEY },
    });
    const text = await resp.text();
    console.log(`SUB ${code} [${resp.status}]: ${text.substring(0, 500)}`);
  }
});
