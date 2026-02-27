import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

/**
 * Calculates total revenue from ALL active proxy subscriptions,
 * using local product prices (matched by external_id or name).
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

  return useMemo(() => {
    if (!subs || !products) return { totalRevenue: 0, count: 0, subsWithPrices: [] };

    const now = new Date();
    const activeSubs = subs.filter(s => {
      if (!s.end_date) return true;
      return new Date(s.end_date) >= now;
    });

    const extIdMap = new Map<string, number>();
    const nameMap = new Map<string, number>();
    products.forEach(p => {
      if (p.external_id) extIdMap.set(String(p.external_id), p.price);
      nameMap.set(p.name.toLowerCase().trim(), p.price);
    });

    let totalRevenue = 0;
    const subsWithPrices = activeSubs.map(sub => {
      const raw = sub.raw_data || {};
      const productId = raw.product?.id;
      const productName = raw.product?.name || sub.name || "";
      let price = 0;

      if (productId && extIdMap.has(String(productId))) {
        price = extIdMap.get(String(productId))!;
      } else if (nameMap.has(productName.toLowerCase().trim())) {
        price = nameMap.get(productName.toLowerCase().trim())!;
      }

      totalRevenue += price;
      return { ...sub, price };
    });

    return { totalRevenue, count: activeSubs.length, subsWithPrices };
  }, [subs, products]);
}
