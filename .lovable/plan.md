

## Problem

The share button doesn't appear on product cards because the `slug` field is missing from the data flow:

1. **`Loja.tsx`** — The `Product` interface (line 28-43) lacks the `slug` field, so even though the DB query fetches `*` (which includes `slug`), TypeScript doesn't expose it to child components.
2. **`ProductListItem.tsx`** — Already has the share button code and uses `product.slug`, but receives products without `slug` from the parent, so `productUrl` is always `null` and the button is conditionally hidden.

## Plan

1. **Add `slug` to the `Product` interface in `Loja.tsx`** (line 28-43) — Add `slug?: string | null;` to the interface so the field from the DB query flows through.

2. **Add `slug` to the `Product` interface in `ProductListItem.tsx`** (line 7-22) — Confirm the `slug` field exists (it may already be there from the previous edit). If it's `slug?: string | null`, that's correct.

3. **Add `slug` to proxy-mapped products in `Loja.tsx`** — Where `proxyAsProducts` are built (around line 141-164), ensure the mapped product objects also include `slug` from `localData`.

That's it — the share button already renders conditionally based on `productUrl` which depends on `product.slug`. Once the slug flows through, the button will appear.

