

## Diagnosis

The root cause is clear from the database evidence:

- **Payment `6f32de42`** is marked `status: completed` with metadata `{mp_status: approved, ...}`
- **Balance** for the user is still `0.00`
- **No `wallet_transactions`** record exists for this payment

**Root cause (line 93-96 of `mercadopago-webhook/index.ts`)**: When the first webhook arrives with status `pending`, the code overwrites the entire `metadata` column with `{mp_status: "pending", mp_status_detail: "..."}`, **destroying the `type: "wallet_recharge"` field** that was set during payment creation.

Later, when the `approved` webhook arrives, it reads the payment and checks:
```
const isWalletRecharge = metadataObj.type === "wallet_recharge" && !orderId;
```
Since `type` was erased, `isWalletRecharge` is `false`. And `orderId` is `null`, so the order branch is also skipped. **Neither branch executes**, so the balance is never credited.

## Plan

### 1. Fix the pending metadata update (line 89-98)
Preserve existing metadata fields when updating for non-approved statuses by spreading the current metadata before adding new fields. This prevents the `type` field from being erased.

### 2. Simplify the wallet recharge detection
Instead of relying solely on `metadata.type`, determine wallet recharge based on `!orderId` (if there's no `order_id`, it's a wallet recharge). This is more robust and doesn't depend on metadata integrity.

### 3. Fix the immediate balance credit
After fixing the webhook, manually credit the user's balance for the already-completed payment `6f32de42` (R$ 2.10 to user `448f4563`) using a database insert to `wallet_transactions` and updating `profiles.balance`.

### Files to modify
- `supabase/functions/mercadopago-webhook/index.ts` -- Fix metadata preservation and wallet detection logic

### Database fix needed
- Update `profiles.balance` for user `448f4563-dd6a-44ea-9238-3c668ba6ea15` to credit the R$ 2.10
- Insert corresponding `wallet_transactions` record

