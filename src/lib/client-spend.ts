// Client spend calculations. Proxy renewals are charged straight to the wallet
// (wallet_transactions type "purchase") without an orders row, so they must be
// added to order totals — otherwise monthly/all-time spend is understated.

export interface SpendOrder { id: string; status: string; payment_method?: string | null; total: number | string; created_at: string }
export interface SpendWalletTx { amount: number | string; type: string; reference_id?: string | null; created_at: string; title?: string | null }

export const monthKeyBRT = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).slice(0, 7);

const cents = (v: number | string) => Math.round(Number(v) * 100);

export const isPaidOrder = (o: SpendOrder) =>
  ["completed", "delivered"].includes(o.status) && o.payment_method !== "cortesia";

/** Wallet purchases not tied to any order of the user (e.g. proxy renewals). */
export function unlinkedWalletPurchases(txs: SpendWalletTx[], allOrderIds: Set<string>, allOrderCodes: Set<string> = new Set()) {
  return txs.filter(t => t.type === "purchase" && !(t.reference_id && (allOrderIds.has(t.reference_id) || allOrderCodes.has(t.reference_id))));
}

export function computeSpend(orders: SpendOrder[], renewals: SpendWalletTx[], month?: string) {
  const inMonth = (d: string) => !month || monthKeyBRT(d) === month;
  const paid = orders.filter(o => isPaidOrder(o) && inMonth(o.created_at));
  const ren = renewals.filter(t => inMonth(t.created_at));
  const ordersCents = paid.reduce((s, o) => s + cents(o.total), 0);
  const renewalsCents = ren.reduce((s, t) => s + Math.abs(cents(t.amount)), 0);
  return {
    orders: paid, renewals: ren,
    ordersTotal: ordersCents / 100,
    renewalsTotal: renewalsCents / 100,
    total: (ordersCents + renewalsCents) / 100,
  };
}
