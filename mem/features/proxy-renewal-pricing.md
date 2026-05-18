---
name: proxy-renewal-pricing
description: Renewal price resolution for ProxyFbflix/Webshare/ProxyBR subscriptions — never auto-pick rotating R$50 SKU for dedicated subs
type: feature
---
When renewing a proxy subscription via `proxyfbflix-api` action `migrate-proxybr-renewal`, the renewal price MUST follow this order:

1. `raw_data.renewal_price` (admin-locked override) — wins over everything.
2. `raw_data.original_full_price` — second priority lock.
3. `products.price` linked via `subscription.product_id`.
4. Product matched by `raw_data.product_name` (the SKU sold at order time), filtered to match dedicated vs rotating type of the subscription.
5. Generic residential/webshare BR or US product, ALSO filtered by dedicated vs rotating (NEVER pick "Proxy Rotativo BR" R$50 for a dedicated `proxyfbflix`/`webshare` sub).
6. Hard default: R$ 21 (dedicated standard BR/US).

Rules:
- Dedicated subscription types (`proxyfbflix`, `webshare`) must NEVER match rotating products (name/tag contains `rotativ`/`rotating`).
- Rotating subs (`proxyfbflix_rotating`, `webshare_rotating`) must NEVER match dedicated products.
- When a legacy/migrated sub has `product_id = NULL`, always prefer stored `raw_data.product_name` lookup; otherwise use the country-based default. Do NOT fall back to a rotating SKU.
- Admins can pin a fixed renewal price for a contract by writing `raw_data.renewal_price` and `raw_data.pricing_locked_reason` on the subscription row.

Why: Customers like Guilherme Girardi (sub `2602121370#2`) were charged R$50 on renewal because the code matched "Proxy Rotativo BR" as a fallback for a dedicated proxy sub. The original product was R$20-R$21.
