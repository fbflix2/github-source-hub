

## Problem

The order bump smart filtering is not working because the bump products query (line 204-211 in `Checkout.tsx`) only fetches `id, name, description, price, image_url`. The categorization logic in `relevantBumps` relies on checking product names, descriptions, and tags to classify items as Proxy/Perfil/BM/Pagina — but **`tags` and `icon_type` are not fetched**, so the classification falls back to name-only matching, which is unreliable.

Additionally, the current logic only filters by name substring matching. Products that don't literally contain "proxy", "perfil", "bm", or "pagina" in their name slip through unfiltered, breaking the complementary recommendation.

## Plan

### 1. Fix bump products query to include `tags` and `icon_type`

In `src/pages/Checkout.tsx` line 206, change the select to:
```
.select("id, name, description, price, image_url, tags, icon_type")
```

Also update the `BumpProduct` interface to include `tags` and `icon_type`.

### 2. Use `tags` and `icon_type` in the categorization logic

Update the `relevantBumps` filter (lines 360-379) and scoring (lines 383-429) to also check:
- `bump.icon_type` (e.g., `"proxy"`, `"perfil"`, `"bm"`)
- `bump.tags` array for category keywords

This will make classification robust — even if a product name doesn't literally say "proxy", its `icon_type: "proxy"` or tags `["proxy", "webshare"]` will correctly categorize it.

### 3. Exclude the main product from bumps

Ensure the main product ID is excluded (already done on line 209 with `.neq("id", product.id)`), and also exclude products already in the cart.

These are small, targeted changes to the existing smart bump logic — no structural changes needed.

