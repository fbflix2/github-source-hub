// Emergency containment: fail closed pending security review.
Deno.serve((req: Request) => {
 const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json", "Cache-Control": "no-store" };
 if (req.method === "OPTIONS") return new Response(null, { headers });
 return new Response(JSON.stringify({error: "Funcionalidade temporariamente suspensa por segurança."}), {status:503,headers});
});
