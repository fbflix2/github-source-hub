import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function ok(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(msg: string, status = 400) {
  return ok({ error: msg }, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const { action, token } = body || {};
    if (!action) return err("action é obrigatório");
    if (!token || typeof token !== "string" || token.length < 8) {
      return err("Token inválido", 401);
    }

    // Validate the supplier token
    const { data: supplier, error: supErr } = await admin
      .from("suppliers")
      .select("id, name, status")
      .eq("access_token", token)
      .eq("status", "active")
      .maybeSingle();

    if (supErr || !supplier) {
      return err("Token inválido ou fornecedor inativo", 401);
    }
    const supplierId = supplier.id;

    // ===== AUTH (returns supplier info only) =====
    if (action === "auth") {
      return ok({ supplier: { id: supplier.id, name: supplier.name, status: supplier.status } });
    }

    // ===== LIST REQUESTS (with items) =====
    if (action === "list-requests") {
      const { data, error } = await admin
        .from("supplier_requests")
        .select("*, items:supplier_request_items(*)")
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false });
      if (error) return err(error.message, 500);
      return ok({ requests: data || [] });
    }

    // ===== LIST PURCHASE REQUESTS (open ones — public marketplace) =====
    if (action === "list-purchase-requests") {
      const { data, error } = await admin
        .from("purchase_requests")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false });
      if (error) return err(error.message, 500);
      return ok({ purchase_requests: data || [] });
    }

    // ===== PAYMENT METHODS =====
    if (action === "list-payment-methods") {
      const { data, error } = await admin
        .from("supplier_payment_methods")
        .select("*")
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false });
      if (error) return err(error.message, 500);
      return ok({ payment_methods: data || [] });
    }

    if (action === "add-payment-method") {
      const { type, details, is_primary } = body;
      if (!type || !details) return err("type e details são obrigatórios");
      if (typeof details !== "string" || details.length > 1000) return err("details inválido");
      const { data, error } = await admin
        .from("supplier_payment_methods")
        .insert({ supplier_id: supplierId, type, details, is_primary: !!is_primary })
        .select()
        .single();
      if (error) return err(error.message, 500);
      return ok({ payment_method: data });
    }

    if (action === "delete-payment-method") {
      const { id } = body;
      if (!id) return err("id é obrigatório");
      // Ensure the row belongs to this supplier
      const { data: existing } = await admin
        .from("supplier_payment_methods")
        .select("id, supplier_id")
        .eq("id", id)
        .maybeSingle();
      if (!existing || existing.supplier_id !== supplierId) {
        return err("Não autorizado", 403);
      }
      const { error } = await admin.from("supplier_payment_methods").delete().eq("id", id);
      if (error) return err(error.message, 500);
      return ok({ success: true });
    }

    // ===== SUBMIT REPLENISHMENT (creates batch + accounts) =====
    if (action === "submit-replenishment") {
      const { name, notes, accounts } = body;
      if (!name || !Array.isArray(accounts) || accounts.length === 0) {
        return err("name e accounts são obrigatórios");
      }
      if (accounts.length > 500) return err("máximo de 500 itens por envio");

      const { data: batch, error: batchErr } = await admin
        .from("supplier_batches")
        .insert({
          supplier_id: supplierId,
          name: String(name).slice(0, 200),
          notes: notes ? String(notes).slice(0, 2000) : null,
          purchased_at: new Date().toISOString().split("T")[0],
          type: "replacement",
        })
        .select()
        .single();
      if (batchErr) return err(batchErr.message, 500);

      const rows = accounts.map((a: any) => ({
        batch_id: batch.id,
        supplier_id: supplierId,
        login: String(a.login || "").slice(0, 200),
        password: String(a.password || "").slice(0, 200),
        notes: a.notes ? String(a.notes).slice(0, 1000) : null,
        status: "aguardando",
        has_bm: !!a.has_bm,
      }));

      const { error: insErr } = await admin.from("supplier_accounts").insert(rows);
      if (insErr) return err(insErr.message, 500);
      return ok({ success: true, batch_id: batch.id, count: rows.length });
    }

    // ===== SUBMIT OFFER (just a batch row) =====
    if (action === "submit-offer") {
      const { name, notes } = body;
      if (!name) return err("name é obrigatório");
      const { error } = await admin.from("supplier_batches").insert({
        supplier_id: supplierId,
        name: String(name).slice(0, 200),
        notes: notes ? String(notes).slice(0, 4000) : null,
        purchased_at: new Date().toISOString().split("T")[0],
        type: "offer",
      });
      if (error) return err(error.message, 500);
      return ok({ success: true });
    }

    return err(`Ação desconhecida: ${action}`);
  } catch (e: any) {
    console.error("[supplier-portal] error", e?.message);
    return err(e?.message || "Erro interno", 500);
  }
});