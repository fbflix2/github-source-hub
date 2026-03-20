import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find open cash register
    const { data: openCash, error: fetchErr } = await supabase
      .from("cash_register")
      .select("*")
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (!openCash) {
      return new Response(
        JSON.stringify({ message: "No open cash register found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openedAt = openCash.opened_at;
    const openingBalance = openCash.opening_balance || 0;

    // Calculate system revenue and expenses for the period
    const [ordersRes, purchasesRes] = await Promise.all([
      supabase
        .from("orders")
        .select("total")
        .in("status", ["completed", "delivered"])
        .neq("payment_method", "courtesy")
        .gte("created_at", openedAt),
      supabase
        .from("purchases")
        .select("total_value")
        .gte("created_at", openedAt),
    ]);

    const systemRevenue = (ordersRes.data ?? []).reduce(
      (s: number, o: any) => s + Number(o.total || 0),
      0
    );
    const systemExpenses = (purchasesRes.data ?? []).reduce(
      (s: number, p: any) => s + Number(p.total_value || 0),
      0
    );
    const systemBalance = systemRevenue - systemExpenses;

    // Expected bank balance = opening + revenue - expenses
    const expectedBalance = openingBalance + systemBalance;

    const now = new Date().toISOString();

    // Close current cash register (auto-close: bank = expected, diff = 0)
    const { error: closeErr } = await supabase
      .from("cash_register")
      .update({
        closed_at: now,
        status: "closed",
        system_revenue: systemRevenue,
        system_expenses: systemExpenses,
        system_balance: systemBalance,
        bank_balance: expectedBalance,
        withdrawals: 0,
        deposits: 0,
        difference: 0,
        notes: "Fechamento automático à meia-noite",
        updated_at: now,
      })
      .eq("id", openCash.id);

    if (closeErr) throw closeErr;

    // Do NOT auto-open next day — admin opens manually

    console.log(
      `Auto-closed cash ${openCash.id}. Revenue: ${systemRevenue}, Expenses: ${systemExpenses}, New opening: ${expectedBalance}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        closed_id: openCash.id,
        system_revenue: systemRevenue,
        system_expenses: systemExpenses,
        new_opening_balance: expectedBalance,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Auto-close cash error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
