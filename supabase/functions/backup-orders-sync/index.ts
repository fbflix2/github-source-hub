import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "fb-backups";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function d(v: unknown): string {
  const s = v == null ? "" : String(v).trim();
  return s || "—";
}

function buildTxt(
  tpl: string | null,
  data: Record<string, any>,
  order: { code?: string | null; created_at?: string | null },
  itemName: string,
): string {
  const date = order.created_at
    ? new Date(order.created_at).toLocaleDateString("pt-BR")
    : "—";
  const map: Record<string, string> = {
    "{{nomePerfil}}": d(data.nomePerfil),
    "{{emailAcesso}}": d(data.emailAcesso || data.email || data.login),
    "{{emailAlternativo}}": d(data.emailAlternativo || data.alternateEmail),
    "{{senha}}": d(data.senha || data.password),
    "{{senhaEmail}}": d(data.senhaEmail),
    "{{token2fa}}": d(data.token2fa || data["2fa"]),
    "{{dataNascimento}}": d(data.dataNascimento),
    "{{genero}}": d(data.genero),
    "{{tempoPlataforma}}": d(data.tempoPlataforma),
    "{{statusAtual}}": d(data.statusAtual),
    "{{descricao}}": d(data.descricao),
    "{{cookies}}": d(data.cookies),
    "{{linkDocumento}}": d(data.linkDocumento),
    "{{linkPerfil}}": d(data.linkPerfil),
    "{{idPerfil}}": d(data.idPerfil),
    "{{pedido}}": d(order.code),
    "{{data}}": date,
    "{{nomeProduto}}": d(itemName),
  };

  if (tpl) {
    let out = tpl;
    for (const [k, v] of Object.entries(map)) out = out.split(k).join(v);
    return out;
  }

  const lines = [
    `=== ${d(itemName)} ===`,
    `Pedido: ${d(order.code)}`,
    `Data: ${date}`,
    "",
    "--- Dados de Acesso ---",
    `Login / Email: ${map["{{emailAcesso}}"]}`,
    `Senha: ${map["{{senha}}"]}`,
    `Código 2FA: ${map["{{token2fa}}"]}`,
  ];
  if (map["{{emailAlternativo}}"] !== "—") lines.push(`Email Alternativo: ${map["{{emailAlternativo}}"]}`);
  if (map["{{senhaEmail}}"] !== "—") lines.push(`Senha Email: ${map["{{senhaEmail}}"]}`);
  if (map["{{nomePerfil}}"] !== "—") lines.push(`Nome do Perfil: ${map["{{nomePerfil}}"]}`);
  if (map["{{idPerfil}}"] !== "—") lines.push(`ID do Perfil: ${map["{{idPerfil}}"]}`);
  if (map["{{linkPerfil}}"] !== "—") lines.push(`Link do Perfil: ${map["{{linkPerfil}}"]}`);
  if (map["{{dataNascimento}}"] !== "—") lines.push(`Data de Nascimento: ${map["{{dataNascimento}}"]}`);
  if (map["{{genero}}"] !== "—") lines.push(`Gênero: ${map["{{genero}}"]}`);
  if (map["{{statusAtual}}"] !== "—") lines.push(`Status Atual: ${map["{{statusAtual}}"]}`);
  if (Array.isArray(data.bmLinks) && data.bmLinks.length) {
    lines.push("", "--- BMs ---", ...data.bmLinks.map((l: string, i: number) => `BM #${i + 1}: ${l}`));
  }
  if (Array.isArray(data.comboItems) && data.comboItems.length) {
    lines.push("", "--- Itens do combo ---");
    for (const c of data.comboItems) {
      lines.push(
        `• ${d(c?.name)} | ID: ${d(c?.identification)} | Link: ${d(c?.identification_link)}`,
      );
      const cd = c?.data || {};
      if (cd.emailAcesso || cd.senha) lines.push(`  Login: ${d(cd.emailAcesso)} | Senha: ${d(cd.senha)} | 2FA: ${d(cd.token2fa)}`);
    }
  }
  if (map["{{descricao}}"] !== "—") lines.push("", "--- Descrição ---", map["{{descricao}}"]);
  if (map["{{cookies}}"] !== "—") lines.push("", "--- Cookies ---", map["{{cookies}}"]);
  return lines.join("\n");
}

