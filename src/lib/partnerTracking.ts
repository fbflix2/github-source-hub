import { supabase } from "@/integrations/supabase/client";

const VISITOR_KEY = "fbflix_visitor_id";
const REF_ID_KEY = "partner_ref_id";
const REF_SLUG_KEY = "partner_ref";
const REF_AT_KEY = "partner_ref_at";
const REF_COUPON_KEY = "partner_ref_coupon";
const ATTRIBUTION_DAYS = 30;

/** Exclusive discount coupon of the partner that referred this visitor (if any). */
export function getPartnerCoupon(): string | null {
  try {
    if (!getActivePartnerId()) return null;
    const c = localStorage.getItem(REF_COUPON_KEY);
    return c && c.trim() ? c.trim().toUpperCase() : null;
  } catch {
    return null;
  }
}

export function getVisitorId(): string {
  try {
    let v = localStorage.getItem(VISITOR_KEY);
    if (!v) {
      v = (crypto as any).randomUUID
        ? (crypto as any).randomUUID()
        : "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(VISITOR_KEY, v);
    }
    return v;
  } catch {
    return "v_" + Date.now().toString(36);
  }
}

export function getActivePartnerId(): string | null {
  try {
    const id = localStorage.getItem(REF_ID_KEY);
    const at = localStorage.getItem(REF_AT_KEY);
    if (!id || !at) return null;
    const ageMs = Date.now() - new Date(at).getTime();
    if (ageMs > ATTRIBUTION_DAYS * 24 * 3600 * 1000) {
      localStorage.removeItem(REF_ID_KEY);
      localStorage.removeItem(REF_SLUG_KEY);
      localStorage.removeItem(REF_AT_KEY);
      return null;
    }
    return id;
  } catch {
    return null;
  }
}

type EventType = "click" | "view_product" | "add_cart" | "checkout" | "purchase";

interface TrackOpts {
  productId?: string | null;
  productName?: string | null;
  partnerId?: string | null; // override (e.g. on click before LS is set)
  amount?: number | null;
  metadata?: Record<string, any>;
}

export async function trackPartnerEvent(eventType: EventType, opts: TrackOpts = {}) {
  const partnerId = opts.partnerId ?? getActivePartnerId();
  if (!partnerId) return;
  const visitorId = getVisitorId();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const meta = {
      ...(opts.metadata || {}),
      ua: typeof navigator !== "undefined" ? navigator.userAgent : null,
      path: typeof window !== "undefined" ? window.location.pathname : null,
      ref_slug: localStorage.getItem(REF_SLUG_KEY) || null,
    };
    await supabase.from("partner_journey_events" as any).insert({
      visitor_id: visitorId,
      partner_id: partnerId,
      event_type: eventType,
      product_id: opts.productId || null,
      product_name: opts.productName || null,
      user_id: user?.id || null,
      amount: opts.amount ?? null,
      metadata: meta,
    });
    if (user?.id) {
      // Best-effort: link past anonymous events to this user
      await supabase.rpc("partner_journey_claim_visitor" as any, {
        _visitor_id: visitorId,
        _user_id: user.id,
      });
    }
  } catch {
    // tracking is fire-and-forget
  }
}