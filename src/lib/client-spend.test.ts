import { describe, it, expect } from "vitest";
import { computeSpend, unlinkedWalletPurchases } from "./client-spend";

const orders = [
  { id: "a", status: "completed", payment_method: "saldo", total: "120.00", created_at: "2026-10-24T19:00:00Z" },
  { id: "b", status: "completed", payment_method: "pix", total: 500, created_at: "2026-09-15T17:00:00Z" },
  { id: "c", status: "abandoned", payment_method: null, total: 771, created_at: "2026-10-20T10:00:00Z" },
  { id: "d", status: "completed", payment_method: "cortesia", total: 50, created_at: "2026-10-05T10:00:00Z" },
  // 31/10 22:00 BRT = 01/11 01:00 UTC -> belongs to October in Brazil
  { id: "e", status: "completed", payment_method: "saldo", total: 21, created_at: "2026-11-01T01:00:00Z" },
];
const txs = [
  { type: "purchase", amount: "-120.00", reference_id: "a", created_at: "2026-10-24T19:00:01Z" },
  { type: "purchase", amount: -25, reference_id: "sub-1", created_at: "2026-10-03T12:00:00Z" },
  { type: "purchase", amount: -21, reference_id: "sub-2", created_at: "2026-09-09T12:00:00Z" },
  { type: "deposit", amount: 500, reference_id: null, created_at: "2026-10-01T12:00:00Z" },
];
const ids = new Set(orders.map(o => o.id));

describe("client spend", () => {
  it("monthly total includes proxy renewals and excludes abandoned/courtesy", () => {
    const r = computeSpend(orders, unlinkedWalletPurchases(txs, ids), "2026-10");
    expect(r.ordersTotal).toBe(141);
    expect(r.renewalsTotal).toBe(25);
    expect(r.total).toBe(166);
  });
  it("all-time total sums every month", () => {
    expect(computeSpend(orders, unlinkedWalletPurchases(txs, ids)).total).toBe(687);
  });
  it("wallet purchases tied to orders are not double counted", () => {
    expect(unlinkedWalletPurchases(txs, ids).length).toBe(2);
  });
});
