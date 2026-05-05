import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing environment variables");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const userId = "02969eb6-bd47-4f21-88ac-46acdb6bf92b";
const refundAmount = 58.00;

async function run() {
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id, balance")
    .eq("user_id", userId)
    .single();

  if (pErr || !profile) {
    console.error("Profile not found", pErr);
    return;
  }

  const newBalance = Number(profile.balance) + refundAmount;
  
  const { error: upErr } = await supabase
    .from("profiles")
    .update({ balance: newBalance })
    .eq("id", profile.id);

  if (upErr) {
    console.error("Update failed", upErr);
    return;
  }

  const { error: txErr } = await supabase
    .from("wallet_transactions")
    .insert({
      user_id: userId,
      type: "deposit",
      title: "Estorno — Diferença valor renovação proxy (2 unidades)",
      amount: refundAmount,
      balance_after: newBalance,
      reference_id: "REFUND-CLEDOIR-RENEWAL"
    });

  if (txErr) {
    console.error("Transaction insert failed", txErr);
  } else {
    console.log(`Refunded ${refundAmount} to Cledoir. New balance: ${newBalance}`);
  }
}

run();
