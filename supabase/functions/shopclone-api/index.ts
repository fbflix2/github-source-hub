import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ACCFACE_BASE = "https://accface.com/api";

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

function buildStockItems(rawAccounts: string[], productId: string, productName: string | undefined, folder: string) {
  return rawAccounts.map((acc) => {
    const parts = acc.split("|");

    return {
      name: productName || `AccFace #${productId}`,
      type: "perfil",
      status: "aguardando",
      folder,
      identification: parts[0] || acc.substring(0, 100),
      data: {
        raw: acc,
        source: "accface",
        productId: String(productId),
        purchasedAt: new Date().toISOString(),
        ...(parts.length >= 2 && { uid: parts[0], pass: parts[1] }),
        ...(parts.length >= 3 && { token2fa: parts[2] }),
        ...(parts.length >= 4 && { mail: parts[3] }),
        ...(parts.length >= 5 && { mailPass: parts[4] }),
      },
    };
  });
}

async function saveStockItems(adminClient: ReturnType<typeof createClient>, folder: string, stockItems: any[]) {
  if (stockItems.length === 0) return { savedCount: 0 };

  const { data: existingFolder } = await adminClient
    .from("stock_folders")
    .select("id")
    .eq("name", folder)
    .is("deleted_at", null)
    .maybeSingle();

  if (!existingFolder) {
    await adminClient.from("stock_folders").insert({ name: folder });
  }

  const { error: insertError } = await adminClient.from("stock_items").insert(stockItems);
  if (insertError) {
    console.error("[shopclone-api] Error saving to stock:", insertError);
    return { savedCount: 0, error: insertError.message };
  }

  return { savedCount: stockItems.length };
}

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const username = Deno.env.get("ACCFACE_USERNAME");
    const password = Deno.env.get("ACCFACE_PASSWORD");
    if (!username || !password) {
      throw new Error("ACCFACE credentials not configured");
    }

    const { action, ...params } = await req.json();

    // Auth check — only staff can use admin actions, users can use buy action
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
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Staff-only actions
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
        const url = `${ACCFACE_BASE}/ListResource.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
        const resp = await fetch(url);
        const text = await resp.text();
        try {
          result = JSON.parse(text);
        } catch {
          result = { status: "error", raw: text };
        }
        break;
      }

      case "get-balance": {
        const url = `${ACCFACE_BASE}/GetBalance.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
        const resp = await fetch(url);
        const text = await resp.text();
        // Response is raw text like "199.994.860đ"
        result = { balance: text.trim() };
        break;
      }

      case "product-info": {
        const { productId } = params;
        if (!productId) throw new Error("productId is required");
        const url = `${ACCFACE_BASE}/InfoResource.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&id=${encodeURIComponent(String(productId))}`;
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
        const { productId, amount, productName, folderName } = params;
        if (!productId || !amount) throw new Error("productId and amount are required");

        const url = `${ACCFACE_BASE}/BResource.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&id=${encodeURIComponent(String(productId))}&amount=${encodeURIComponent(String(amount))}`;
        console.log("[shopclone-api] buy-resource URL:", url.replace(password, "***"));

        const resp = await fetch(url);
        const text = await resp.text();
        console.log("[shopclone-api] buy-resource raw response:", text.substring(0, 2000));

        let parsed: any;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { _rawText: text };
        }

        console.log("[shopclone-api] parsed keys:", Object.keys(parsed || {}));

        if (parsed?.status === "error" || parsed?.error) {
          result = parsed;
          break;
        }

        const adminClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const folder = String(folderName || "AccFace Import");
        const rawAccounts = extractRawAccounts(parsed);

        console.log("[shopclone-api] rawAccounts count:", rawAccounts.length);
        if (rawAccounts.length > 0) {
          console.log("[shopclone-api] first account sample:", rawAccounts[0].substring(0, 200));
        }

        const stockItems = buildStockItems(rawAccounts, String(productId), productName ? String(productName) : undefined, folder);
        const saveResult = await saveStockItems(adminClient, folder, stockItems);

        result = {
          status: parsed?.status || "success",
          msg: parsed?.msg,
          trans_id: parsed?.data?.trans_id,
          saved_count: saveResult.savedCount,
          folder,
          raw_accounts: rawAccounts,
          api_response_keys: Object.keys(parsed || {}),
          ...(saveResult.error && { save_error: saveResult.error }),
        };
        break;
      }

      case "import-accounts": {
        const { productId, productName, folderName, sourcePayload, accounts } = params;
        if (!productId) throw new Error("productId is required");

        const adminClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const folder = String(folderName || "AccFace Import");
        const rawAccounts = extractRawAccounts(sourcePayload ?? { accounts });
        const stockItems = buildStockItems(rawAccounts, String(productId), productName ? String(productName) : undefined, folder);
        const saveResult = await saveStockItems(adminClient, folder, stockItems);

        result = {
          status: saveResult.error ? "error" : "success",
          saved_count: saveResult.savedCount,
          folder,
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