function hasCredentials(dd: Record<string, any> | null): boolean {
  if (!dd || typeof dd !== "object") return false;
  return Boolean(
    dd.emailAcesso || dd.email || dd.login || dd.senha || dd.password ||
    dd.idPerfil || dd.linkPerfil || (Array.isArray(dd.bmLinks) && dd.bmLinks.length) ||
    (Array.isArray(dd.comboItems) && dd.comboItems.length),
  );
}

async function isAdmin(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return false;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return false;
  const { data: ok } = await admin.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
  return ok === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const internal = req.headers.get("x-internal-secret") === (Deno.env.get("INTERNAL_CRON_SECRET") ?? "d1e4b1dd84d78e4ff67040fad2c2ee3d571e031d14bb3776");
    if (!internal && !(await isAdmin(req))) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit) || 300, 1000);
    const orderId: string | null = body.order_id ?? null;

    const { data: tplRow } = await admin
      .from("block_templates").select("content").eq("is_default", true).maybeSingle();
    const tpl = (tplRow as any)?.content ?? null;

    let q = admin
      .from("order_items")
      .select("id, name, delivery_data, created_at, order_id, orders!inner(id, code, created_at, status, user_id)")
      .not("delivery_data", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (orderId) q = q.eq("order_id", orderId);

    const { data: items, error: itemsErr } = await q;
    if (itemsErr) throw itemsErr;

    const rows = (items || []).filter((r: any) =>
      ["completed", "paid", "processing"].includes(String(r.orders?.status || "")) &&
      hasCredentials(r.delivery_data),
    );
    if (!rows.length) {
      return new Response(JSON.stringify({ success: true, created: 0, skipped: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Nomes dos clientes
    const userIds = [...new Set(rows.map((r: any) => r.orders?.user_id).filter(Boolean))];
    const nameByUser = new Map<string, string>();
    for (let i = 0; i < userIds.length; i += 75) {
      const { data: profs } = await admin
        .from("profiles").select("user_id, full_name").in("user_id", userIds.slice(i, i + 75));
      for (const p of profs || []) nameByUser.set(p.user_id, (p.full_name || "").trim() || "Cliente sem nome");
    }

    let created = 0, skipped = 0;
    const folderCache = new Map<string, string>();

    for (const r of rows as any[]) {
      const order = r.orders;
      const fileName = `PEDIDO_${order.code || order.id.slice(0, 8)}_${String(r.id).slice(0, 8)}.txt`;

      const { data: exists } = await admin
        .from("fb_backup_files").select("id").eq("file_name", fileName).limit(1);
      if (exists && exists.length) { skipped++; continue; }

      const clientName = nameByUser.get(order.user_id) || "Cliente sem nome";
      let folderId = folderCache.get(clientName);
      if (!folderId) {
        const { data: f } = await admin
          .from("fb_backup_folders").select("id").eq("client_name", clientName).limit(1);
        if (f && f.length) folderId = f[0].id;
        else {
          const { data: nf, error: nfErr } = await admin
            .from("fb_backup_folders")
            .insert({ client_name: clientName, description: "Pedidos entregues (backup automático)" })
            .select("id").single();
          if (nfErr || !nf) { skipped++; continue; }
          folderId = nf.id;
        }
        folderCache.set(clientName, folderId!);
      }

      const dd = r.delivery_data as Record<string, any>;
      const content = buildTxt(tpl, dd, order, r.name || "Item");
      const path = `${folderId}/pedidos/${fileName}`;

      const { error: upErr } = await admin.storage.from(BUCKET).upload(
        path, new Blob([content], { type: "text/plain" }), { contentType: "text/plain", upsert: true },
      );
      if (upErr) { console.error("upload fail", path, upErr.message); skipped++; continue; }

      const fbId = dd.idPerfil ? String(dd.idPerfil).replace(/\D/g, "") || null : null;
      const { error: insErr } = await admin.from("fb_backup_files").insert({
        folder_id: folderId,
        file_name: fileName,
        storage_path: path,
        size_bytes: new TextEncoder().encode(content).length,
        purchase_date: order.created_at ? String(order.created_at).slice(0, 10) : null,
        fb_id: fbId,
      });
      if (insErr) {
        console.error("insert fail", fileName, insErr.message);
        await admin.storage.from(BUCKET).remove([path]);
        skipped++; continue;
      }
      created++;
    }

    return new Response(JSON.stringify({ success: true, created, skipped, scanned: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("backup-orders-sync error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
