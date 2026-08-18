// Resolve which OpenPix account should receive a charge.
// Rule: any payment made by a RESELLER'S CLIENT goes to the reseller's own
// OpenPix gateway. Payments made by the reseller owner (their own wallet
// top-up) and by FBFlix clients go to the FBFlix gateway.

export interface GatewayResolution {
  appId: string;
  resellerId: string | null;
  owner: "reseller" | "fbflix";
}

export async function resolveOpenPixGateway(
  admin: any,
  opts: { userId: string; resellerId?: string | null; orderId?: string | null },
): Promise<GatewayResolution> {
  const fallback = Deno.env.get("OPENPIX_APP_ID") || "";
  let resellerId: string | null = opts.resellerId || null;

  if (!resellerId && opts.orderId) {
    const { data: orderRow } = await admin
      .from("orders")
      .select("reseller_id")
      .eq("id", opts.orderId)
      .maybeSingle();
    if (orderRow?.reseller_id) resellerId = orderRow.reseller_id;
  }

  if (!resellerId && opts.userId) {
    const { data: profileRow } = await admin
      .from("profiles")
      .select("reseller_id")
      .eq("user_id", opts.userId)
      .maybeSingle();
    if (profileRow?.reseller_id) resellerId = profileRow.reseller_id;
  }

  if (!resellerId) return { appId: fallback, resellerId: null, owner: "fbflix" };

  const { data: reseller } = await admin
    .from("resellers")
    .select("id, user_id, status, gateway_openpix_app_id")
    .eq("id", resellerId)
    .maybeSingle();

  if (!reseller) return { appId: fallback, resellerId, owner: "fbflix" };

  // Reseller's own money (wallet top-up / credits) always goes to FBFlix
  if (reseller.user_id && reseller.user_id === opts.userId) {
    console.log(`[openpix-gateway] Reseller owner payment -> FBFlix gateway`);
    return { appId: fallback, resellerId, owner: "fbflix" };
  }

  const appId = String(reseller.gateway_openpix_app_id || "").trim();
  if (appId && ["active", "warning"].includes(String(reseller.status))) {
    console.log(`[openpix-gateway] Using reseller gateway ${resellerId}`);
    return { appId, resellerId, owner: "reseller" };
  }

  console.log(`[openpix-gateway] Reseller ${resellerId} sem gateway proprio -> FBFlix`);
  return { appId: fallback, resellerId, owner: "fbflix" };
}