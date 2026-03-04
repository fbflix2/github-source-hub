import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

async function callProxyBR(action: string, params: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase.functions.invoke("proxybr-api", { body: { action, ...params } });
  if (error) throw new Error(error.message);
  if (data?.error && !data?.data) throw new Error(data.error);
  return data;
}

/**
 * Calculates total revenue, cost and profit from ALL active proxy subscriptions,
 * using local product prices for revenue and API prices with reseller discounts for cost.
 */
export function useProxyRevenue() {
  // Fetch active subscriptions
  const { data: subs } = useQuery({
    queryKey: ["proxy-revenue-subs"],
    queryFn: async () => {
      let all: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data } = await supabase
          .from("subscriptions")
          .select("name, status, end_date, raw_data, created_at")
          .eq("status", "active")
          .range(from, from + pageSize - 1);
        if (!data?.length) break;
        all = [...all, ...data];
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
    staleTime: 60_000,
  });

  // Fetch local proxy products for price mapping
  const { data: products } = useQuery({
    queryKey: ["proxy-revenue-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("name, price, external_id")
        .not("external_id", "is", null);
      return data ?? [];
    },
    staleTime: 60_000,
  });

  // Fetch API products for cost prices
  const { data: apiProducts } = useQuery({
    queryKey: ["proxybr-products-for-cost"],
    queryFn: () => callProxyBR("get-products"),
    staleTime: 300_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Fetch reseller discounts
  const { data: discountSetting } = useQuery({
    queryKey: ["proxybr-reseller-discounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "proxybr_reseller_discounts")
        .maybeSingle();
      if (error) throw error;
      return data?.value || "{}";
    },
    staleTime: 60_000,
  });

  return useMemo(() => {
    if (!subs || !products) return { totalRevenue: 0, totalCost: 0, totalProfit: 0, count: 0, subsWithPrices: [] };

    const now = new Date();
    const activeSubs = subs.filter(s => {
      if (!s.end_date) return true;
      return new Date(s.end_date) >= now;
    });

    // Sale price maps (local products)
    const extIdMap = new Map<string, number>();
    const nameMap = new Map<string, number>();
    products.forEach(p => {
      if (p.external_id) extIdMap.set(String(p.external_id), p.price);
      nameMap.set(p.name.toLowerCase().trim(), p.price);
    });

    // API cost price map: apiProductId -> variant average price
    const apiCostMap = new Map<string, number>();
    if (apiProducts) {
      const prods: any[] = Array.isArray(apiProducts) ? apiProducts : apiProducts?.data || [];
      for (const prod of prods) {
        const variants = prod.variant || prod.variants || [];
        if (variants.length > 0) {
          // Use average variant price as cost for this product
          const avgPrice = variants.reduce((s: number, v: any) => s + (v.price || 0), 0) / variants.length;
          apiCostMap.set(String(prod.id), avgPrice);
        }
      }
    }

    // Reseller discounts map
    let discountMap: Record<string, string> = {};
    try { discountMap = JSON.parse(discountSetting || "{}"); } catch { /* */ }
    const getDiscount = (apiProductId: string): number => {
      const val = parseFloat(discountMap[apiProductId] || "0");
      return isNaN(val) ? 0 : val;
    };

    let totalRevenue = 0;
    let totalCost = 0;
    let totalCount = 0;
    const subsWithPrices = activeSubs.map(sub => {
      const raw = sub.raw_data || {};
      const productId = raw.product?.id;
      const productName = raw.product?.name || sub.name || "";
      let salePrice = 0;

      if (productId && extIdMap.has(String(productId))) {
        salePrice = extIdMap.get(String(productId))!;
      } else if (nameMap.has(productName.toLowerCase().trim())) {
        salePrice = nameMap.get(productName.toLowerCase().trim())!;
      }

      // Calculate real cost from API price with discount
      let unitCost = 0;
      if (productId && apiCostMap.has(String(productId))) {
        const apiPrice = apiCostMap.get(String(productId))!;
        const discount = getDiscount(String(productId));
        unitCost = apiPrice * (1 - discount / 100);
      }

      // Count individual proxies in multi-proxy subscriptions
      const proxies = raw.proxies?.data;
      const proxyCount = (Array.isArray(proxies) && proxies.length > 1) ? proxies.length : 1;

      totalRevenue += salePrice * proxyCount;
      totalCost += unitCost * proxyCount;
      totalCount += proxyCount;
      return { ...sub, price: salePrice, unitCost, proxyCount };
    });

    const totalProfit = totalRevenue - totalCost;

    return { totalRevenue, totalCost, totalProfit, count: totalCount, subsWithPrices };
  }, [subs, products, apiProducts, discountSetting]);
}
