import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Wallet, QrCode, CreditCard, Lock, ChevronLeft, User, Calendar, Flame, Loader2, Check, Copy, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCart } from "@/contexts/CartContext";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { items: cartItems } = useCart();
  const queryClient = useQueryClient();
  const productId = searchParams.get("product") || "";
  const existingOrderId = searchParams.get("order") || "";
  const quantity = parseInt(searchParams.get("qty") || "1");

  const [product, setProduct] = useState<DbProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    async function fetchData() {
      // If resuming an existing order
      if (existingOrderId) {
        const { data: order } = await supabase
          .from("orders")
          .select("id, code, total, subtotal, discount, payment_method, coupon_code")
          .eq("id", existingOrderId)
          .single();

        if (!order) { setLoading(false); return; }

        setDraftOrderId(order.id);
        setDraftOrderCode(order.code);

        // Fetch order items to get main product
        const { data: items } = await supabase
          .from("order_items")
          .select("product_id, name, price, quantity")
          .eq("order_id", existingOrderId);

        if (items && items.length > 0) {
          const mainItem = items[0];
          if (mainItem.product_id) {
            const { data: prod } = await supabase
              .from("products")
              .select("id, name, description, price, image_url, stock, available, category_id, icon_type, external_id, tags, slug")
              .eq("id", mainItem.product_id)
              .single();
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
        setLoading(false);
        return;
      }

      // Normal flow
      if (!productId) {
        if (cartItems.length > 0) {
          // Try to get description from proxy_purchase sessionStorage
          const proxyPurchaseStr = sessionStorage.getItem("proxy_purchase");
          let proxyDescription: string | null = null;
          if (proxyPurchaseStr) {
            try {
              const pp = JSON.parse(proxyPurchaseStr);
              proxyDescription = pp.description || null;
            } catch {}
          }

          // Try to fetch product from DB for description
          let dbDescription: string | null = null;
          let dbTags: string[] | null = null;
          let dbIconType: string | null = null;
          let dbExternalId: string | null = null;
          let dbSlug: string | null = null;
          let dbStock = 999;
          let dbAvailable = true;
          const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cartItems[0].productId);
          if (isValidUUID) {
            const { data: dbProd } = await supabase
              .from("products")
              .select("description, tags, icon_type, external_id, slug, stock, available")
              .eq("id", cartItems[0].productId)
              .single();
            dbDescription = dbProd?.description || null;
            dbTags = dbProd?.tags || null;
            dbIconType = dbProd?.icon_type || null;
            dbExternalId = dbProd?.external_id || null;
            dbSlug = (dbProd as any)?.slug || null;
            dbStock = dbProd?.stock ?? 999;
            dbAvailable = dbProd?.available ?? true;
          }

          // Block checkout for out-of-stock non-proxy products
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
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("products")
        .select("id, name, description, price, image_url, stock, available, category_id, icon_type, external_id, tags, slug")
        .eq("id", productId)
        .single();

      if (data) {
        // Block checkout for out-of-stock non-proxy products
        const isProxy = data.icon_type === 'proxy';
        if (!isProxy && (data.stock <= 0 || !data.available)) {
          toast.error("Este produto está sem estoque no momento.");
          navigate("/loja");
          return;
        }
        setProduct(data);
      }
      setLoading(false);
    }
    fetchData();
  }, [productId, existingOrderId, cartItems]);

  const [paymentMethod, setPaymentMethod] = useState<"saldo" | "pix" | "cartao">("saldo");
  const [selectedBumps, setSelectedBumps] = useState<string[]>([]);
  const [bumpProducts, setBumpProducts] = useState<BumpProduct[]>([]);
  const [promoProxy, setPromoProxy] = useState<BumpProduct | null>(null);
  
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [processing, setProcessing] = useState(false);
  const [pixModal, setPixModal] = useState(false);
  const [pixData, setPixData] = useState<{ qr_code: string | null; qr_code_base64: string | null; amount: number } | null>(null);
  const [pixPaymentId, setPixPaymentId] = useState<string | null>(null);
  const [pixConfirmed, setPixConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [draftOrderId, setDraftOrderId] = useState<string | null>(null);
  const [draftOrderCode, setDraftOrderCode] = useState<string | null>(null);
  const [isFirstPurchase, setIsFirstPurchase] = useState(false);
  const draftCreatingRef = useRef(false);

  // Check if first purchase
  useEffect(() => {
    const checkFirstPurchase = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("status", ["completed", "paid"]);
      setIsFirstPurchase((count ?? 0) === 0);
    };
    checkFirstPurchase();
  }, []);

  // Fetch available bump products from DB (excluding main product)
  useEffect(() => {
    if (!product) return;
    const fetchBumps = async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, description, price, image_url, tags, icon_type")
        .eq("available", true)
        .gt("stock", 0)
        .neq("id", product.id)
        .order("price", { ascending: true })
        .limit(10);
      setBumpProducts(data || []);
    };
    // Fetch the specific promo proxy by ID
    const fetchPromoProxy = async () => {
      const PROMO_PROXY_ID = "6c396fa8-f6a0-43b2-8061-9148213df549";
      if (product.id === PROMO_PROXY_ID) { setPromoProxy(null); return; }
      const { data, error } = await supabase
        .from("products")
        .select("id, name, description, price, image_url, tags, icon_type")
        .eq("id", PROMO_PROXY_ID)
        .maybeSingle();
      console.log("[PromoProxy] fetch result:", { data, error, productId: product.id, isProxy: product.icon_type });
      if (data && data.id) {
        setPromoProxy(data);
      } else {
        setPromoProxy(null);
      }
    };
    fetchBumps();
    fetchPromoProxy();
  }, [product]);

  // Create draft order when entering checkout (for abandoned cart tracking)
  // Skip if resuming an existing order
  useEffect(() => {
    if (!product || draftOrderId || draftCreatingRef.current || existingOrderId) return;

    const createDraftOrder = async () => {
      draftCreatingRef.current = true;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const orderCode = `ORD-${Date.now().toString(36).toUpperCase()}`;

        const { data: order, error } = await supabase.from("orders").insert({
          code: orderCode,
          user_id: user.id,
          subtotal: product.price * quantity,
          discount: 0,
          total: product.price * quantity,
          payment_method: null,
          status: "processing",
          coupon_code: null,
        }).select("id").single();

        if (error) {
          console.error("Error creating draft order:", error);
          return;
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
          orderItems.push({ order_id: order.id, product_id: isValidUUID ? product.id : null, name: product.name, price: product.price, quantity, delivery_data: deliveryData });
        } else {
          for (let i = 0; i < quantity; i++) {
            orderItems.push({ order_id: order.id, product_id: isValidUUID ? product.id : null, name: product.name, price: product.price, quantity: 1, delivery_data: null });
          }
        }
        const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
        if (itemsError) {
          console.error("Error inserting order items:", itemsError);
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
  }, [product]);

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
      if (isMainBM && isBM) return false;
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
        // BM → Perfil > Proxy > Página
        if (isBumpPerfil) score = 30;
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
  }, [product, bumpProducts]);

  const subtotal = useMemo(() => {
    if (!product) return 0;
    let total = product.price * quantity;

    selectedBumps.forEach((bumpId) => {
      const bump = bumpProducts.find((b) => b.id === bumpId);
      if (bump) total += bump.price;
    });

    return total;
  }, [product, quantity, selectedBumps, bumpProducts]);

  const total = subtotal - discount;

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
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", coupon.trim().toUpperCase())
        .eq("status", "active")
        .maybeSingle();

      if (error) throw error;

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

      if (!draftOrderId || !draftOrderCode) {
        toast.error("Erro ao preparar pedido. Recarregue a página.");
        return;
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
            .select("stock, available")
            .eq("id", oi.product_id)
            .single();

          if (!prodCheck || prodCheck.stock <= 0 || !prodCheck.available) {
            toast.error(`"${oi.name}" está sem estoque. Remova do carrinho e tente novamente.`);
            setProcessing(false);
            return;
          }
        }
      }

      const orderId = draftOrderId;
      const orderCode = draftOrderCode;

      // Update draft order with final values (bumps, coupon, payment method, totals)
      const updateData: any = {
        subtotal,
        discount,
        total,
        payment_method: paymentMethod,
        coupon_code: couponApplied ? coupon.trim().toUpperCase() : null,
      };

      // Add bump order items if any
      const extraItems: any[] = [];
      selectedBumps.forEach(bumpId => {
        const bump = bumpProducts.find(b => b.id === bumpId);
        if (bump) extraItems.push({ order_id: orderId, product_id: bump.id, name: bump.name, price: bump.price, quantity: 1 });
      });
      if (extraItems.length > 0) {
        await supabase.from("order_items").insert(extraItems);
      }

      if (paymentMethod === "saldo") {
        const { data: profile } = await supabase.from("profiles").select("balance").eq("user_id", user.id).maybeSingle();
        if (!profile || profile.balance < total) {
          toast.error(`Saldo insuficiente (R$ ${(profile?.balance || 0).toFixed(2).replace(".", ",")}). Redirecionando para PIX...`);
          setPaymentMethod("pix");
          return;
        }

        // Detect proxy provider: Webshare = icon_type proxy + no external_id; ProxyBR = icon_type proxy + external_id
        const isWebshareProduct = product?.icon_type === 'proxy' && !product?.external_id;
        if (isWebshareProduct) {
          updateData.status = "processing";
          await supabase.from("orders").update(updateData).eq("id", orderId);

          toast.info("Ativando seu proxy...");
          const { data: wsResult, error: wsError } = await supabase.functions.invoke("webshare-api", {
            body: {
              action: "purchase-proxy-with-balance",
              order_id: orderId,
              total,
              product_id: product.id,
            },
          });

          if (wsError || wsResult?.error) {
            console.error("Webshare purchase error:", wsError || wsResult?.error);
            toast.error(wsResult?.error || "Erro ao ativar proxy. Contate o suporte.");
            navigate("/orders");
            return;
          }

          if (couponApplied && coupon.trim()) {
            const { data: cpn } = await supabase.from("coupons").select("used_count").eq("code", coupon.trim().toUpperCase()).single();
            if (cpn) await supabase.from("coupons").update({ used_count: cpn.used_count + 1 }).eq("code", coupon.trim().toUpperCase());
          }

          toast.success("Proxy ativado com sucesso!");
          queryClient.invalidateQueries({ queryKey: ["webshare-subscriptions"] });
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
            const { data: productsResult } = await supabase.functions.invoke("proxybr-api", {
              body: { action: "get-products" },
            });
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
          const { data: proxyResult, error: proxyError } = await supabase.functions.invoke("proxybr-api", {
            body: {
              action: "purchase-proxy-with-balance",
              order_id: orderId,
              product_variant_id: variantId,
              quantity: proxyQuantity,
              interval: proxyInterval,
              total,
            },
          });

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
        const { data: createdOrderItems } = await supabase.from("order_items").select("id, product_id").eq("order_id", orderId);

        // Fulfill atomically using DB function
        let fulfillmentFailed = false;
        if (createdOrderItems) {
          for (const oi of createdOrderItems) {
            if (!oi.product_id) continue;

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
            }
          }
        }

        // If fulfillment failed, mark order appropriately so admin can fix
        if (fulfillmentFailed) {
          await supabase.from("orders").update({ status: "pending_fulfillment" }).eq("id", orderId);
          toast.error("Pedido criado mas houve um problema na entrega. Nossa equipe será notificada.");
          // Still debit balance since payment was made - admin will resolve fulfillment
        }

        const newBalance = profile.balance - total;
        await supabase.from("profiles").update({ balance: newBalance }).eq("user_id", user.id);

        await supabase.from("wallet_transactions").insert({
          user_id: user.id, type: "purchase", title: `Compra #${orderCode}`,
          amount: -total, balance_after: newBalance, reference_id: orderId,
        });

        if (couponApplied && coupon.trim()) {
          const { data: cpn } = await supabase.from("coupons").select("used_count").eq("code", coupon.trim().toUpperCase()).single();
          if (cpn) await supabase.from("coupons").update({ used_count: cpn.used_count + 1 }).eq("code", coupon.trim().toUpperCase());
        }

        // Notify admin about completed order
        await supabase.from("notifications").insert({
          title: "Pedido Concluído",
          message: `Pedido #${orderCode} finalizado — R$ ${total.toFixed(2)} (Saldo)`,
          type: "order",
          global: true,
        });

        // Track partner referral
        try {
          const partnerRefId = localStorage.getItem("partner_ref_id");
          if (partnerRefId) {
            const { data: partnerData } = await supabase
              .from("partners")
              .select("id, commission_rate, guarantee_days, total_referrals")
              .eq("id", partnerRefId)
              .eq("status", "active")
              .maybeSingle();

            if (partnerData) {
              const commissionAmount = total * (partnerData.commission_rate / 100);
              await supabase.from("partner_referrals").insert({
                partner_id: partnerData.id,
                referred_user_id: user.id,
                order_id: orderId,
                order_total: total,
                commission_amount: commissionAmount,
                status: "pending",
              });
              await supabase.from("partners").update({
                total_referrals: (partnerData.total_referrals || 0) + 1,
              }).eq("id", partnerData.id);
              // Clear ref after use
              localStorage.removeItem("partner_ref");
              localStorage.removeItem("partner_ref_id");
              localStorage.removeItem("partner_ref_at");
            }
          }
        } catch (refErr) {
          console.error("Partner referral tracking error:", refErr);
        }

        toast.success("Pedido realizado com sucesso!");
        navigate("/orders");

      } else if (paymentMethod === "pix") {
        updateData.status = "processing";
        const { error: updateError } = await supabase.from("orders").update(updateData).eq("id", orderId);
        if (updateError) throw updateError;

        // Pass proxy_data to create-pix-payment so server persists delivery_data (ProxyBR only)
        const proxyDataForPix = getProxyPurchaseData();
        const isProxyBRPix = product?.icon_type === 'proxy' && !!product?.external_id;
        const pixBody: any = { amount: total, order_id: orderId };
        if (proxyDataForPix?.product_variant_id || isProxyBRPix) {
          let pixVariantId = proxyDataForPix?.product_variant_id;
          // Fallback: fetch variant from ProxyBR products API
          if (!pixVariantId && product?.external_id) {
            const { data: productsResult } = await supabase.functions.invoke("proxybr-api", {
              body: { action: "get-products" },
            });
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

        setPixData({ qr_code: pixResult.qr_code, qr_code_base64: pixResult.qr_code_base64, amount: total });
        setPixPaymentId(pixResult.payment_id || null);
        setPixConfirmed(false);
        setCopied(false);
        setPixModal(true);
      } else {
        toast.error("Método de pagamento por cartão ainda não disponível.");
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
                <p className="text-sm text-primary font-semibold mt-0.5">R$ {(product.price * quantity).toFixed(2).replace(".", ",")} {quantity > 1 && `(x${quantity})`}</p>
              </div>
              {product.slug && (
                <button
                  onClick={async () => {
                    const url = `${window.location.origin}/produto/${product.slug}`;
                    try {
                      await navigator.clipboard.writeText(url);
                      setShareCopied(true);
                      toast.success("Link copiado: " + url);
                      setTimeout(() => setShareCopied(false), 2000);
                    } catch {
                      // Fallback for insecure contexts
                      const ta = document.createElement("textarea");
                      ta.value = url;
                      ta.style.position = "fixed";
                      ta.style.opacity = "0";
                      document.body.appendChild(ta);
                      ta.select();
                      document.execCommand("copy");
                      document.body.removeChild(ta);
                      setShareCopied(true);
                      toast.success("Link copiado: " + url);
                      setTimeout(() => setShareCopied(false), 2000);
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
                  <Wallet className="w-6 h-6 text-muted-foreground" />
                  <span className="font-medium text-xs text-foreground">Saldo</span>
                </div>
              </label>
              <label className="cursor-pointer group">
                <input type="radio" name="payment_method" checked={paymentMethod === "pix"} onChange={() => setPaymentMethod("pix")} className="peer sr-only" />
                <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border p-3 text-center transition-all peer-checked:border-primary peer-checked:bg-primary/20 hover:bg-muted/50">
                  <QrCode className="w-6 h-6 text-muted-foreground" />
                  <span className="font-medium text-xs text-foreground">Pix</span>
                </div>
              </label>
              <div className="relative cursor-not-allowed group">
                <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border p-3 text-center opacity-50">
                  <CreditCard className="w-6 h-6 text-muted-foreground" />
                  <span className="font-medium text-xs text-foreground">Cartão</span>
                </div>
                <span className="absolute -top-2 -right-2 bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">EM BREVE</span>
              </div>
            </div>

            {/* Card Form (show only when card is selected) */}
            {paymentMethod === "cartao" && (
              <div className="pt-4 border-t border-border">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="col-span-1 md:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Número do Cartão</label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input type="text" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="0000 0000 0000 0000" className="glass-input w-full rounded-lg py-2.5 pl-9 pr-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-1 focus:ring-primary bg-black/30 border border-border" />
                    </div>
                  </div>
                  <div className="col-span-1 md:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome no Cartão</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input type="text" value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Como impresso no cartão" className="glass-input w-full rounded-lg py-2.5 pl-9 pr-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-1 focus:ring-primary bg-black/30 border border-border" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Validade</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input type="text" value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} placeholder="MM/AA" className="glass-input w-full rounded-lg py-2.5 pl-9 pr-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-1 focus:ring-primary bg-black/30 border border-border" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CVV</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input type="text" value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} placeholder="123" className="glass-input w-full rounded-lg py-2.5 pl-9 pr-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:ring-1 focus:ring-primary bg-black/30 border border-border" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Order Bumps Section */}
          {relevantBumps.length > 0 && (
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
                        <p className="font-bold text-foreground text-xs">{bump.name}</p>
                        <span className="text-primary font-bold text-xs ml-2">+ R$ {bump.price.toFixed(2).replace(".", ",")}</span>
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
              const isMainProxy = product?.icon_type === 'proxy' || product?.tags?.some(t => t.toLowerCase().includes('proxy'));
              if (isMainProxy) return null;
              if (!promoProxy || selectedBumps.includes(promoProxy.id)) return null;
              const PROMO_PRICE = 9.99;
              const originalPrice = 25;
              return (
                <div className="rounded-xl border-2 border-primary bg-gradient-to-b from-primary/10 to-background p-4 flex flex-col gap-2 relative overflow-hidden">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500 text-white w-fit">
                    <Flame className="w-3 h-3" />
                    OPORTUNIDADE ÚNICA
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Complete sua compra!</h3>
                    <p className="text-xs text-muted-foreground">
                      Leve <span className="font-bold text-foreground">{promoProxy.name}</span> e proteja sua operação!
                    </p>
                  </div>
                  <div className="flex items-center justify-between bg-secondary/80 border border-border rounded-lg p-3">
                    <div>
                      <p className="text-xs text-muted-foreground line-through">R$ {originalPrice.toFixed(2).replace(".", ",")}</p>
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
              <h3 className="text-base font-bold text-foreground">Resumo do Pedido</h3>
              
              <div className="flex flex-col gap-3">
                <div className="flex gap-3 items-center">
                  <div className="w-12 h-12 rounded-lg bg-surface border border-border shrink-0 bg-cover bg-center" style={{ backgroundImage: `url('${product.image_url || "/placeholder.svg"}')` }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight truncate">{product.name} {quantity > 1 && `(x${quantity})`}</p>
                    <p className="text-xs text-muted-foreground">R$ {(product.price * quantity).toFixed(2).replace(".", ",")}</p>
                  </div>
                </div>
                {selectedBumps.map((bumpId) => {
                  const bump = bumpProducts.find((b) => b.id === bumpId);
                  if (!bump) return null;
                  return (
                    <div key={bumpId} className="flex gap-3 items-center border-t border-border pt-2">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 shrink-0 bg-cover bg-center" style={{ backgroundImage: bump.image_url ? `url('${bump.image_url}')` : undefined }}>
                        {!bump.image_url && <Flame className="w-4 h-4 text-primary/50 m-auto mt-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground leading-tight truncate">{bump.name}</p>
                        <p className="text-xs text-muted-foreground">R$ {bump.price.toFixed(2).replace(".", ",")}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Coupon */}
              {isFirstPurchase && (
                <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Desbloqueie cupons de desconto após sua primeira compra
                </p>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={coupon}
                  onChange={(e) => { setCoupon(e.target.value); if (couponApplied) { setCouponApplied(false); setDiscount(0); } }}
                  placeholder="Cupom de desconto"
                  disabled={couponApplied || isFirstPurchase}
                  className={`glass-input flex-1 rounded-lg py-2 px-3 text-xs text-foreground placeholder-muted-foreground outline-none focus:ring-1 focus:ring-primary bg-black/30 border ${couponApplied ? "border-emerald-500/50 bg-emerald-500/5" : "border-border"} ${isFirstPurchase ? "opacity-50" : ""}`}
                />
                <button
                  onClick={applyCoupon}
                  disabled={applyingCoupon || couponApplied || isFirstPurchase}
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
                disabled={processing}
                className="w-full bg-primary hover:bg-primary/90 shadow-glow text-primary-foreground font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {processing ? (
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
                    <div className="bg-white rounded-2xl p-4">
                      <img src={`data:image/png;base64,${pixData.qr_code_base64}`} alt="QR Code PIX" className="w-56 h-56" />
                    </div>
                  )}
                  {pixData.qr_code && (
                    <button onClick={handleCopyPix} className="w-full flex items-center justify-center gap-2 bg-muted border border-border rounded-xl px-4 py-3 hover:bg-accent transition-colors">
                      {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4 text-muted-foreground" />}
                      <span className="text-sm font-medium text-foreground">{copied ? "Copiado!" : "Copiar código Pix Copia e Cola"}</span>
                    </button>
                  )}
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
    </div>
  );
}
