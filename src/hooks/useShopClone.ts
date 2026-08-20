import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SupplierKey = "accface" | "via17";

async function callShopClone(action: string, params: Record<string, unknown> = {}, supplier: SupplierKey = "accface") {
  const { data, error } = await supabase.functions.invoke("shopclone-api", {
    body: { action, supplier, ...params },
  });

  if (error) {
    console.error("[shopclone] error calling api:", error);
    throw new Error(error.message || "Erro ao chamar ShopClone API");
  }

  // Handle common external supplier raw errors (like 404/File not found)
  if (data?.status === "error" || (typeof data?.balance === "string" && data.balance.includes("File not found")) || (typeof data?.raw === "string" && data.raw.includes("File not found"))) {
    const rawError = data?.raw || data?.balance || "File not found";
    const msg = `Erro do fornecedor: ${String(rawError).substring(0, 100)} (O endpoint ${supplier === "accface" ? "accface.us" : "via17.com"} pode ter mudado)`;
    console.warn("[shopclone] external provider error:", msg);
    throw new Error(msg);
  }

  return data;
}

export interface ShopCloneProduct {
  id: string;
  name: string;
  price: string;
  amount: number;
  country: string;
  description: string;
}

export interface ShopCloneCategory {
  id: string;
  name: string;
  image: string;
  accounts: ShopCloneProduct[];
}

export function useShopCloneProducts(supplier: SupplierKey = "accface") {
  return useQuery({
    queryKey: ["shopclone-products", supplier],
    queryFn: async () => {
      const result = await callShopClone("list-products", {}, supplier);
      return (result?.categories || []) as ShopCloneCategory[];
    },
    staleTime: 5 * 60_000,
    retry: 2,
    retryDelay: 3000,
  });
}

export function useShopCloneBalance(supplier: SupplierKey = "accface") {
  return useQuery({
    queryKey: ["shopclone-balance", supplier],
    queryFn: async () => {
      const result = await callShopClone("get-balance", {}, supplier);
      return result?.balance as string;
    },
    staleTime: 60_000,
  });
}

export function useShopCloneProductInfo(productId: string | null, supplier: SupplierKey = "accface") {
  return useQuery({
    queryKey: ["shopclone-product", productId, supplier],
    queryFn: () => callShopClone("product-info", { productId }, supplier),
    enabled: !!productId,
  });
}

export async function buyShopCloneResource(productId: string, amount: number, productName?: string, folderName?: string, itemType?: string, unitPriceBrl?: number, supplier: SupplierKey = "accface") {
  return callShopClone("buy-resource", { productId, amount, productName, folderName, itemType, unitPriceBrl }, supplier);
}
