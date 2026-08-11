import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Wallet, QrCode, CreditCard, Lock, ChevronLeft, User, Calendar, Flame, Loader2, Check, Copy, Share2, Mail, Layers, Trash2, X } from "lucide-react";
import IconWallet from "@/assets/payment/carteira.svg";
import IconPix from "@/assets/payment/pix.svg";
import IconCard from "@/assets/payment/visa.svg";
import { supabase } from "@/integrations/supabase/client";
import { invokeProxyBR } from "@/lib/proxybr-client";
import { toast } from "sonner";
import { useCart } from "@/contexts/CartContext";
import { useQueryClient } from "@tanstack/react-query";
import { useResellerContext } from "@/hooks/useResellerContext";
import { useResellerBranding } from "@/hooks/useResellerBranding";
import StripeCardFields, { type StripeCardFieldsHandle } from "@/components/checkout/StripeCardFields";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
 import { WhatsAppRequiredPopup } from "@/components/WhatsAppRequiredPopup";
 import { Badge } from "@/components/ui/badge";

interface DbProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  stock: number;
  available: boolean;
  category_id: string | null;
  icon_type: string | null;
  external_id: string | null;
  tags: string[] | null;
  slug?: string | null;
}

interface BumpProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  tags: string[] | null;
  icon_type: string | null;
}

const MAIN_CHECKOUT_HOSTS = [
  "fbflix.com.br",
  "www.fbflix.com.br",
  "fbflix1.lovable.app",
  "localhost",
];

const hasResellerCheckoutSignal = (searchParams: URLSearchParams) => {
  if (searchParams.get("r")) return true;
  if (typeof window === "undefined") return false;

  const host = window.location.hostname.toLowerCase();
  const isMainHost =
    !host ||
    MAIN_CHECKOUT_HOSTS.includes(host) ||
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".lovable.app");

  if (!isMainHost) return true;

  try {
    return Boolean(
      localStorage.getItem("fbflix_reseller_id") ||
      localStorage.getItem("fbflix_reseller_slug")
    );
  } catch {
    return false;
  }
};

const isResellerHost = () => {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  const isMainHost =
    !host ||
    MAIN_CHECKOUT_HOSTS.includes(host) ||
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".lovable.app");
  return !isMainHost;
};

const readStoredResellerValue = (key: string) => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const getResellerSlugFromCheckoutSearch = (searchParams: URLSearchParams) => {
  const directSlug = searchParams.get("r")?.trim().toLowerCase();
  if (directSlug) return directSlug;

  const redirect = searchParams.get("redirect");
  if (!redirect || typeof window === "undefined") return null;
  try {
    const redirectUrl = new URL(redirect, window.location.origin);
    return redirectUrl.searchParams.get("r")?.trim().toLowerCase() || null;
  } catch {
    return null;
  }
};

const getResellerCheckoutPriceSnapshot = (productId: string) => {
  if (typeof window === "undefined" || !productId) return null;
  try {
    const raw = sessionStorage.getItem("reseller_checkout_price");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.product_id !== productId) return null;
    const price = Number(parsed.price);
    if (!Number.isFinite(price) || price <= 0) return null;
    return {
      resellerId: typeof parsed.reseller_id === "string" ? parsed.reseller_id : null,
      resellerSlug: typeof parsed.reseller_slug === "string" ? parsed.reseller_slug : null,
      productId: parsed.product_id as string,
      price,
    };
  } catch {
    return null;
  }
};

