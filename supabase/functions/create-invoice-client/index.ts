import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const token = req.headers.get("Authorization");
    if (!token?.startsWith("Bearer ")) return reply({ error: "Não autorizado" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, key);
    const callerDb = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: token } } });
    const { data: { user } } = await callerDb.auth.getUser();
    if (!user) return reply({ error: "Sessão inválida" }, 401);
    const { data: staff } = await admin.rpc("is_staff", { _user_id: user.id });
    if (!staff) return reply({ error: "Acesso negado" }, 403);
    const body = await req.json();
    const first = String(body.first_name || "").trim();
    const last = String(body.last_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    if (!first || first.length > 100 || last.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ error: "Informe nome e e-mail válidos" }, 400);
    const name = [first, last].filter(Boolean).join(" ");
    const random = crypto.getRandomValues(new Uint8Array(24));
    const password = Array.from(random, x => x.toString(16).padStart(2, "0")).join("") + "Aa!";
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, must_change_password: true } });
    if (error) return reply({ error: /already|registered|exists|duplicate/i.test(error.message) ? "Este e-mail já possui cadastro. Selecione o cliente existente." : error.message }, 409);
    if (!data.user) return reply({ error: "Falha ao cadastrar cliente" }, 500);
    const { error: profileError } = await admin.from("profiles").upsert({ user_id: data.user.id, full_name: name }, { onConflict: "user_id" });
    if (profileError) console.error("profile sync:", profileError.message);
    const { error: resetError } = await admin.auth.resetPasswordForEmail(email, { redirectTo: "https://fbflix.com.br/reset-password" });
    if (resetError) console.error("password setup email:", resetError.message);
    return reply({ user_id: data.user.id, full_name: name, email, setup_email_sent: !resetError });
  } catch (e) { console.error(e); return reply({ error: "Erro ao cadastrar cliente" }, 500); }
});
