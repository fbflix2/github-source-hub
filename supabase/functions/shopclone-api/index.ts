import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Supplier configurations
const ACCFACE_API_BASE = "https://accface.us/api";
const VIA17_API_BASE = "https://via17.com/api";

interface SupplierConfig {
  baseUrl: string;
  username: string;
  password: string;
  label: string;
  folderDefault: string;
}

function getSupplierConfig(supplier: string): SupplierConfig {
  const supplierKey = supplier?.toLowerCase().trim() === "via17" ? "via17" : "accface";

  if (supplierKey === "via17") {
    const username = Deno.env.get("VIA17_USERNAME");
    const password = Deno.env.get("VIA17_PASSWORD");
    if (!username || !password) throw new Error("VIA17 credentials not configured");
    return {
      baseUrl: VIA17_API_BASE,
      username,
      password,
      label: "VIA17",
      folderDefault: "VIA17",
    };
  }
  // Default: accface
  const username = Deno.env.get("ACCFACE_USERNAME");
  const password = Deno.env.get("ACCFACE_PASSWORD");
  if (!username || !password) throw new Error("ACCFACE credentials not configured");
    return {
      baseUrl: ACCFACE_API_BASE,
      username,
      password,
      label: "AccFace",
      folderDefault: "AccFace",
    };
}

function extractRawAccounts(parsed: any): string[] {
  const collected: string[] = [];

  const pushValue = (value: unknown) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) collected.push(trimmed);
      return;
    }
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      if (typeof obj.account === "string") {
        const trimmed = obj.account.trim();
        if (trimmed) collected.push(trimmed);
        return;
      }
      collected.push(JSON.stringify(value));
    }
  };

  if (parsed?._rawText && typeof parsed._rawText === "string") {
    parsed._rawText.split("\n").forEach((line: string) => pushValue(line));
  }

  if (Array.isArray(parsed?.accounts)) {
    parsed.accounts.forEach(pushValue);
  }

  if (typeof parsed?.data === "string") {
    parsed.data.split("\n").forEach((line: string) => pushValue(line));
  } else if (Array.isArray(parsed?.data)) {
    parsed.data.forEach(pushValue);
  } else if (parsed?.data && typeof parsed.data === "object") {
    const dataObj = parsed.data as Record<string, unknown>;

    if (Array.isArray(dataObj.lists)) {
      dataObj.lists.forEach(pushValue);
    }

    for (const value of Object.values(dataObj)) {
      if (Array.isArray(value)) value.forEach(pushValue);
    }
  }

  if (Array.isArray(parsed)) {
    parsed.forEach(pushValue);
  }

  if (parsed?.account) {
    pushValue(parsed.account);
  }

  const cleaned = collected
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const isHeaderLike = /^\d+\s+.+$/i.test(line) && !line.includes("|");
      return !isHeaderLike;
    });

  return [...new Set(cleaned)];
}

