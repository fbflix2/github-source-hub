import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function callShopClone(action: string, params: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("shopclone-api", {
    body: { action, ...params },
  });

  if (error) throw new Error(error.message || "Erro ao chamar ShopClone API");
  if (data?.error) throw new Error(data.error);
  if (data?.status === "error") {
    const msg = data.raw
      ? `Erro do fornecedor: ${String(data.raw).substring(0, 200)}`
      : "O fornecedor não retornou dados. Isso pode acontecer quando a API está temporariamente indisponível. Tente novamente em alguns instantes.";
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

export function useShopCloneProducts() {
  return useQuery({
    queryKey: ["shopclone-products"],
    queryFn: async () => {
      const result = await callShopClone("list-products");
      return (result?.categories || []) as ShopCloneCategory[];
    },
    staleTime: 5 * 60_000,
    retry: 2,
    retryDelay: 3000,
  });
}

export function useShopCloneBalance() {
  return useQuery({
    queryKey: ["shopclone-balance"],
    queryFn: async () => {
      const result = await callShopClone("get-balance");
      return result?.balance as string;
    },
    staleTime: 60_000,
  });
}

export function useShopCloneProductInfo(productId: string | null) {
  return useQuery({
    queryKey: ["shopclone-product", productId],
    queryFn: () => callShopClone("product-info", { productId }),
    enabled: !!productId,
  });
}

export async function buyShopCloneResource(productId: string, amount: number, productName?: string, folderName?: string, itemType?: string, unitPriceBrl?: number) {
  return callShopClone("buy-resource", { productId, amount, productName, folderName, itemType, unitPriceBrl });
}
