import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ACCFACE_BASE = "https://accface.com/api";

Deno.serve(async (req) => {
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
    const staffActions = ["list-products", "get-balance", "product-info", "buy-resource"];
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
        const resp = await fetch(url);
        const text = await resp.text();
        
        let parsed: any;
        try {
          parsed = JSON.parse(text);
        } catch {
          result = { status: "error", raw: text };
          break;
        }

        // If the API returned an error status
        if (parsed?.status === "error" || parsed?.error) {
          result = parsed;
          break;
        }

        // Save accounts to stock_items using service role
        const adminClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const folder = folderName || "AccFace Import";
        const accounts: any[] = [];

        // AccFace returns accounts in various formats - handle them
        // Common format: { accounts: [ "uid|pass|2fa|mail|mailpass|...", ... ] }
        // Or: { accounts: [ { uid, pass, ... }, ... ] }
        // Or: { data: "uid|pass\nuid2|pass2\n..." }
        let rawAccounts: string[] = [];

        if (Array.isArray(parsed?.accounts)) {
          rawAccounts = parsed.accounts;
        } else if (typeof parsed?.data === "string") {
          rawAccounts = parsed.data.split("\n").filter((l: string) => l.trim());
        } else if (Array.isArray(parsed)) {
          rawAccounts = parsed;
        } else if (typeof parsed === "string") {
          rawAccounts = parsed.split("\n").filter((l: string) => l.trim());
        }

        // Create stock_items for each account
        const stockItems = rawAccounts.map((acc: any, idx: number) => {
          const accStr = typeof acc === "string" ? acc : JSON.stringify(acc);
          const parts = accStr.split("|");
          
          return {
            name: productName || `AccFace #${productId}`,
            type: "perfil",
            status: "aguardando",
            folder,
            identification: parts[0] || accStr,
            data: {
              raw: accStr,
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

        if (stockItems.length > 0) {
          // Ensure the folder exists
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
          }
        }

        result = {
          ...parsed,
          saved_count: stockItems.length,
          folder,
          raw_accounts: rawAccounts,
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