/** Parse a raw account line into login/password/profile_link. */
function parseAccountLine(raw: string): { login: string | null; password: string | null; profile_link: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { login: null, password: null, profile_link: null };

  const urlMatch = trimmed.match(/(https?:\/\/[^\s|:]+)/i);
  const profile_link = urlMatch ? urlMatch[1] : null;

  let parts: string[];
  if (trimmed.includes("|")) parts = trimmed.split("|").map((p) => p.trim());
  else parts = trimmed.split(":").map((p) => p.trim());

  const cleanParts = parts.filter((p) => !/^https?:\/\//i.test(p));
  const login = cleanParts[0] || trimmed;
  const password = cleanParts[1] || null;

  let finalLink = profile_link;
  if (!finalLink && /^\d{6,}$/.test(login)) {
    finalLink = `https://facebook.com/profile.php?id=${login}`;
  }

  return { login, password, profile_link: finalLink };
}

/** Ensure a supplier row exists, return id. */
async function ensureSupplierId(adminClient: any, supplierLabel: string) {
  const { data: existing } = await (adminClient as any)
    .from("suppliers")
    .select("id")
    .eq("name", supplierLabel)
    .maybeSingle();
  if ((existing as any)?.id) return (existing as any).id as string;

  const { data: created, error } = await (adminClient as any)
    .from("suppliers")
    .insert({ name: supplierLabel, status: "active", notes: "Auto-criado pela integração Fornecedor secreto 1" } as any)
    .select("id")
    .single();
  if (error || !(created as any)?.id) throw new Error(`Erro ao criar fornecedor: ${error?.message || "sem retorno"}`);
  return (created as any).id as string;
}

/** Create a new batch for this purchase. */
async function createBatch(
  adminClient: any,
  supplierId: string,
  productId: string | number,
  productName: string | undefined,
  unitPriceBrl: number | undefined,
  createdBy: string | null,
) {
  const dt = new Date();
  const stamp = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
  const baseName = productName ? `${productName} (${stamp})` : `Produto ${productId} (${stamp})`;
  const notes = `Compra automática via Fornecedor secreto 1. ID produto: ${productId}${unitPriceBrl ? ` | Custo unit.: R$ ${unitPriceBrl.toFixed(2)}` : ""}`;

  const { data, error } = await (adminClient as any)
    .from("supplier_batches")
    .insert({ supplier_id: supplierId, name: baseName, notes, created_by: createdBy } as any)
    .select("id, name")
    .single();
  if (error || !(data as any)?.id) throw new Error(`Erro ao criar lote: ${error?.message || "sem retorno"}`);
  return { batchId: (data as any).id as string, batchName: (data as any).name as string };
}

/** Insert raw accounts into supplier_accounts. */
async function saveSupplierAccounts(
  adminClient: any,
  supplierId: string,
  batchId: string,
  rawAccounts: string[],
  itemType: string | undefined,
) {
  if (rawAccounts.length === 0) return { savedCount: 0 };

  const has_bm = (itemType || "").toLowerCase() === "bm";
  const rows = rawAccounts.map((raw) => {
    const { login, password, profile_link } = parseAccountLine(raw);
    return {
      supplier_id: supplierId,
      batch_id: batchId,
      login,
      password,
      profile_link,
      status: "aguardando",
      has_bm,
      notes: raw,
    };
  });

  const { error } = await (adminClient as any).from("supplier_accounts").insert(rows as any);
  if (error) {
    console.error("[shopclone-api] Error saving supplier_accounts:", error);
    return { savedCount: 0, error: error.message };
  }
  return { savedCount: rows.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, supplier: supplierParam, ...params } = await req.json();
    const supplier = supplierParam || "accface";
    const config = getSupplierConfig(supplier);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    const staffActions = ["list-products", "get-balance", "product-info", "buy-resource", "import-accounts"];
    if (staffActions.includes(action)) {
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: isStaff } = await adminClient.rpc("is_staff", { _user_id: userId });
      if (!isStaff) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let result: unknown;

    switch (action) {
      case "list-products": {
        const url = `${config.baseUrl}/ListResource.php?username=${encodeURIComponent(config.username)}&password=${encodeURIComponent(config.password)}`;
        const resp = await fetch(url);
        const text = await resp.text();
        if (!resp.ok) {
          result = { status: "error", raw: text, httpStatus: resp.status };
          break;
        }
        try {
          result = JSON.parse(text);
        } catch {
          result = { status: "error", raw: text, parseError: true };
        }
        break;
      }

      case "get-balance": {
        const url = `${config.baseUrl}/GetBalance.php?username=${encodeURIComponent(config.username)}&password=${encodeURIComponent(config.password)}`;
        const resp = await fetch(url);
        const text = await resp.text();
        result = { balance: text.trim() };
        break;
      }

      case "product-info": {
        const { productId } = params;
        if (!productId) throw new Error("productId is required");
        const url = `${config.baseUrl}/InfoResource.php?username=${encodeURIComponent(config.username)}&password=${encodeURIComponent(config.password)}&id=${encodeURIComponent(String(productId))}`;
        const resp = await fetch(url);
        const text = await resp.text();
        try {
          result = JSON.parse(text);
        } catch {
          result = { status: "error", raw: text };
        }
        break;
      }

      case "buy-resource": {
        const { productId, amount, productName, itemType, unitPriceBrl } = params;
        if (!productId || !amount) throw new Error("productId and amount are required");

        const url = `${config.baseUrl}/BResource.php?username=${encodeURIComponent(config.username)}&password=${encodeURIComponent(config.password)}&id=${encodeURIComponent(String(productId))}&amount=${encodeURIComponent(String(amount))}`;
        const resp = await fetch(url);
        const text = await resp.text();

        let parsed: any;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { _rawText: text };
        }

        if (parsed?.status === "error" || parsed?.error) {
          result = parsed;
          break;
        }

        const adminClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const rawAccounts = extractRawAccounts(parsed);

        // Persist into supplier_accounts (new isolated module)
        const supplierId = await ensureSupplierId(adminClient, config.label);
        const { batchId, batchName } = await createBatch(
          adminClient,
          supplierId,
          productId,
          productName ? String(productName) : undefined,
          unitPriceBrl ? Number(unitPriceBrl) : undefined,
          userId,
        );
        const saveResult = await saveSupplierAccounts(
          adminClient,
          supplierId,
          batchId,
          rawAccounts,
          itemType ? String(itemType) : undefined,
        );

        result = {
          status: parsed?.status || "success",
          msg: parsed?.msg,
          trans_id: parsed?.data?.trans_id,
          saved_count: saveResult.savedCount,
          supplier: config.label,
          supplier_id: supplierId,
          batch_id: batchId,
          batch_name: batchName,
          raw_accounts: rawAccounts,
          api_response_keys: Object.keys(parsed || {}),
          ...(saveResult.error && { save_error: saveResult.error }),
        };
        break;
      }

      case "import-accounts": {
        const { productId, productName, sourcePayload, accounts, itemType, unitPriceBrl } = params;
        if (!productId) throw new Error("productId is required");

        const adminClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const rawAccounts = extractRawAccounts(sourcePayload ?? { accounts });

        const supplierId = await ensureSupplierId(adminClient, config.label);
        const { batchId, batchName } = await createBatch(
          adminClient,
          supplierId,
          productId,
          productName ? String(productName) : undefined,
          unitPriceBrl ? Number(unitPriceBrl) : undefined,
          userId,
        );
        const saveResult = await saveSupplierAccounts(
          adminClient,
          supplierId,
          batchId,
          rawAccounts,
          itemType ? String(itemType) : undefined,
        );

        result = {
          status: saveResult.error ? "error" : "success",
          saved_count: saveResult.savedCount,
          supplier: config.label,
          supplier_id: supplierId,
          batch_id: batchId,
          batch_name: batchName,
          raw_accounts: rawAccounts,
          ...(saveResult.error && { error: saveResult.error }),
        };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[shopclone-api]", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