const withCheckoutTimeout = async <T,>(promise: PromiseLike<T>, fallback: T, ms = 4500): Promise<T> => {
  const timeout = new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]);
};

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { items: cartItems, removeItem, clearCart } = useCart();
  const queryClient = useQueryClient();
  const { resellerId, resellerSlug, loading: resellerContextLoading } = useResellerContext();
  const { branding: resellerBranding, loading: resellerBrandingLoading } = useResellerBranding();
  const [resolvedCheckoutResellerId, setResolvedCheckoutResellerId] = useState<string | null>(null);
  const [resellerPricingReady, setResellerPricingReady] = useState(false);
  const [resellerItemPrices, setResellerItemPrices] = useState<Record<string, number>>({});
  const activeResellerId = resolvedCheckoutResellerId || resellerId;
  const activeResellerSlug = useMemo(() => {
    const querySlug = getResellerSlugFromCheckoutSearch(searchParams);
    return resellerSlug || resellerBranding?.slug || querySlug || readStoredResellerValue("fbflix_reseller_slug");
  }, [resellerSlug, resellerBranding?.slug, searchParams]);
  const isResellerCheckout =
    Boolean(activeResellerId) ||
    Boolean(resellerBranding) ||
    isResellerHost() ||
    hasResellerCheckoutSignal(searchParams);
  const productId = searchParams.get("product") || "";
  const existingOrderId = searchParams.get("order") || "";
  const initialQty = parseInt(searchParams.get("qty") || "1");
  const [quantity, setQuantity] = useState(initialQty);

  const [product, setProduct] = useState<DbProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareCopied, setShareCopied] = useState(false);
  const [showWhatsAppPopup, setShowWhatsAppPopup] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userPhone, setUserPhone] = useState<string | null>(null);

  // Items in the cart that are NOT the main product being checked out.
  // These are inserted as additional order_items so fulfillment (saldo / PIX webhook /
  // cartão) processes each one through fulfill_order_item or the proper provider.
  const extraCartItems = useMemo(() => {
    if (!product) return [];
    // When using `?product=` (buy now flow), cartItems may contain unrelated items
    // that the user explicitly dropped in the cart — still treat them as extras.
    return cartItems.filter((ci) => ci.productId !== product.id);
  }, [cartItems, product]);
  const extraCartKey = useMemo(
    () => extraCartItems.map((ci) => `${ci.productId}:${ci.quantity}:${ci.price}`).join("|"),
    [extraCartItems],
  );

  const [userProfile, setUserProfile] = useState<any>(null);

  // Fetch user profile on mount
  useEffect(() => {
    async function fetchUserProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (profile) {
        setUserProfile(profile);
        setUserPhone(profile.phone || null);
        if (profile.referrer_id && !localStorage.getItem("partner_ref_id")) {
          localStorage.setItem("partner_ref_id", profile.referrer_id);
        }
      }
    }
    fetchUserProfile();
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        console.debug("[checkout] product load start", { productId, existingOrderId, reseller: searchParams.get("r") });

        // If resuming an existing order
        if (existingOrderId) {
          const { data: order } = await withCheckoutTimeout(
            supabase
              .from("orders")
              .select("id, code, total, subtotal, discount, payment_method, coupon_code")
              .eq("id", existingOrderId)
              .single(),
            { data: null, error: null } as any,
          );

          if (!order) return;

          setDraftOrderId(order.id);
          setDraftOrderCode(order.code);

          const { data: items } = await withCheckoutTimeout(
            supabase
              .from("order_items")
              .select("product_id, name, price, quantity")
              .eq("order_id", existingOrderId),
            { data: [], error: null } as any,
          );

          if (items && items.length > 0) {
            const mainItem = items[0];
            if (mainItem.product_id) {
              const { data: prod } = await withCheckoutTimeout(
                supabase
                  .from("products")
                  .select("id, name, description, price, image_url, stock, available, category_id, icon_type, external_id, tags, slug")
                  .eq("id", mainItem.product_id)
                  .single(),
                { data: null, error: null } as any,
              );
              if (prod) setProduct(prod);
            } else {
              setProduct({
                id: "unknown",
                name: mainItem.name,
                description: null,
                price: mainItem.price,
                image_url: null,
                stock: 999,
                available: true,
                category_id: null,
                icon_type: null,
                external_id: null,
                tags: null,
              });
            }
          }
          return;
        }

        // Normal flow
        if (!productId) {
          if (cartItems.length > 0) {
            const proxyPurchaseStr = sessionStorage.getItem("proxy_purchase");
            let proxyDescription: string | null = null;
            if (proxyPurchaseStr) {
              try {
                const pp = JSON.parse(proxyPurchaseStr);
                proxyDescription = pp.description || null;
              } catch {}
            }

            let dbDescription: string | null = null;
            let dbTags: string[] | null = null;
            let dbIconType: string | null = null;
            let dbExternalId: string | null = null;
            let dbSlug: string | null = null;
            let dbStock = 999;
            let dbAvailable = true;
            const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cartItems[0].productId);
            if (isValidUUID) {
              const { data: dbProd } = await withCheckoutTimeout(
                supabase
                  .from("products")
                  .select("description, tags, icon_type, external_id, slug, stock, available")
                  .eq("id", cartItems[0].productId)
                  .single(),
                { data: null, error: null } as any,
              );
              dbDescription = dbProd?.description || null;
              dbTags = dbProd?.tags || null;
              dbIconType = dbProd?.icon_type || null;
              dbExternalId = dbProd?.external_id || null;
              dbSlug = (dbProd as any)?.slug || null;
              dbStock = dbProd?.stock ?? 999;
              dbAvailable = dbProd?.available ?? true;
            }

            const isProxy = dbIconType === 'proxy';
            if (!isProxy && isValidUUID && (dbStock <= 0 || !dbAvailable)) {
              toast.error("Este produto está sem estoque no momento.");
              navigate("/loja");
              return;
            }

            setProduct({
              id: cartItems[0].productId,
              name: cartItems[0].name,
              description: dbDescription || proxyDescription,
              price: cartItems[0].price,
              image_url: cartItems[0].image,
              stock: dbStock,
              available: dbAvailable,
              category_id: null,
              icon_type: dbIconType,
              external_id: dbExternalId,
              tags: dbTags,
              slug: dbSlug,
            });
          }
          return;
        }

        const { data } = await withCheckoutTimeout(
          supabase
            .from("products")
            .select("id, name, description, price, image_url, stock, available, category_id, icon_type, external_id, tags, slug")
            .eq("id", productId)
            .single(),
          { data: null, error: null } as any,
        );

        if (data) {
          const isProxy = data.icon_type === 'proxy';
          if (!isProxy && (data.stock <= 0 || !data.available)) {
            toast.error("Este produto está sem estoque no momento.");
            navigate("/loja");
            return;
          }
          setProduct(data);
          console.debug("[checkout] product load success", { productId: data.id });
        }
      } catch (error) {
        console.error("[checkout] product load failed", error);
      } finally {
        setLoading(false);
      }
    }

    if (searchParams.get("type") === "safe_bm_renewal") {
      const amount = parseFloat(searchParams.get("amount") || "0");
      setProduct({
        id: "safe-bm-renewal",
        name: "Renovação Safe BM",
        description: "Renovação mensal de proteção de Business Managers",
        price: amount,
        image_url: null,
        stock: 999,
        available: true,
        category_id: null,
        icon_type: "shield",
        external_id: null,
        tags: ["renewal", "safebm"],
      });
      setLoading(false);
      return;
    }

    fetchData();


  }, [productId, existingOrderId, cartItems]);

  // Apply reseller prices before showing/creating the order. The checkout must
  // charge exactly the public store price configured by the reseller, never the
  // original FBFlix product price.
  useEffect(() => {
    if (!product) {
      setResellerPricingReady(false);
      return;
    }
    if (!isResellerCheckout) {
      setResellerPricingReady(true);
      setResellerItemPrices({});
      return;
    }
    if ((resellerContextLoading || resellerBrandingLoading) && !activeResellerSlug && !activeResellerId) {
      setResellerPricingReady(false);
      console.debug("[checkout] reseller pricing waiting for context");
      return;
    }
    let cancelled = false;
    const checkoutPriceSnapshot = getResellerCheckoutPriceSnapshot(product.id);
    if (checkoutPriceSnapshot) {
      setResellerItemPrices((current) => ({ ...current, [product.id]: checkoutPriceSnapshot.price }));
      if (checkoutPriceSnapshot.resellerId) setResolvedCheckoutResellerId(checkoutPriceSnapshot.resellerId);
      setProduct((current) => {
        if (!current || current.id !== checkoutPriceSnapshot.productId) return current;
        if (Math.abs(Number(current.price || 0) - checkoutPriceSnapshot.price) < 0.001) return current;
        return { ...current, price: checkoutPriceSnapshot.price };
      });
    } else {
      setResellerPricingReady(false);
    }
    (async () => {
      try {
        console.debug("[checkout] reseller pricing start", {
          productId: product.id,
          activeResellerId,
          activeResellerSlug,
        });
        let resolvedId = activeResellerId;
        let resellerPricing: any = null;
        let pricingSlug = String(activeResellerSlug || "").trim().toLowerCase();

        if (!pricingSlug && isResellerHost()) {
          const host = window.location.hostname.toLowerCase();
          const { data: domainSlug } = await withCheckoutTimeout(
            supabase.rpc("get_reseller_slug_by_domain", { _domain: host }),
            { data: null, error: null } as any,
          );
          if (domainSlug) pricingSlug = String(domainSlug).trim().toLowerCase();
        }

        if (pricingSlug) {
          const { data } = await withCheckoutTimeout(
            supabase.rpc("get_reseller_public_by_slug", { _slug: pricingSlug }),
            { data: null, error: null } as any,
          );
          const publicReseller = Array.isArray(data) ? data[0] : data;
          if (publicReseller?.id) {
            resolvedId = publicReseller.id;
            resellerPricing = publicReseller;
            pricingSlug = String(publicReseller.slug || pricingSlug).trim().toLowerCase();
          }
        }

        if (!resellerPricing || !resolvedId) {
          console.debug("[checkout] reseller pricing fallback without reseller data", {
            activeResellerId,
            activeResellerSlug,
          });
          if (!cancelled) setResellerPricingReady(true);
          return;
        }

        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const productIds = [product.id, ...extraCartItems.map((ci) => ci.productId)].filter((id) => uuidRe.test(id));

        if (!pricingSlug) {
          console.warn("[checkout] reseller pricing skipped: missing slug", { activeResellerId, activeResellerSlug });
          if (!cancelled) setResellerPricingReady(true);
          return;
        }

        if (productIds.length === 0) {
          console.warn("[checkout] reseller pricing skipped: no UUID products", { productId: product.id });
          if (!cancelled) setResellerPricingReady(true);
          return;
        }

        const { data: checkoutPriceRows } = await withCheckoutTimeout(
          (supabase as any).rpc("get_reseller_checkout_prices", {
            _slug: pricingSlug,
            _product_ids: productIds,
          }),
          { data: [], error: null } as any,
        );

        if (cancelled) return;

        const priceRows = Array.isArray(checkoutPriceRows) ? checkoutPriceRows : [];
        const priceMap = new Map<string, any>();
        priceRows.forEach((row: any) => priceMap.set(row.product_id, row));

        const getFinalResellerPrice = (id: string) => {
          const row = priceMap.get(id);
          if (!row || !row.enabled) return null;
          const value = Number(row.final_price);
          return Number.isFinite(value) ? value : null;
        };

        const nextPrices: Record<string, number> = {};
        const mainPrice = getFinalResellerPrice(product.id);
        if (mainPrice === null) {
          toast.error("Este item não está disponível na loja do revendedor.");
          navigate(activeResellerSlug ? `/r/${activeResellerSlug}` : "/");
          return;
        }

        nextPrices[product.id] = mainPrice;
        extraCartItems.forEach((ci) => {
          const finalPrice = getFinalResellerPrice(ci.productId);
          if (finalPrice !== null) nextPrices[ci.productId] = finalPrice;
        });

        const rpcResolvedId = priceRows[0]?.reseller_id ? String(priceRows[0].reseller_id) : resolvedId;
        setResolvedCheckoutResellerId(rpcResolvedId);
        setResellerItemPrices(nextPrices);
        console.debug("[checkout] reseller pricing ready", { resolvedId: rpcResolvedId, prices: nextPrices });
        try {
          localStorage.setItem("fbflix_reseller_id", rpcResolvedId);
          if (resellerPricing.slug || pricingSlug) {
            localStorage.setItem("fbflix_reseller_slug", resellerPricing.slug || pricingSlug);
          }
        } catch { /* noop */ }

        setProduct((current) => {
          if (!current) return current;
          if (Math.abs(Number(current.price || 0) - mainPrice) < 0.001) return current;
          return { ...current, price: mainPrice };
        });
      } catch (error) {
        console.error("Reseller checkout pricing error", error);
      } finally {
        if (!cancelled) setResellerPricingReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isResellerCheckout, activeResellerId, activeResellerSlug, resellerContextLoading, resellerBrandingLoading, product?.id, extraCartKey]);

  const [paymentMethod, setPaymentMethod] = useState<"saldo" | "pix" | "cartao">("saldo");
  const [selectedBumps, setSelectedBumps] = useState<string[]>([]);
  const [bumpProducts, setBumpProducts] = useState<BumpProduct[]>([]);
  const [promoProxy, setPromoProxy] = useState<BumpProduct | null>(null);
  
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [cardName, setCardName] = useState("");
  const [cardCpf, setCardCpf] = useState("");
  const [cardEmail, setCardEmail] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardInstallments, setCardInstallments] = useState(1);
  const stripeCardRef = useRef<StripeCardFieldsHandle>(null);
  const [targetCity, setTargetCity] = useState("all");
  const [showCityOnCheckout, setShowCityOnCheckout] = useState(false);

  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [availableUSCities, setAvailableUSCities] = useState<string[]>([]);

  useEffect(() => {
    const fetchAvailableLocations = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("proxyfbflix-api", {
          body: { action: "get-available-locations" }
        });
        if (error) throw error;
        if (data?.success && data?.locations) {
          setAvailableCities(data.locations["BR"] || []);
          setAvailableUSCities(data.locations["US"] || []);
        }
      } catch (err) {
        console.error("Error fetching available locations:", err);
      }
    };
    if (showCityOnCheckout) {
      fetchAvailableLocations();
    }
  }, [showCityOnCheckout]);

  const dynamicCities = useMemo(() => {
    const brCities = availableCities.map(city => ({ value: city, label: `🇧🇷 ${city}` }));
    const usCities = availableUSCities.map(city => ({ value: city, label: `🇺🇸 ${city}` }));
    
    return [
      { value: "all", label: "🇧🇷 Aleatório (Brasil)" },
      ...brCities,
      { value: "all_us", label: "🇺🇸 Aleatório (EUA)" },
      ...usCities
    ];
  }, [availableCities, availableUSCities]);

  const CITIES = [
    { value: "all", label: "🇧🇷 Aleatório (Brasil)" },
    { value: "São Paulo", label: "🇧🇷 São Paulo" },
    { value: "Rio de Janeiro", label: "🇧🇷 Rio de Janeiro" },
    { value: "Belo Horizonte", label: "🇧🇷 Belo Horizonte" },
    { value: "Curitiba", label: "🇧🇷 Curitiba" },
    { value: "Porto Alegre", label: "🇧🇷 Porto Alegre" },
    { value: "Brasília", label: "🇧🇷 Brasília" },
    { value: "Fortaleza", label: "🇧🇷 Fortaleza" },
    { value: "Salvador", label: "🇧🇷 Salvador" },
    { value: "Recife", label: "🇧🇷 Recife" },
    { value: "Goiânia", label: "🇧🇷 Goiânia" },
    { value: "all_us", label: "🇺🇸 Aleatório (EUA)" },
    { value: "New York", label: "🇺🇸 New York" },
    { value: "Los Angeles", label: "🇺🇸 Los Angeles" },
    { value: "Chicago", label: "🇺🇸 Chicago" },
    { value: "Miami", label: "🇺🇸 Miami" },
    { value: "Dallas", label: "🇺🇸 Dallas" },
    { value: "Atlanta", label: "🇺🇸 Atlanta" },
    { value: "Seattle", label: "🇺🇸 Seattle" },
    { value: "San Francisco", label: "🇺🇸 San Francisco" },
    { value: "Houston", label: "🇺🇸 Houston" },
    { value: "Phoenix", label: "🇺🇸 Phoenix" }
  ];
  const [processing, setProcessing] = useState(false);
  const [pixModal, setPixModal] = useState(false);
   const [pixData, setPixData] = useState<{ qr_code: string | null; qr_code_base64: string | null; amount: number; payment_link?: string } | null>(null);
  const [pixPaymentId, setPixPaymentId] = useState<string | null>(null);
  const [pixConfirmed, setPixConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [draftOrderId, setDraftOrderId] = useState<string | null>(null);
  const [draftOrderCode, setDraftOrderCode] = useState<string | null>(null);
  const [isFirstPurchase, setIsFirstPurchase] = useState(false);
  const [cardEnabled, setCardEnabled] = useState(false);
  const [lauthEmail, setLauthEmail] = useState<string | null>(null);
  const [lauthEnabled, setLauthEnabled] = useState(false);
  const draftCreatingRef = useRef(false);

  // Cartão: recorrente apenas em Safe BM / Scale Pro; avulso em Perfil e BM
  const isRecurringCardProduct = /safe\s*bm|scale\s*pro/i.test(product?.name || "");
  const isOneOffCardProduct = /perfil|business\s*manager|\bbm\b|bms\b/i.test(product?.name || "");
  const cardAllowedForProduct = isRecurringCardProduct || isOneOffCardProduct;

  // Check if first purchase
  useEffect(() => {
    const checkFirstPurchase = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (user.email) setCardEmail(user.email);
      const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("status", ["completed", "paid"]);
      setIsFirstPurchase((count ?? 0) === 0);
      const { data: profile } = await supabase
        .from("profiles")
        .select("card_payment_enabled, cpf, full_name, lauth_email, lauth_enabled, preferred_proxy_city, show_proxy_city_on_checkout")
        .eq("user_id", user.id)
        .single();
      // Cartão via Appmax: liberado apenas para perfis habilitados
      setCardEnabled(!!(profile as any)?.card_payment_enabled);
      if (profile?.cpf) setCardCpf(profile.cpf);
      if (profile?.full_name) setCardName((prev) => prev || profile.full_name || "");
      setLauthEmail((profile as any)?.lauth_email || null);
      setLauthEnabled((profile as any)?.lauth_enabled || false);
      if ((profile as any)?.preferred_proxy_city) {
        setTargetCity((profile as any).preferred_proxy_city);
      }
      setShowCityOnCheckout((profile as any)?.show_proxy_city_on_checkout ?? false);
    };
    checkFirstPurchase();
  }, []);

  // Fetch bumps: prefer admin-configured, fallback to smart auto-detection
  useEffect(() => {
    if (isResellerCheckout) {
      setSelectedBumps([]);
      setBumpProducts([]);
      setPromoProxy(null);
      return;
    }
    if (!product) return;
    const fetchBumps = async () => {
      // 1. Check for admin-configured bumps
      const { data: configuredBumps } = await supabase
        .from("order_bumps")
        .select("*")
        .eq("product_id", product.id)
        .eq("active", true)
        .order("position", { ascending: true });

      if (configuredBumps && configuredBumps.length > 0) {
        // Fetch bump product details
        const bumpProductIds = configuredBumps.map((b: any) => b.bump_product_id);
        const { data: bumpProds } = await supabase
          .from("products")
          .select("id, name, description, price, image_url, tags, icon_type")
          .in("id", bumpProductIds);

        const productsMap = new Map((bumpProds || []).map((p: any) => [p.id, p]));

         // Auto-select combos
         const comboBumpIds = configuredBumps.filter((b: any) => b.is_combo).map((b: any) => b.bump_product_id);
         if (comboBumpIds.length > 0) {
           setSelectedBumps(prev => {
             const next = [...prev];
             comboBumpIds.forEach(id => { if (!next.includes(id)) next.push(id); });
             return next;
           });
         }

         // Set main promo bump
         const mainBump = configuredBumps.find((b: any) => b.bump_type === "main");
         if (mainBump) {
           const mainProd = productsMap.get(mainBump.bump_product_id);
           if (mainProd) {
             const bumpPrice = mainBump.fixed_price != null
               ? mainBump.fixed_price
               : mainProd.price * (1 - (mainBump.discount_percent || 0) / 100);
             setPromoProxy({
               ...mainProd,
               price: bumpPrice,
               _originalPrice: mainProd.price,
               _label: mainBump.label || (mainBump.is_combo ? "COMBO ATIVADO" : "OPORTUNIDADE ÚNICA"),
               _isCombo: mainBump.is_combo,
             } as any);
           }
         } else {
           setPromoProxy(null);
         }

        // Set secondary bumps with discounts applied
        const secondaryBumps = configuredBumps
          .filter((b: any) => b.bump_type === "secondary")
          .map((b: any) => {
            const prod = productsMap.get(b.bump_product_id);
            if (!prod) return null;
            const finalPrice = b.fixed_price != null
              ? b.fixed_price
              : prod.price * (1 - (b.discount_percent || 0) / 100);
               return {
                 ...prod,
                 price: finalPrice,
                 _originalPrice: prod.price,
                 _hasDiscount: b.fixed_price != null || b.discount_percent > 0,
                 _isCombo: b.is_combo,
               };
          })
          .filter(Boolean);
        setBumpProducts(secondaryBumps);
        return;
      }

      // 2. Fallback: smart auto-detection (existing logic)
      const { data } = await supabase
        .from("products")
        .select("id, name, description, price, image_url, tags, icon_type")
        .eq("available", true)
        .gt("stock", 0)
        .neq("id", product.id)
        .order("price", { ascending: true })
        .limit(10);
      const baseBumps = data || [];
      // Garante que o SafeBM esteja sempre disponível como oferta "Combo" se não for o produto principal
      const SAFEBM_ID = "e5118c63-ed52-4f4e-8983-f44c1ba0d17b";
      if (product.id !== SAFEBM_ID && !baseBumps.some(b => b.id === SAFEBM_ID)) {
        const { data: safeBmProd } = await supabase
          .from("products")
          .select("id, name, description, price, image_url, tags, icon_type")
          .eq("id", SAFEBM_ID)
          .maybeSingle();
        
        if (safeBmProd) {
          // Transformar em "Combo" (3 meses) conforme solicitado
          const comboSafeBm = {
            ...safeBmProd,
            name: "Combo SafeBM (3 Meses)",
            price: 29.97,
            description: "Proteção completa para sua BM por 3 meses (Mínimo recomendado)",
            _hasDiscount: true,
            _originalPrice: 29.97,
            _isCombo: true,
            _comboQty: 3
          };
          baseBumps.push(comboSafeBm as any);
        }
      }
      setBumpProducts(baseBumps);

      // Fallback promo proxy
      const PROMO_PROXY_ID = "6c396fa8-f6a0-43b2-8061-9148213df549";
      if (product.id === PROMO_PROXY_ID) { setPromoProxy(null); return; }
      const { data: promoData } = await supabase
        .from("products")
        .select("id, name, description, price, image_url, tags, icon_type")
        .eq("id", PROMO_PROXY_ID)
        .maybeSingle();
      setPromoProxy(promoData || null);
    };
    fetchBumps();
  }, [product, isResellerCheckout]);

  // Create draft order when entering checkout (for abandoned cart tracking)
  // Skip if resuming an existing order
  useEffect(() => {
    if (!product || draftOrderId || draftCreatingRef.current || existingOrderId) return;
    if (isResellerCheckout && resellerItemPrices[product.id] == null) return;

    const createDraftOrder = async () => {
      draftCreatingRef.current = true;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const orderCode = `ORD-${Date.now().toString(36).toUpperCase()}`;
        const partnerRefId = localStorage.getItem("partner_ref_id");

        const mainUnitPrice = isResellerCheckout
          ? Number(resellerItemPrices[product.id] ?? product.price)
          : Number(product.price || 0);
        const extraItemsTotal = extraCartItems.reduce((sum, ci) => {
          const unitPrice = isResellerCheckout ? Number(resellerItemPrices[ci.productId] ?? ci.price) : Number(ci.price || 0);
          return sum + unitPrice * ci.quantity;
        }, 0);
        const draftSubtotal = mainUnitPrice * quantity + extraItemsTotal;

        const { data: order, error } = await supabase.from("orders").insert({
          code: orderCode,
          user_id: user.id,
          subtotal: draftSubtotal,
          discount: 0,
          total: draftSubtotal,
          payment_method: null,
          status: "processing",
          coupon_code: null,
          partner_id: partnerRefId || null,
          reseller_id: activeResellerId || null,
        }).select("id").single();

        if (error) {
          console.error("Error creating draft order:", error);
          return;
        }

        // Partner journey: checkout iniciado
        if (partnerRefId) {
          try {
            const { trackPartnerEvent } = await import("@/lib/partnerTracking");
            trackPartnerEvent("checkout", {
              partnerId: partnerRefId,
              productId: product.id,
              productName: product.name,
              amount: mainUnitPrice * quantity,
              metadata: { order_id: order.id, quantity },
            });
          } catch { /* noop */ }
        }

        // Link pending Safe BM renewals to this order
        const pendingRenewalsStr = sessionStorage.getItem("pending_safe_bm_renewals");
        if (pendingRenewalsStr) {
          try {
            const renewalIds = JSON.parse(pendingRenewalsStr);
            if (Array.isArray(renewalIds) && renewalIds.length > 0) {
              await supabase
                .from("safe_bm_renewals")
                .update({ order_id: order.id })
                .in("id", renewalIds);
              console.log("Linked Safe BM renewals to order:", order.id);
            }
          } catch (e) {
            console.error("Error linking Safe BM renewals:", e);
          }
        }

        // Insert order items - use null for product_id if not a valid UUID
        const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(product.id);
        
        // Store proxy purchase data in delivery_data so the webhook can contract server-side
        const proxyPurchaseStr = sessionStorage.getItem("proxy_purchase");
        let deliveryData: any = null;
        if (proxyPurchaseStr) {
          try {
            const pp = JSON.parse(proxyPurchaseStr);
            deliveryData = {
              type: "proxy_contract",
              product_variant_id: pp.product_variant_id,
              api_product_id: pp.api_product_id,
              variant_location: pp.variant_location,
              quantity: pp.quantity || 1,
              interval: pp.interval || "monthly",
            };
          } catch {}
        }
        
        // For non-proxy products with qty > 1, create separate order_items (1 per unit)
        // so each gets its own delivery_data during fulfillment
        const isProxy = product.icon_type === 'proxy' || !!deliveryData;
        const orderItems: any[] = [];
        if (isProxy || quantity <= 1) {
          orderItems.push({ order_id: order.id, product_id: isValidUUID ? product.id : null, name: product.name, price: mainUnitPrice, quantity, delivery_data: deliveryData });
        } else {
          for (let i = 0; i < quantity; i++) {
            orderItems.push({ order_id: order.id, product_id: isValidUUID ? product.id : null, name: product.name, price: mainUnitPrice, quantity: 1, delivery_data: null });
          }
        }
        const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
        if (itemsError) {
          console.error("Error inserting order items:", itemsError);
          throw itemsError;
        }

        // Insert extra cart items (each as its own order_item, no delivery_data
        // — server fulfillment will run fulfill_order_item / ProxyFbflix / SafeBM
        // automatically based on product_id).
        if (extraCartItems.length > 0) {
          const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const extraOrderItems = extraCartItems.map((ci) => ({
            order_id: order.id,
            product_id: uuidRe.test(ci.productId) ? ci.productId : null,
            name: ci.name,
            price: isResellerCheckout ? Number(resellerItemPrices[ci.productId] ?? ci.price) : ci.price,
            quantity: ci.quantity,
            delivery_data: null,
          }));
          const { error: extraErr } = await supabase.from("order_items").insert(extraOrderItems);
          if (extraErr) console.error("Error inserting extra cart order_items:", extraErr);
        }

        setDraftOrderId(order.id);
        setDraftOrderCode(orderCode);
      } catch (err) {
        console.error("Draft order error:", err);
      } finally {
        draftCreatingRef.current = false;
      }
    };

    createDraftOrder();
  }, [product, isResellerCheckout, resellerItemPrices, activeResellerId]);

  // Helper to get proxy purchase data from sessionStorage
  const getProxyPurchaseData = () => {
    const str = sessionStorage.getItem("proxy_purchase");
    if (!str) return null;
    try { return JSON.parse(str); } catch { return null; }
  };

  // Poll for PIX payment confirmation
  useEffect(() => {
    if (!pixModal || !pixPaymentId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase.from("payments").select("status").eq("id", pixPaymentId).single();
      if (data?.status === "completed") {
        clearInterval(interval);
        setPixConfirmed(true);
        
        // Proxy contracting is handled by the webhook via delivery_data
        const isProxyPurchase = !!sessionStorage.getItem("proxy_purchase");
        sessionStorage.removeItem("proxy_purchase");
        
        toast.success("Pagamento confirmado! Pedido criado.");
        if (isProxyPurchase) {
          queryClient.invalidateQueries({ queryKey: ["proxybr-subscriptions"] });
        }
        setTimeout(() => {
          setPixModal(false);
          navigate(isProxyPurchase ? "/subscriptions" : "/orders");
        }, 3000);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [pixModal, pixPaymentId]);


  // Smart complementary bumps: detect main product type and show only different categories
  const relevantBumps = useMemo(() => {
    if (isResellerCheckout) return [];
    if (!product || bumpProducts.length === 0) return [];

    const mainName = (product.name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const mainTags = (product.tags || []).map(t => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
    const mainIcon = (product.icon_type || "").toLowerCase();

    // Detect main product type
    const isMainProxy = mainIcon === "proxy" || mainName.includes("proxy") || mainTags.some(t => t.includes("proxy"));
    const isMainPerfil = mainName.includes("perfil") || mainTags.some(t => t.includes("perfil") || t.includes("profile"));
    const isMainBM = mainName.includes("bm") || mainName.includes("business manager") || mainTags.some(t => t.includes("bm") || t.includes("business"));
    const isMainPagina = mainName.includes("pagina") || mainName.includes("página") || mainName.includes("fanpage") || mainTags.some(t => t.includes("pagina") || t.includes("fanpage"));

    // Filter bumps to only show complementary products (different category)
    // Also exclude products already in the cart
    const cartProductIds = cartItems.map(ci => ci.productId);

    const classifyBump = (bump: BumpProduct) => {
      const bName = (bump.name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const bDesc = (bump.description || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const bIcon = (bump.icon_type || "").toLowerCase();
      const bTags = (bump.tags || []).map(t => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

      const isProxy = bIcon === "proxy" || bName.includes("proxy") || bTags.some(t => t.includes("proxy"));
      const isPerfil = bIcon === "perfil" || bName.includes("perfil") || bTags.some(t => t.includes("perfil") || t.includes("profile"));
      const isBM = bIcon === "bm" || bName.includes("bm") || bName.includes("business manager") || bTags.some(t => t.includes("bm") || t.includes("business"));
      const isPagina = bIcon === "pagina" || bName.includes("pagina") || bName.includes("fanpage") || bTags.some(t => t.includes("pagina") || t.includes("fanpage") || t.includes("página"));

      return { isProxy, isPerfil, isBM, isPagina };
    };

    const filtered = bumpProducts.filter(bump => {
      // Exclude items already in cart
      if (cartProductIds.includes(bump.id)) return false;

      const { isProxy, isPerfil, isBM, isPagina } = classifyBump(bump);

      // Exclude same type as main product
      if (isMainProxy && isProxy) return false;
      if (isMainPerfil && isPerfil) return false;
      // Permite SafeBM mesmo se o produto principal for BM, pois é um serviço complementar de proteção
      const isSafeBM = (bump.name || "").toLowerCase().includes("safe") || bump.id === "e5118c63-ed52-4f4e-8983-f44c1ba0d17b";
      if (isMainBM && isBM && !isSafeBM) return false;
      if (isMainPagina && isPagina) return false;

      return true;
    });

    // Score bumps by complementarity relevance
    const scored = filtered.map(bump => {
      const { isProxy: isBumpProxy, isPerfil: isBumpPerfil, isBM: isBumpBM, isPagina: isBumpPagina } = classifyBump(bump);
      let score = 0;

      if (isMainPerfil) {
        // Perfil → BM > Proxy > Página
        if (isBumpBM) score = 30;
        else if (isBumpProxy) score = 20;
        else if (isBumpPagina) score = 15;
        else score = 5;
      } else if (isMainProxy) {
        // Proxy → Perfil > BM > Página
        if (isBumpPerfil) score = 30;
        else if (isBumpBM) score = 25;
        else if (isBumpPagina) score = 15;
        else score = 5;
      } else if (isMainBM) {
        const isSafeBM = (bump.name || "").toLowerCase().includes("safe") || bump.id === "e5118c63-ed52-4f4e-8983-f44c1ba0d17b";
        // BM → SafeBM > Perfil > Proxy > Página
        if (isSafeBM) score = 50;
        else if (isBumpPerfil) score = 30;
        else if (isBumpProxy) score = 20;
        else if (isBumpPagina) score = 15;
        else score = 5;
      } else if (isMainPagina) {
        // Página → Perfil > BM > Proxy
        if (isBumpPerfil) score = 30;
        else if (isBumpBM) score = 25;
        else if (isBumpProxy) score = 15;
        else score = 5;
      } else {
        // Generic: show variety
        score = 10;
      }

      return { bump, score };
    });

    // Sort by score descending, limit to 6 most relevant
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(s => s.bump);
  }, [product, bumpProducts, isResellerCheckout]);

  const subtotal = useMemo(() => {
    if (!product) return 0;
    
    const isProxy = product.icon_type === 'proxy' || !!getProxyPurchaseData();
    // FBFlix per-client proxy pricing does NOT apply on reseller checkouts —
    // the price shown in the reseller store (already applied to product.price)
    // must be honored exactly.
    const multiplier = isResellerCheckout ? 1 : (Number(userProfile?.proxy_price_multiplier ?? 1) || 1);
    const fixedPrice = isResellerCheckout
      ? null
      : (userProfile?.proxy_fixed_price ? Number(userProfile.proxy_fixed_price) : null);
    
    // Apply special pricing for proxies
    const resellerMainPrice = Number(resellerItemPrices[product.id] ?? product.price);
    const adjustedProductPrice = isResellerCheckout
      ? resellerMainPrice
      : isProxy && fixedPrice !== null ? fixedPrice : product.price * (isProxy ? multiplier : 1);
    
    let total = adjustedProductPrice * quantity;

    extraCartItems.forEach((ci) => {
      const ciIsProxy = ci.isProxy;
      const resellerCartPrice = Number(resellerItemPrices[ci.productId] ?? ci.price);
      const ciPrice = isResellerCheckout
        ? resellerCartPrice
        : ciIsProxy && fixedPrice !== null ? fixedPrice : ci.price * (ciIsProxy ? multiplier : 1);
      total += ciPrice * ci.quantity;
    });

    if (!isResellerCheckout) {
      selectedBumps.forEach((bumpId) => {
        const bump = bumpProducts.find((b) => b.id === bumpId);
        if (bump) total += bump.price;
      });
    }

    return total;
  }, [product, quantity, selectedBumps, bumpProducts, extraCartItems, userProfile, isResellerCheckout, resellerItemPrices]);

  const total = subtotal - discount;

  const mainDisplayUnitPrice = product
    ? Number(isResellerCheckout ? resellerItemPrices[product.id] ?? product.price : product.price)
    : 0;
  const mainDisplayTotal = mainDisplayUnitPrice * quantity;

  const getCartDisplayUnitPrice = (item: { productId: string; price: number }) =>
    Number(isResellerCheckout ? resellerItemPrices[item.productId] ?? item.price : item.price);

  const resellerPricePending = Boolean(
    isResellerCheckout && product && resellerItemPrices[product.id] == null,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Produto não encontrado.</p>
        <button onClick={() => navigate("/loja")} className="text-primary mt-4 hover:underline">Voltar à loja</button>
      </div>
    );
  }

  const toggleBump = (bumpId: string) => {
    setSelectedBumps((prev) =>
      prev.includes(bumpId) ? prev.filter((id) => id !== bumpId) : [...prev, bumpId]
    );
  };

  const applyCoupon = async () => {
    if (!coupon.trim()) return;
    setApplyingCoupon(true);
    try {
      const { data: rows, error } = await supabase
        .rpc("validate_coupon", { _code: coupon.trim().toUpperCase(), _reseller_id: activeResellerId || null });

      if (error) throw error;

      const data = Array.isArray(rows) ? rows[0] : rows;

      if (!data) {
        setDiscount(0);
        setCouponApplied(false);
        toast.error("Cupom inválido ou expirado");
        return;
      }

      // Check expiry
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setDiscount(0);
        setCouponApplied(false);
        toast.error("Este cupom já expirou");
        return;
      }

      // Check usage limit
      if (data.used_count >= data.max_uses) {
        setDiscount(0);
        setCouponApplied(false);
        toast.error("Este cupom atingiu o limite de usos");
        return;
      }

      // Apply discount
      let discountAmount = 0;
      if (data.discount_type === "percent") {
        discountAmount = (subtotal * data.discount_value) / 100;
      } else {
        discountAmount = data.discount_value;
      }

      // Cap discount at subtotal
      discountAmount = Math.min(discountAmount, subtotal);

      // Reseller safety: the final price can never go below the sum of
      // reseller costs (what the reseller pays FBFlix for each item).
      if (isResellerCheckout && activeResellerId && product) {
        const productIds = [product.id, ...extraCartItems.map((ci) => ci.productId)]
          .filter((id) => id && !id.startsWith("safe-bm") && !id.startsWith("scale-pro"));
        if (productIds.length > 0) {
          const { data: costRows } = await supabase
            .from("products")
            .select("id, reseller_cost")
            .in("id", productIds);
          const costMap = new Map<string, number>();
          (costRows || []).forEach((r: any) => costMap.set(r.id, Number(r.reseller_cost) || 0));
          let costFloor = (costMap.get(product.id) || 0) * quantity;
          extraCartItems.forEach((ci) => {
            costFloor += (costMap.get(ci.productId) || 0) * ci.quantity;
          });
          const maxDiscount = Math.max(0, subtotal - costFloor);
          if (discountAmount > maxDiscount) {
            if (maxDiscount <= 0) {
              setDiscount(0);
              setCouponApplied(false);
              toast.error("Este cupom não pode ser aplicado: o valor final ficaria abaixo do custo dos produtos.");
              return;
            }
            discountAmount = maxDiscount;
            toast.info("Desconto ajustado para respeitar o custo mínimo dos produtos.");
          }
        }
      }

      setDiscount(discountAmount);
      setCouponApplied(true);
      toast.success(`Cupom ${data.code} aplicado! -R$ ${discountAmount.toFixed(2).replace(".", ",")}`);
    } catch (err) {
      console.error("Coupon error:", err);
      toast.error("Erro ao validar cupom");
    } finally {
      setApplyingCoupon(false);
    }
  };

  

  const handlePay = async () => {
    if (isResellerCheckout && product && resellerItemPrices[product.id] == null) {
      toast.error("Aguarde o preço da loja carregar para finalizar.");
      return;
    }

    setProcessing(true);

    // Safety timeout: if processing takes more than 60s, force stop spinning
    const safetyTimeout = setTimeout(() => {
      setProcessing(false);
      toast.error("O processamento demorou demais. Verifique seu pedido em 'Meus Pedidos' ou tente novamente.");
    }, 60000);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Faça login para continuar");
        navigate("/auth");
        return;
      }

      // Check if user has WhatsApp
      if (!userPhone) {
        setShowWhatsAppPopup(true);
        setProcessing(false);
        clearTimeout(safetyTimeout);
        return;
      }

      if (!draftOrderId || !draftOrderCode) {
        toast.error("Erro ao preparar pedido. Recarregue a página.");
        return;
      }

      // RESELLER GUARD: block sale if reseller has insufficient recharge balance
      // to cover the FBFlix cost of the items being purchased.
      if (isResellerCheckout && activeResellerId && product) {
        try {
          const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const capacityItems = [
            { id: product.id, quantity },
            ...extraCartItems.map((ci) => ({ id: ci.productId, quantity: ci.quantity })),
          ].filter((item) => uuidRe.test(item.id));

          const { data: capacityRows, error: capacityError } = await (supabase as any).rpc(
            "check_reseller_checkout_capacity",
            {
              _reseller_id: activeResellerId,
              _product_ids: capacityItems.map((item) => item.id),
              _quantities: capacityItems.map((item) => item.quantity),
            },
          );

          if (capacityError) throw capacityError;

          const capacity = Array.isArray(capacityRows) ? capacityRows[0] : capacityRows;
          if (capacity && capacity.can_cover === false) {
            toast.error(
              `Compra indisponível no momento. Entre em contato com o suporte.`,
              { duration: 6000 }
            );
            console.warn("[reseller-guard] insufficient recharge balance", {
              resellerId: activeResellerId,
              totalCost: Number(capacity.total_cost || 0),
            });
            setProcessing(false);
            clearTimeout(safetyTimeout);
            return;
          }
        } catch (e) {
          console.error("[reseller-guard] check failed", e);
        }
      }

      // Re-validate stock right before payment
      const { data: orderItemsToCheck } = await supabase
        .from("order_items")
        .select("id, product_id, name, quantity")
        .eq("order_id", draftOrderId);

      if (orderItemsToCheck) {
        for (const oi of orderItemsToCheck) {
          if (!oi.product_id) continue;
          const { data: prodCheck } = await supabase
            .from("products")
            .select("stock, available, icon_type")
            .eq("id", oi.product_id)
            .single();

          const isProxy = prodCheck?.icon_type === 'proxy';
          if (!prodCheck || (!isProxy && (prodCheck.stock <= 0 || !prodCheck.available))) {
            toast.error(`"${oi.name}" está sem estoque. Remova do carrinho e tente novamente.`);
            setProcessing(false);
            return;
          }
        }
      }

      const orderId = draftOrderId;
      const orderCode = draftOrderCode;

      if (isResellerCheckout && product) {
        const mainCheckoutPrice = Number(resellerItemPrices[product.id] ?? product.price);
        await supabase
          .from("order_items")
          .update({ price: mainCheckoutPrice })
          .eq("order_id", orderId)
          .eq("product_id", product.id);

        for (const ci of extraCartItems) {
          const itemCheckoutPrice = Number(resellerItemPrices[ci.productId] ?? ci.price);
          await supabase
            .from("order_items")
            .update({ price: itemCheckoutPrice })
            .eq("order_id", orderId)
            .eq("product_id", ci.productId);
        }
      }

      // Ensure every extra cart item exists as an order_item. The draft order is
      // created as soon as the product loads, which can happen before the cart
      // finishes hydrating — in that case only the main item was persisted and
      // the charged amount would ignore the rest of the cart.
      if (extraCartItems.length > 0) {
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const existingIds = new Set(
          (orderItemsToCheck || []).map((oi: any) => oi.product_id).filter(Boolean)
        );
        const missing = extraCartItems
          .filter((ci) => !existingIds.has(ci.productId))
          .map((ci) => ({
            order_id: orderId,
            product_id: uuidRe.test(ci.productId) ? ci.productId : null,
            name: ci.name,
            price: isResellerCheckout ? Number(resellerItemPrices[ci.productId] ?? ci.price) : ci.price,
            quantity: ci.quantity,
            delivery_data: null,
          }));
        if (missing.length > 0) {
          const { error: missingErr } = await supabase.from("order_items").insert(missing);
          if (missingErr) throw missingErr;
        }
      }

      // Add bump order items if any (before totals are recomputed)
      const extraItems: any[] = [];
      if (!isResellerCheckout) {
        selectedBumps.forEach(bumpId => {
          const bump = bumpProducts.find(b => b.id === bumpId);
          if (bump) {
            const qty = (bump as any)._isCombo ? ((bump as any)._comboQty || 1) : 1;
            extraItems.push({ order_id: orderId, product_id: bump.id, name: bump.name, price: bump.price, quantity: qty });
          }
        });
      }
      if (extraItems.length > 0) {
        const { error: extraItemsError } = await supabase.from("order_items").insert(extraItems);
        if (extraItemsError) throw extraItemsError;
      }

      // Recompute totals from the actual order_items in DB after any reseller
      // price enforcement. The in-memory totals can be stale while pricing RPCs
      // finish, so the amount charged must follow the persisted line items.
      let chargeSubtotal = subtotal;
      let chargeTotal = total;
      {
        const { data: priced } = await supabase
          .from("order_items")
          .select("price, quantity")
          .eq("order_id", orderId);
        if (priced && priced.length > 0) {
          chargeSubtotal = priced.reduce(
            (s: number, it: any) => s + Number(it.price || 0) * Number(it.quantity || 1),
            0
          );
          chargeTotal = Math.max(0, chargeSubtotal - discount);
        }
      }

      // Update draft order with final values (bumps, coupon, payment method, totals)
      const updateData: any = {
        subtotal: chargeSubtotal,
        discount,
        total: chargeTotal,
        payment_method: paymentMethod,
        coupon_code: couponApplied ? coupon.trim().toUpperCase() : null,
      };

      // Update main proxy item with target_city if applicable
      if (product?.icon_type === 'proxy' && !product?.external_id) {
        const { data: mainItem } = await supabase
          .from("order_items")
          .select("id, delivery_data")
          .eq("order_id", orderId)
          .eq("product_id", product.id)
          .maybeSingle();

        if (mainItem) {
          const newDeliveryData = {
            ...(mainItem.delivery_data as object || {}),
            target_city: targetCity !== "all" ? targetCity : undefined
          };
          await supabase.from("order_items").update({ delivery_data: newDeliveryData }).eq("id", mainItem.id);
        }
      }

      if (paymentMethod === "saldo") {
        const { data: profile } = await supabase.from("profiles").select("balance, proxy_fixed_price, full_name").eq("user_id", user.id).maybeSingle();
        
        if (!profile || profile.balance < chargeTotal) {
          toast.error(`Saldo insuficiente (R$ ${(profile?.balance || 0).toFixed(2).replace(".", ",")}). Redirecionando para PIX...`);
          setPaymentMethod("pix");
          setProcessing(false);
          clearTimeout(safetyTimeout);
          return;
        }

        if (!profile || profile.balance < chargeTotal) {
          toast.error(`Saldo insuficiente (R$ ${(profile?.balance || 0).toFixed(2).replace(".", ",")}). Redirecionando para PIX...`);
          setPaymentMethod("pix");
          setProcessing(false);
          clearTimeout(safetyTimeout);
          return;
        }

        // Detect proxy provider.
        // PRIORITY: if sessionStorage.proxy_purchase has product_variant_id, this is a ProxyBR
        // contract (selected via Loja variant modal) and MUST route to ProxyBR even if the
        // local product row looks like a Fbflix proxy (icon_type=proxy, no external_id).
        // Detect proxy provider.
        // PRIORITY: if product has no external_id, it is a local (Fbflix) proxy.
        // We no longer rely on isProxyBRPurchase (sessionStorage) here because 
        // local proxies might be accidentally matched with API variants.
        const isProxyFbflixProduct = product?.icon_type === 'proxy' && !product?.external_id;
        const proxyDataEarly = getProxyPurchaseData();
        const isProxyBRPurchase = !!proxyDataEarly?.product_variant_id;
        const isRotatingProxy = product?.tags?.some((t: string) => t.toLowerCase() === 'rotativo');
        
        if (isProxyFbflixProduct) {
          updateData.status = "processing";
          await supabase.from("orders").update(updateData).eq("id", orderId);

          const wsAction = isRotatingProxy ? "purchase-rotating-proxy" : "purchase-proxy-with-balance";
          toast.info(isRotatingProxy ? "Ativando proxy rotativo..." : "Ativando seu proxy...");
          const { data: wsResult, error: wsError } = await supabase.functions.invoke("proxyfbflix-api", {
            body: {
           action: wsAction,
           order_id: orderId,
           total: chargeTotal,
           product_id: product.id,
           quantity: quantity,
           target_city: targetCity !== "all" ? targetCity : undefined,
         },
          });

          if (wsError || wsResult?.error) {
            console.error("ProxyFbflix purchase error:", wsError || wsResult?.error);
            toast.error(wsResult?.error || "Erro ao ativar proxy. Contate o suporte.");
            navigate("/orders");
            return;
          }

          if (couponApplied && coupon.trim()) {
            const { data: cpn } = await supabase.from("coupons").select("used_count").eq("code", coupon.trim().toUpperCase()).single();
            if (cpn) await supabase.from("coupons").update({ used_count: cpn.used_count + 1 }).eq("code", coupon.trim().toUpperCase());
          }

          toast.success(isRotatingProxy ? "Proxy rotativo ativado!" : "Proxy ativado com sucesso!");
          queryClient.invalidateQueries({ queryKey: ["proxyfbflix-subscriptions"] });
          queryClient.invalidateQueries({ queryKey: ["proxybr-subscriptions"] });
          queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
          navigate("/subscriptions");
          return;
        }

        // Check if this is a ProxyBR proxy purchase (has external_id)
        const isProxyBRProduct = product?.icon_type === 'proxy' && !!product?.external_id;
        const proxyData = getProxyPurchaseData();
        if (isProxyBRProduct || proxyData?.product_variant_id) {
          // Build proxy params: prefer sessionStorage variant, fallback to product external_id
          let variantId = proxyData?.product_variant_id;
          let proxyQuantity = proxyData?.quantity || quantity || 1;
          let proxyInterval = proxyData?.interval || "monthly";

          // If no variant from sessionStorage, fetch first available variant from ProxyBR
          if (!variantId && product?.external_id) {
            toast.info("Buscando variante do proxy...");
            const productsResult = await invokeProxyBR("get-products");
            if (productsResult && Array.isArray(productsResult)) {
              const apiProduct = productsResult.find((p: any) => String(p.id) === String(product.external_id));
              if (apiProduct?.variant?.length > 0) {
                // Pick first variant with stock
                const availableVariant = apiProduct.variant.find((v: any) => v.stocks > 0) || apiProduct.variant[0];
                variantId = availableVariant.id;
              }
            }
          }

          if (!variantId) {
            toast.error("Não foi possível identificar a variante do proxy. Tente novamente pela loja.");
            return;
          }
          // Update order with payment info but DON'T complete or debit - server does it all
          updateData.status = "processing";
          await supabase.from("orders").update(updateData).eq("id", orderId);

          toast.info("Ativando seu proxy...");
          let proxyResult: any;
          let proxyError: Error | null = null;
          try {
            proxyResult = await invokeProxyBR("purchase-proxy-with-balance", {
              order_id: orderId,
              product_variant_id: variantId,
              quantity: proxyQuantity,
              interval: proxyInterval,
              total: chargeTotal,
            });
          } catch (error: any) {
            proxyError = error;
          }

          if (proxyError || proxyResult?.error) {
            console.error("Proxy purchase error:", proxyError || proxyResult?.error);
            toast.error("Erro ao ativar proxy. Contate o suporte.");
            sessionStorage.removeItem("proxy_purchase");
            navigate("/orders");
            return;
          }

          if (couponApplied && coupon.trim()) {
            const { data: cpn } = await supabase.from("coupons").select("used_count").eq("code", coupon.trim().toUpperCase()).single();
            if (cpn) await supabase.from("coupons").update({ used_count: cpn.used_count + 1 }).eq("code", coupon.trim().toUpperCase());
          }

          sessionStorage.removeItem("proxy_purchase");
          toast.success("Proxy ativado com sucesso!");
          queryClient.invalidateQueries({ queryKey: ["proxybr-subscriptions"] });
          navigate("/subscriptions");
          return;
        }

        // Normal (non-proxy) balance flow
        updateData.status = "completed";
        const { error: updateError } = await supabase.from("orders").update(updateData).eq("id", orderId);
        if (updateError) throw updateError;

        // Get all order items for fulfillment
        const { data: createdOrderItems } = await supabase.from("order_items").select("id, product_id, delivery_data").eq("order_id", orderId);

        // Fulfill atomically using DB function
        let fulfillmentFailed = false;
        const pendingProxyItems: { productId: string; quantity: number }[] = [];
        if (createdOrderItems) {
          for (const oi of createdOrderItems) {
            if (!oi.product_id) continue;
            
            // Skip products that are already being handled as proxies (they create subscriptions)
            // or that already have delivery data.
            const { data: itemProd } = await supabase.from("products").select("icon_type").eq("id", oi.product_id).single();
            if (itemProd?.icon_type === 'proxy') {
              const { data: itemQtyRow } = await supabase.from("order_items").select("quantity").eq("id", oi.id).maybeSingle();
              pendingProxyItems.push({ productId: oi.product_id, quantity: itemQtyRow?.quantity || 1 });
              continue;
            }

            const deliveryData = oi.delivery_data && typeof oi.delivery_data === "object" ? oi.delivery_data as Record<string, unknown> : null;
            if (deliveryData?.bmLinks || deliveryData?.linkPerfil || deliveryData?.idPerfil || deliveryData?.type) continue;

            // ========== SAFE BM AUTO-ACTIVATION (saldo) ==========
            if (oi.product_id === "e5118c63-ed52-4f4e-8983-f44c1ba0d17b") {
              try {
                const { data: itemFull } = await supabase.from("order_items").select("quantity, price").eq("id", oi.id).single();
                const itemQty = itemFull?.quantity || 1;
                const itemPrice = itemFull?.price || 9.99;
                for (let i = 0; i < itemQty; i++) {
                  const { count: existingCount } = await supabase
                    .from("safe_bm_vaults").select("id", { count: "exact", head: true })
                    .eq("user_id", user.id).eq("status", "active");
                  await supabase.from("safe_bm_vaults" as any).insert({
                    user_id: user.id,
                    client_name: profile.full_name || "Cliente",
                    bm_name: `BM ${(existingCount || 0) + 1}`,
                    bm_link: "https://business.facebook.com",
                    status: "active",
                    subscription_price: itemPrice,
                    protection_start: new Date().toISOString(),
                  });
                }
                await supabase.from("order_items").update({
                  delivery_data: { type: "safe_bm", fulfilled: true, count: itemQty } as any,
                }).eq("id", oi.id);
              } catch (e) {
                console.error("[Checkout] SafeBM saldo error:", e);
                fulfillmentFailed = true;
              }
              continue;
            }

            const { data: result, error: rpcError } = await supabase.rpc("fulfill_order_item", {
              p_order_item_id: oi.id,
              p_product_id: oi.product_id,
            });

            if (rpcError) {
              console.error("Fulfillment error:", rpcError);
              fulfillmentFailed = true;
            } else if (result && typeof result === 'object' && !Array.isArray(result) && !(result as any).success) {
              console.warn("Fulfillment warning:", (result as any).error);
              fulfillmentFailed = true;
            } else if (result && typeof result === 'object' && !Array.isArray(result) && (result as any).success && lauthEnabled && lauthEmail) {
              const stockData = (result as any).data;
              const profileId = stockData?.idPerfil;
              
              if (profileId) {
                console.log("Iniciando transferência Lauth para:", profileId);
                try {
                  const { data: lauthData, error: lauthError } = await supabase.functions.invoke('lauth-transfer', {
                    body: { profileId, email: lauthEmail, itemId: oi.id }
                  });
                  if (lauthError) {
                    console.error("Erro na transferência Lauth:", lauthError);
                  } else {
                    console.log("Transferência Lauth concluída:", lauthData);
                    if (lauthData?.success) {
                      // Update delivery_data locally and in DB
                      const updatedDD = {
                        ...stockData,
                        lauthDeliveredAt: new Date().toISOString(),
                        lauthRecipientEmail: lauthEmail
                      };
                      await supabase.from("order_items").update({ delivery_data: updatedDD }).eq("id", oi.id);
                    }
                  }
                } catch (err) {
                  console.error("Falha ao invocar lauth-transfer:", err);
                }
              }
            }
          }
        }

        // If fulfillment failed, mark order appropriately so admin can fix
        if (fulfillmentFailed) {
          await supabase.from("orders").update({ status: "pending_fulfillment" }).eq("id", orderId);
          toast.error("Pedido criado mas houve um problema na entrega. Nossa equipe será notificada.");
          // Still debit balance since payment was made - admin will resolve fulfillment
        }

        // ========== PROXY FBFLIX PROVISIONING (saldo, carrinho/bump) ==========
        // Proxy items are not handled by fulfill_order_item; they must be allocated
        // through the Webshare pool. Without this, the wallet was debited and the
        // customer never received the proxy in /subscriptions.
        let proxyProvisionFailed = false;
        for (const pending of pendingProxyItems) {
          try {
            const { data: allocRes, error: allocErr } = await supabase.functions.invoke("proxyfbflix-api", {
              body: {
                action: "allocate-proxy-for-paid-order",
                order_id: orderId,
                product_id: pending.productId,
                quantity: pending.quantity,
                target_city: targetCity !== "all" ? targetCity : undefined,
              },
            });
            if (allocErr || allocRes?.error) {
              console.error("[Checkout] Proxy allocation error:", allocErr || allocRes?.error);
              proxyProvisionFailed = true;
            }
          } catch (e) {
            console.error("[Checkout] Proxy allocation exception:", e);
            proxyProvisionFailed = true;
          }
        }

        if (proxyProvisionFailed) {
          await supabase.from("orders").update({ status: "pending_fulfillment" }).eq("id", orderId);
          toast.error("Pagamento confirmado, mas o proxy não pôde ser ativado agora. Nossa equipe foi notificada.");
          await supabase.from("notifications").insert({
            title: "Proxy pago sem ativação",
            message: `Pedido #${orderCode} foi pago no saldo mas o proxy não foi alocado. Alocar manualmente.`,
            type: "order",
            global: true,
          });
        }

        // ========== SAFE BM RENEWAL AUTO-ACTIVATION (saldo) ==========
        try {
          const pendingRenewalsStr = sessionStorage.getItem("pending_safe_bm_renewals");
          if (pendingRenewalsStr) {
            const renewalIds = JSON.parse(pendingRenewalsStr);
            if (Array.isArray(renewalIds) && renewalIds.length > 0) {
              const { data: renewals } = await supabase
                .from("safe_bm_renewals")
                .select("id, vault_id")
                .in("id", renewalIds);
              const vaultIds = Array.from(new Set((renewals || []).map((r: any) => r.vault_id).filter(Boolean)));
              await supabase
                .from("safe_bm_renewals")
                .update({ status: "verified", paid_at: new Date().toISOString(), verified_at: new Date().toISOString(), order_id: orderId })
                .in("id", renewalIds);
              if (vaultIds.length > 0) {
                const nowIso = new Date().toISOString();
                const nextIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
                await supabase
                  .from("safe_bm_vaults" as any)
                  .update({ last_billing_at: nowIso, next_billing_at: nextIso, status: "active", billing_status: "paid" })
                  .in("id", vaultIds);
              }
              sessionStorage.removeItem("pending_safe_bm_renewals");
            }
          }
        } catch (e) {
          console.error("[Checkout] SafeBM renewal activation error:", e);
        }

        const newBalance = profile.balance - chargeTotal;
        await supabase.from("profiles").update({ balance: newBalance }).eq("user_id", user.id);

        await supabase.from("wallet_transactions").insert({
          user_id: user.id, type: "purchase", title: `Compra #${orderCode}`,
          amount: -chargeTotal, balance_after: newBalance, reference_id: orderId,
        });

        if (couponApplied && coupon.trim()) {
          const { data: cpn } = await supabase.from("coupons").select("used_count").eq("code", coupon.trim().toUpperCase()).single();
          if (cpn) await supabase.from("coupons").update({ used_count: cpn.used_count + 1 }).eq("code", coupon.trim().toUpperCase());
        }

        // Notify admin about completed order (distinguish reseller sales)
        {
          let resellerLabel = "";
          if (activeResellerId) {
            const { data: rInfo } = await supabase
              .from("resellers")
              .select("company_name, brand_name, slug")
              .eq("id", activeResellerId)
              .maybeSingle();
            const rName = (rInfo as any)?.brand_name || (rInfo as any)?.company_name || (rInfo as any)?.slug;
            if (rName) resellerLabel = ` · Revendedor: ${rName}`;
          }
          await supabase.from("notifications").insert({
            title: activeResellerId ? "Pedido Concluído (Revendedor)" : "Pedido Concluído",
            message: `Pedido #${orderCode} finalizado — R$ ${chargeTotal.toFixed(2)} (Saldo)${resellerLabel}`,
            type: "order",
            global: true,
          });
        }

        // Clear ref after use
        localStorage.removeItem("partner_ref");
        localStorage.removeItem("partner_ref_id");
        localStorage.removeItem("partner_ref_at");

        toast.success("Pedido realizado com sucesso!");
        if (pendingProxyItems.length > 0 && !proxyProvisionFailed) {
          queryClient.invalidateQueries({ queryKey: ["proxyfbflix-subscriptions"] });
          queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
          navigate("/subscriptions");
        } else {
          navigate("/orders");
        }

      } else if (paymentMethod === "pix") {
        updateData.status = "processing";
        const { error: updateError } = await supabase.from("orders").update(updateData).eq("id", orderId);
        if (updateError) throw updateError;

        // Pass proxy_data to create-pix-payment so server persists delivery_data (ProxyBR only)
        const proxyDataForPix = getProxyPurchaseData();
        const isProxyBRPix = product?.icon_type === 'proxy' && !!product?.external_id;
        const pixBody: any = { amount: chargeTotal, order_id: orderId };
        if (activeResellerId) pixBody.reseller_id = activeResellerId;
        if (proxyDataForPix?.product_variant_id || isProxyBRPix) {
          let pixVariantId = proxyDataForPix?.product_variant_id;
          // Fallback: fetch variant from ProxyBR products API
          if (!pixVariantId && product?.external_id) {
            const productsResult = await invokeProxyBR("get-products");
            if (productsResult && Array.isArray(productsResult)) {
              const apiProduct = productsResult.find((p: any) => String(p.id) === String(product.external_id));
              if (apiProduct?.variant?.length > 0) {
                const availableVariant = apiProduct.variant.find((v: any) => v.stocks > 0) || apiProduct.variant[0];
                pixVariantId = availableVariant.id;
              }
            }
          }
          if (pixVariantId) {
            pixBody.proxy_data = {
              product_variant_id: pixVariantId,
              api_product_id: proxyDataForPix?.api_product_id || product?.external_id,
              variant_location: proxyDataForPix?.variant_location,
              quantity: proxyDataForPix?.quantity || quantity || 1,
              interval: proxyDataForPix?.interval || "monthly",
            };
          }
        }
        const { data: pixResult, error: pixError } = await supabase.functions.invoke("create-pix-payment", {
          body: pixBody,
        });
        if (pixError) throw pixError;
        if (pixResult?.error) throw new Error(pixResult.error);

         setPixData({ 
           qr_code: pixResult.qr_code, 
           qr_code_base64: pixResult.qr_code_base64, 
           amount: chargeTotal,
           payment_link: pixResult.payment_link
         });
        setPixPaymentId(pixResult.payment_id || null);
        setPixConfirmed(false);
        setCopied(false);
        setPixModal(true);
      } else if (paymentMethod === "cartao") {
        if (chargeTotal < 5) {
          toast.error("Pagamento com cartão exige valor mínimo de R$ 5,00. Use Pix ou saldo.");
          return;
        }
        if (!stripeCardRef.current) {
          toast.error("Formulário de cartão indisponível. Recarregue a página.");
          return;
        }

        updateData.status = "processing";
        await supabase.from("orders").update(updateData).eq("id", orderId);

        // Build proxy data if applicable
        const proxyDataForCard = getProxyPurchaseData();
        const isProxyBRCard = product?.icon_type === 'proxy' && !!product?.external_id;

        if (proxyDataForCard?.product_variant_id || isProxyBRCard) {
          let cardVariantId = proxyDataForCard?.product_variant_id;
          if (!cardVariantId && product?.external_id) {
            const productsResult = await invokeProxyBR("get-products");
            if (productsResult && Array.isArray(productsResult)) {
              const apiProduct = productsResult.find((p: any) => String(p.id) === String(product.external_id));
              if (apiProduct?.variant?.length > 0) {
                const availableVariant = apiProduct.variant.find((v: any) => v.stocks > 0) || apiProduct.variant[0];
                cardVariantId = availableVariant.id;
              }
            }
          }
          if (cardVariantId) {
            const { data: cardOrderItems } = await supabase
              .from("order_items")
              .select("id")
              .eq("order_id", orderId)
              .limit(1);
            if (cardOrderItems?.[0]?.id) {
              await supabase.from("order_items").update({
                delivery_data: {
                  type: "proxy_contract",
                  product_variant_id: cardVariantId,
                  api_product_id: proxyDataForCard?.api_product_id || product?.external_id,
                  variant_location: proxyDataForCard?.variant_location,
                  quantity: proxyDataForCard?.quantity || quantity || 1,
                  interval: proxyDataForCard?.interval || "monthly",
                },
              }).eq("id", cardOrderItems[0].id);
            }
          }
        }

        // Cobrança via Stripe, sem sair do checkout da FBFLIX
        const stripeResult = await stripeCardRef.current.confirm(orderId);
        const cardResult = stripeResult.ok
          ? { status: "approved" }
          : { status: "refused", status_detail: stripeResult.error };

        if (cardResult.status === "approved") {
          // Payment approved — handle fulfillment
          const isProxyPurchase = !!sessionStorage.getItem("proxy_purchase");
          const isProxyFbflixProduct = product?.icon_type === 'proxy' && !product?.external_id;

          if (isProxyFbflixProduct) {
            const isRotatingProxy = product?.tags?.some((t: string) => t.toLowerCase() === 'rotativo');
            const wsAction = isRotatingProxy ? "purchase-rotating-proxy" : "purchase-proxy-with-balance";
            const { data: wsResult, error: wsError } = await supabase.functions.invoke("proxyfbflix-api", {
              body: { action: wsAction, order_id: orderId, total: chargeTotal, product_id: product.id, quantity, skip_balance_debit: true },
            });
            if (wsError || wsResult?.error) {
              toast.error("Pagamento aprovado mas houve erro ao ativar proxy. Contate o suporte.");
              navigate("/orders");
              return;
            }
            sessionStorage.removeItem("proxy_purchase");
            toast.success("Pagamento aprovado! Proxy ativado.");
            queryClient.invalidateQueries({ queryKey: ["proxyfbflix-subscriptions"] });
            navigate("/subscriptions");
            return;
          }

          if (isProxyBRCard || proxyDataForCard?.product_variant_id) {
            // ProxyBR will be handled by webhook/fulfillment
            sessionStorage.removeItem("proxy_purchase");
            toast.success("Pagamento aprovado! Proxy será ativado em instantes.");
            queryClient.invalidateQueries({ queryKey: ["proxybr-subscriptions"] });
            navigate("/subscriptions");
            return;
          }

          // Normal product fulfillment
          await supabase.from("orders").update({ status: "completed" }).eq("id", orderId);
          const { data: createdItems } = await supabase.from("order_items").select("id, product_id, delivery_data").eq("order_id", orderId);
          if (createdItems) {
            for (const oi of createdItems) {
              if (!oi.product_id) continue;

              // Skip products that are already being handled as proxies (they create subscriptions)
              const { data: itemProd } = await supabase.from("products").select("icon_type").eq("id", oi.product_id).single();
              if (itemProd?.icon_type === 'proxy') {
                console.log(`[Checkout] Skipping fulfillment for proxy item ${oi.id} as it should be handled via subscriptions`);
                continue;
              }

              const deliveryData = oi.delivery_data && typeof oi.delivery_data === "object" ? oi.delivery_data as Record<string, unknown> : null;
              if (deliveryData?.bmLinks || deliveryData?.linkPerfil || deliveryData?.idPerfil || deliveryData?.type) continue;
              const { data: result } = await supabase.rpc("fulfill_order_item", { p_order_item_id: oi.id, p_product_id: oi.product_id });
              
              if (result && (result as any).success && lauthEnabled && lauthEmail) {
                const profileId = (result as any).data?.idPerfil;
                if (profileId) {
                  supabase.functions.invoke('lauth-transfer', {
                    body: { profileId, email: lauthEmail, itemId: oi.id }
                  }).then(({ data: lData, error: lErr }) => {
                    if (lErr) console.error("Lauth transfer error (fallback):", lErr);
                    else if (lData?.success) {
                      supabase.from("order_items").update({
                        delivery_data: {
                          ...(result as any).data,
                          lauthDeliveredAt: new Date().toISOString(),
                          lauthRecipientEmail: lauthEmail
                        }
                      }).eq("id", oi.id);
                    }
                  });
                }
              }
            }
          }

          if (couponApplied && coupon.trim()) {
            const { data: cpn } = await supabase.from("coupons").select("used_count").eq("code", coupon.trim().toUpperCase()).single();
            if (cpn) await supabase.from("coupons").update({ used_count: cpn.used_count + 1 }).eq("code", coupon.trim().toUpperCase());
          }

          {
            let resellerLabel = "";
            if (activeResellerId) {
              const { data: rInfo } = await supabase
                .from("resellers")
                .select("company_name, brand_name, slug")
                .eq("id", activeResellerId)
                .maybeSingle();
              const rName = (rInfo as any)?.brand_name || (rInfo as any)?.company_name || (rInfo as any)?.slug;
              if (rName) resellerLabel = ` · Revendedor: ${rName}`;
            }
            await supabase.from("notifications").insert({
              title: activeResellerId ? "Pedido Concluído (Revendedor)" : "Pedido Concluído",
              message: `Pedido #${orderCode} finalizado — R$ ${chargeTotal.toFixed(2)} (Cartão)${resellerLabel}`,
              type: "order",
              global: true,
            });
          }

          sessionStorage.removeItem("proxy_purchase");
          toast.success("Pagamento aprovado! Pedido realizado.");
          navigate("/orders");
        } else {
          toast.error(cardResult?.status_detail || "Pagamento recusado. Tente outro cartão ou método.");
          await supabase.from("orders").update({ status: "payment_failed" }).eq("id", orderId);
        }
      } else {
        toast.error("Método de pagamento inválido.");
      }
    } catch (err: any) {
      console.error("Payment error:", err);
      toast.error(err.message || "Erro ao processar pagamento");
    } finally {
      clearTimeout(safetyTimeout);
      setProcessing(false);
    }
  };

  const handleCopyPix = async () => {
    if (!pixData?.qr_code) return;
    await navigator.clipboard.writeText(pixData.qr_code);
    setCopied(true);
    toast.success("Código PIX copiado!");
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="animate-fade-in pb-4">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors mb-4 text-sm"
      >
        <ChevronLeft className="w-4 h-4" />
        <span>Voltar</span>
      </button>

      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column - Payment & Order Bumps */}
        <div className="lg:col-span-8 flex flex-col gap-4 order-2 lg:order-1">
          {/* Product Info Section */}
          <section className="glass-panel rounded-xl p-5 flex flex-col gap-4">
            <div className="flex gap-4 items-start">
              <div className="w-16 h-16 rounded-lg bg-surface border border-border shrink-0 bg-cover bg-center" style={{ backgroundImage: `url('${product.image_url || "/placeholder.svg"}')` }} />
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-foreground leading-tight">{product.name}</h2>
                <p className="text-sm text-primary font-semibold mt-0.5">R$ {mainDisplayTotal.toFixed(2).replace(".", ",")} {quantity > 1 && `(x${quantity})`}</p>
              </div>
              {product.slug && (
                <button
                  onClick={async () => {
                    const url = `${window.location.origin}/p/${product.slug}`;
                    try {
                      await navigator.clipboard.writeText(url);
                      setShareCopied(true);
                      toast.success("Link do produto copiado!");
                      setTimeout(() => setShareCopied(false), 2000);
                    } catch {
                      // Fallback for insecure contexts
                      const ta = document.createElement("textarea");
                      ta.value = url;
                      ta.style.position = "fixed";
                      ta.style.opacity = "0";
                      document.body.appendChild(ta);
                      ta.select();
                      try {
                        document.execCommand("copy");
                        setShareCopied(true);
                        toast.success("Link do produto copiado!");
                        setTimeout(() => setShareCopied(false), 2000);
                      } catch (e) {
                        toast.error("Erro ao copiar link");
                      }
                      document.body.removeChild(ta);
                    }
                  }}
                  className="shrink-0 p-2 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-all"
                  title="Compartilhar produto"
                >
                  {shareCopied ? <Check className="size-5" /> : <Share2 className="size-5" />}
                </button>
              )}
            </div>
            {product.description && (
              <p className="text-xs text-muted-foreground leading-relaxed">{product.description}</p>
            )}
            {product.tags && product.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {product.tags.map((tag, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-foreground text-background font-medium">{tag}</span>
                ))}
              </div>
            )}

             {/* City selector for any FBFlix Proxy (only if user opted in) */}
             {product.icon_type === 'proxy' && !product.external_id && showCityOnCheckout && (
               <div className="flex flex-col gap-3 pt-3 border-t border-border mt-1">
                 <div className="flex flex-col gap-1">
                   <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                     <span className="material-symbols-outlined text-primary text-sm">location_on</span>
                     Localização do Proxy
                   </span>
                   <p className="text-[10px] text-muted-foreground">Escolha a cidade desejada ou deixe aleatório para o sistema definir</p>
                 </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                    {dynamicCities.length > 2 ? (
                      dynamicCities.map((city) => (
                        <button
                          key={city.value}
                          onClick={() => setTargetCity(city.value)}
                          type="button"
                          className={`px-3 py-2 rounded-lg border text-[11px] font-medium transition-all ${
                            targetCity === city.value
                              ? "bg-primary/10 border-primary text-primary"
                              : "bg-surface/50 border-border text-muted-foreground hover:border-primary/30"
                          }`}
                        >
                          {city.label}
                        </button>
                      ))
                    ) : (
                      CITIES.map((city) => (
                        <button
                          key={city.value}
                          onClick={() => setTargetCity(city.value)}
                          type="button"
                          className={`px-3 py-2 rounded-lg border text-[11px] font-medium transition-all ${
                            targetCity === city.value
                              ? "bg-primary/10 border-primary text-primary"
                              : "bg-surface/50 border-border text-muted-foreground hover:border-primary/30"
                          }`}
                        >
                          {city.label}
                        </button>
                      ))
                    )}
                  </div>
               </div>
             )}

             {/* GB Quantity selector for rotating proxy */}
             {product.tags?.some((t: string) => t.toLowerCase() === 'rotativo') && (
               <div className="flex items-center justify-between pt-3 border-t border-border mt-1">
                <div>
                  <span className="text-sm font-semibold text-foreground">Quantidade de GB</span>
                  <p className="text-[10px] text-muted-foreground">Selecione quantos GB deseja contratar</p>
                </div>
                <div className="flex items-center bg-secondary rounded-lg border border-border h-10 px-1">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-9 h-full flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition"
                  >
                    <span className="text-lg font-bold">−</span>
                  </button>
                  <span className="w-12 text-center text-sm font-bold text-foreground">{quantity} GB</span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    className="w-9 h-full flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition"
                  >
                    <span className="text-lg font-bold">+</span>
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Payment Section */}
          <section className="glass-panel rounded-xl p-5 flex flex-col gap-4">
            <div>
              <h2 className="text-base font-bold flex items-center gap-2 text-foreground">
                <CreditCard className="w-4 h-4 text-primary" />
                Pagamento
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Selecione como você deseja pagar.</p>
            </div>

            {/* Payment Methods */}
            <div className="grid grid-cols-3 gap-2">
              <label className="cursor-pointer group">
                <input type="radio" name="payment_method" checked={paymentMethod === "saldo"} onChange={() => setPaymentMethod("saldo")} className="peer sr-only" />
                <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border p-3 text-center transition-all peer-checked:border-primary peer-checked:bg-primary/20 hover:bg-muted/50">
                  <img src={IconWallet} alt="Saldo" className="w-6 h-6 opacity-80" />
                  <span className="font-medium text-xs text-foreground">Saldo</span>
                </div>
              </label>
              <label className="cursor-pointer group">
                <input type="radio" name="payment_method" checked={paymentMethod === "pix"} onChange={() => setPaymentMethod("pix")} className="peer sr-only" />
                <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border p-3 text-center transition-all peer-checked:border-primary peer-checked:bg-primary/20 hover:bg-muted/50">
                  <img src={IconPix} alt="Pix" className="w-6 h-6 opacity-80" />
                  <span className="font-medium text-xs text-foreground">Pix</span>
                </div>
              </label>
              {cardEnabled && cardAllowedForProduct ? (
                <label className="cursor-pointer group">
                  <input type="radio" name="payment_method" checked={paymentMethod === "cartao"} onChange={() => setPaymentMethod("cartao")} className="peer sr-only" />
                  <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border p-3 text-center transition-all peer-checked:border-primary peer-checked:bg-primary/20 hover:bg-muted/50">
                    <img src={IconCard} alt="Cartão" className="w-6 h-6 opacity-80" />
                    <span className="font-medium text-xs text-foreground">Cartão</span>
                  </div>
                </label>
              ) : (
                <div className="relative cursor-not-allowed group">
                  <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border p-3 text-center opacity-50">
                    <img src={IconCard} alt="Cartão" className="w-6 h-6 opacity-80" />
                    <span className="font-medium text-xs text-foreground">Cartão</span>
                  </div>
                  <span className="absolute -top-2 -right-2 bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">EM BREVE</span>
                </div>
              )}
            </div>

            {/* Card Form (show only when card is selected) */}
            {paymentMethod === "cartao" && (
              <div className="pt-4 border-t border-border">
                {total < 5 ? (
                  <p className="text-xs text-destructive">
                    Pagamento com cartão exige valor mínimo de R$ 5,00. Use Pix ou saldo para este valor.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <StripeCardFields
                      ref={stripeCardRef}
                      amount={total}
                      subscription={isRecurringCardProduct}
                      description={`FBFLIX - ${product?.name || "Pedido"}`}
                    />
                    {!isRecurringCardProduct && (
                      <p className="text-[10px] text-muted-foreground">
                        Cobrança avulsa — o cartão não fica salvo e não há renovação automática.
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Pagamento processado com criptografia — você continua aqui na FBFLIX.
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Order Bumps Section */}
          {!isResellerCheckout && relevantBumps.length > 0 && (
            <section className="glass-panel rounded-xl p-5 flex flex-col gap-3 relative overflow-hidden">
              <div className="flex flex-col gap-0.5 z-10">
                <h2 className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <Flame className="w-4 h-4 text-yellow-500" />
                  85% dos clientes levam junto...
                </h2>
                <p className="text-xs text-muted-foreground">Ofertas exclusivas apenas nesta página.</p>
              </div>
              <div className="space-y-2 z-10">
                {relevantBumps.map((bump) => (
                  <label
                    key={bump.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border border-dashed cursor-pointer transition-colors ${
                      selectedBumps.includes(bump.id)
                        ? "border-primary/50 bg-primary/10"
                        : "border-border bg-black/20 hover:bg-muted/20"
                    }`}
                  >
                    <input type="checkbox" checked={selectedBumps.includes(bump.id)} onChange={() => toggleBump(bump.id)} className="h-4 w-4 rounded border-2 border-border bg-transparent text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <p className="font-bold text-foreground text-xs">
                          {bump.name}
                          {(bump as any)._isCombo && (
                            <Badge variant="secondary" className="ml-1 text-[9px] h-3 px-1 bg-indigo-500/20 text-indigo-400 border-indigo-500/30">Combo</Badge>
                          )}
                        </p>
                        <div className="flex items-center gap-1.5 ml-2">
                          {(bump as any)._hasDiscount && (bump as any)._originalPrice && (
                            <span className="text-muted-foreground text-[10px] line-through">R$ {(bump as any)._originalPrice.toFixed(2).replace(".", ",")}</span>
                          )}
                          <span className="text-primary font-bold text-xs">+ R$ {bump.price.toFixed(2).replace(".", ",")}</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">{bump.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column - Upsell & Order Summary */}
        <div className="lg:col-span-4 relative order-1 lg:order-2">
          <div className="sticky top-24 flex flex-col gap-3">
            {/* Upsell Offer - Proxy IPV4 Contingência only for non-proxy products */}
            {(() => {
              if (isResellerCheckout) return null;
              const isMainProxy = product?.icon_type === 'proxy' || product?.tags?.some(t => t.toLowerCase().includes('proxy'));
              // When bumps are admin-configured, the main bump is already set in promoProxy with correct price
              const hasConfiguredBumps = (promoProxy as any)?._label;
              if (!hasConfiguredBumps && isMainProxy) return null;
              if (!promoProxy || selectedBumps.includes(promoProxy.id)) return null;
              const PROMO_PRICE = promoProxy.price;
              const originalPrice = (promoProxy as any)?._originalPrice || promoProxy.price * 2.5;
               const bumpLabel = (promoProxy as any)?._label || ((promoProxy as any)?._isCombo ? "COMBO ATIVADO" : "OPORTUNIDADE ÚNICA");
               const isCombo = (promoProxy as any)?._isCombo;
              const hasDiscount = originalPrice > PROMO_PRICE;
              return (
                <div className="rounded-xl border-2 border-primary bg-gradient-to-b from-primary/10 to-background p-4 flex flex-col gap-2 relative overflow-hidden">
                   <div className="flex items-center gap-2">
                     <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ${isCombo ? 'bg-indigo-500' : 'bg-emerald-500'} text-white w-fit`}>
                       {isCombo ? <Layers className="w-3 h-3" /> : <Flame className="w-3 h-3" />}
                       {bumpLabel}
                     </span>
                     {isCombo && <span className="text-[10px] font-bold text-indigo-400">Incluído no pacote</span>}
                   </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Complete sua compra!</h3>
                    <p className="text-xs text-muted-foreground">
                      Leve <span className="font-bold text-foreground">{promoProxy.name}</span> e proteja sua operação!
                    </p>
                  </div>
                  <div className="flex items-center justify-between bg-secondary/80 border border-border rounded-lg p-3">
                    <div>
                      {hasDiscount && (
                        <p className="text-xs text-muted-foreground line-through">R$ {originalPrice.toFixed(2).replace(".", ",")}</p>
                      )}
                      <p className="text-lg font-black text-foreground">R$ {PROMO_PRICE.toFixed(2).replace(".", ",")}</p>
                    </div>
                    <button
                      onClick={() => {
                        setBumpProducts(prev => {
                          const exists = prev.find(b => b.id === promoProxy.id);
                          if (exists) return prev.map(b => b.id === promoProxy.id ? { ...b, price: PROMO_PRICE } : b);
                          return [...prev, { ...promoProxy, price: PROMO_PRICE }];
                        });
                        setSelectedBumps(prev => [...prev, promoProxy.id]);
                      }}
                      className="bg-foreground text-background text-xs font-bold px-4 py-2 rounded-full hover:opacity-90 transition-opacity"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              );
            })()}
            {/* Order Summary */}
            <div className="glass-panel rounded-xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground">Resumo do Pedido</h3>
                <button
                  onClick={() => {
                    clearCart();
                    toast.success("Carrinho esvaziado");
                    navigate("/loja");
                  }}
                  className="text-xs text-destructive hover:text-destructive/80 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Esvaziar
                </button>
              </div>
              
              <div className="flex flex-col gap-3">
                <div className="flex gap-3 items-center">
                  <div className="w-12 h-12 rounded-lg bg-surface border border-border shrink-0 bg-cover bg-center" style={{ backgroundImage: `url('${product.image_url || "/placeholder.svg"}')` }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight truncate">{product.name} {quantity > 1 && `(x${quantity})`}</p>
                    <p className="text-xs text-muted-foreground">R$ {mainDisplayTotal.toFixed(2).replace(".", ",")}</p>
                  </div>
                </div>
                {extraCartItems.map((ci) => (
                  <div key={ci.productId} className="flex gap-3 items-center border-t border-border pt-2">
                    <div className="w-12 h-12 rounded-lg bg-surface border border-border shrink-0 bg-cover bg-center" style={{ backgroundImage: `url('${ci.image || "/placeholder.svg"}')` }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-tight truncate">{ci.name} {ci.quantity > 1 && `(x${ci.quantity})`}</p>
                      <p className="text-xs text-muted-foreground">R$ {(getCartDisplayUnitPrice(ci) * ci.quantity).toFixed(2).replace(".", ",")}</p>
                    </div>
                    <button
                      onClick={() => {
                        removeItem(ci.productId);
                        toast.success(`${ci.name} removido do carrinho`);
                      }}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      title="Remover item"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {!isResellerCheckout && selectedBumps.map((bumpId) => {
                  const bump = bumpProducts.find((b) => b.id === bumpId);
                  if (!bump) return null;
                  return (
                    <div key={bumpId} className="flex gap-3 items-center border-t border-border pt-2">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 shrink-0 bg-cover bg-center" style={{ backgroundImage: bump.image_url ? `url('${bump.image_url}')` : undefined }}>
                        {!bump.image_url && <Flame className="w-4 h-4 text-primary/50 m-auto mt-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground leading-tight truncate">
                          {bump.name}
                          {(bump as any)._isCombo && (
                            <Badge variant="secondary" className="ml-1 text-[9px] h-3 px-1 bg-indigo-500/20 text-indigo-400 border-indigo-500/30">Combo</Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">R$ {bump.price.toFixed(2).replace(".", ",")}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Coupon */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={coupon}
                  onChange={(e) => { setCoupon(e.target.value); if (couponApplied) { setCouponApplied(false); setDiscount(0); } }}
                  placeholder="Cupom de desconto"
                  disabled={couponApplied}
                  className={`glass-input flex-1 rounded-lg py-2 px-3 text-xs text-foreground placeholder-muted-foreground outline-none focus:ring-1 focus:ring-primary bg-black/30 border ${couponApplied ? "border-emerald-500/50 bg-emerald-500/5" : "border-border"}`}
                />
                <button
                  onClick={applyCoupon}
                  disabled={applyingCoupon || couponApplied}
                  className="bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-lg px-3 transition-colors disabled:opacity-50"
                >
                  {applyingCoupon ? "..." : couponApplied ? "✓" : "APLICAR"}
                </button>
              </div>

              <div className="h-px w-full bg-border" />

              {/* Totals */}
              <div className="flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>Subtotal</span>
                  <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-muted-foreground text-xs">
                    <span>Descontos</span>
                    <span>- R$ {discount.toFixed(2).replace(".", ",")}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="font-bold text-foreground">Total</span>
                  <div className="flex flex-col items-end">
                    <span className="font-black text-xl text-foreground">R$ {total.toFixed(2).replace(".", ",")}</span>
                    
                  </div>
                </div>
              </div>

              {/* Pay Button */}
              <button
                onClick={handlePay}
                disabled={processing || resellerPricePending}
                className="w-full bg-primary hover:bg-primary/90 shadow-glow text-primary-foreground font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {resellerPricePending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    CARREGANDO PREÇO...
                  </>
                ) : processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    PROCESSANDO...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    PAGAR AGORA
                  </>
                )}
              </button>

              <div className="flex justify-center gap-3 opacity-50 text-muted-foreground">
                <CreditCard className="w-5 h-5" />
                <Wallet className="w-5 h-5" />
                <QrCode className="w-5 h-5" />
              </div>
            </div>

            <div className="flex justify-center gap-3 text-[11px] text-muted-foreground">
              <a className="hover:text-foreground transition-colors" href="#">Termos de Uso</a>
              <span>•</span>
              <a className="hover:text-foreground transition-colors" href="#">Política de Privacidade</a>
            </div>
          </div>
        </div>
      </div>

      {/* PIX QR Code Modal */}
      <Dialog open={pixModal} onOpenChange={(open) => { if (!open) { setPixModal(false); setPixData(null); setPixPaymentId(null); setPixConfirmed(false); } }}>
        <DialogContent className="sm:max-w-md">
          {pixConfirmed ? (
            <div className="flex flex-col items-center gap-6 py-8">
              <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center animate-fade-in">
                <Check className="size-10 text-primary" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black text-foreground">Pagamento Confirmado!</h3>
                <p className="text-muted-foreground">
                  Seu pedido de <span className="text-primary font-bold">R$ {pixData?.amount.toFixed(2).replace(".", ",")}</span> foi confirmado.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                <span>Redirecionando para pedidos...</span>
              </div>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-center text-xl font-bold">Pague com PIX</DialogTitle>
              </DialogHeader>
              {pixData && (
                <div className="flex flex-col items-center gap-6 py-4">
                  <p className="text-muted-foreground text-sm text-center">Escaneie o QR Code ou copie o código para pagar</p>
                  <div className="bg-primary/10 border border-primary/20 rounded-2xl px-6 py-3">
                    <span className="text-2xl font-black text-primary">R$ {pixData.amount.toFixed(2).replace(".", ",")}</span>
                  </div>
                  {pixData.qr_code_base64 && (
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-border/50">
                      <img 
                        src={
                          pixData.qr_code_base64.startsWith('http') 
                            ? pixData.qr_code_base64 
                            : pixData.qr_code_base64.startsWith('data:') 
                              ? pixData.qr_code_base64 
                              : `data:image/png;base64,${pixData.qr_code_base64}`
                        } 
                        alt="QR Code PIX" 
                        className="w-56 h-56 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                   <div className="flex flex-col gap-2 w-full">
                     {pixData.qr_code && (
                       <button onClick={handleCopyPix} className="w-full flex items-center justify-center gap-2 bg-muted border border-border rounded-xl px-4 py-3 hover:bg-accent transition-colors">
                         {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4 text-muted-foreground" />}
                         <span className="text-sm font-medium text-foreground">{copied ? "Copiado!" : "Copiar código Pix Copia e Cola"}</span>
                       </button>
                     )}
                     {pixData.payment_link && (
                       <a 
                         href={pixData.payment_link} 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="w-full flex items-center justify-center gap-2 bg-primary/20 border border-primary/30 rounded-xl px-4 py-3 hover:bg-primary/30 transition-colors text-primary"
                       >
                         <Share2 className="size-4" />
                         <span className="text-sm font-bold">Abrir link de pagamento</span>
                       </a>
                     )}
                   </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    <span>Aguardando pagamento...</span>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      {/* WhatsApp Required Popup */}
      {currentUserId && (
        <WhatsAppRequiredPopup
          open={showWhatsAppPopup}
          onClose={() => setShowWhatsAppPopup(false)}
          onSaved={(phone) => {
            setUserPhone(phone);
            setShowWhatsAppPopup(false);
          }}
          userId={currentUserId}
        />
      )}
    </div>
  );
}
