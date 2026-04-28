---
name: Proxy Promotional Pricing
description: Promotional/discounted proxy prices apply only to the first month — renewals always charge the original (full) price
type: feature
---
# Proxy Promotional Pricing Rule

When a proxy is sold with a promotion, discount, or special price (coupon, sale, campaign, etc.), the discounted value applies **only to the first month / initial purchase**.

**All renewals must charge the original (full) product price**, NOT the promotional price the customer paid initially.

## How to apply
- On renewal flows (manual, automatic, migration ProxyBR→Webshare, etc.): always look up the current `products.price` (or the proxy's standard price), never the historical `order_items.price` or the original payment amount.
- Wallet debits, invoice generation, and subscription renewal calculations must use the full original price.
- Do not store the discounted price as the recurring price on the subscription.

## Why
Promotions are acquisition incentives — the business margin depends on renewals being at full price. Renewing at the promo price would cause permanent revenue loss.
