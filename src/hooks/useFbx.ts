import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const FBX_API = `https://${PROJECT_ID}.supabase.co/functions/v1/fbx-api`;

async function fbxFetch(action: string, body?: any) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const res = await fetch(`${FBX_API}?action=${action}`, {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro na API FBX");
  return data;
}

export function useFbxBalance() {
  return useQuery({
    queryKey: ["fbx-balance"],
    queryFn: () => fbxFetch("balance"),
    refetchInterval: 15000,
  });
}

export function useFbxSettings() {
  return useQuery({
    queryKey: ["fbx-settings"],
    queryFn: () => fbxFetch("settings"),
    staleTime: 60000,
  });
}

export function useFbxOrders() {
  return useQuery({
    queryKey: ["fbx-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("fbx_orders")
        .select("*")
        .in("status", ["open", "escrow"])
        .order("created_at", { ascending: false });
      return data || [];
    },
    refetchInterval: 10000,
  });
}

export function useFbxTransactions() {
  return useQuery({
    queryKey: ["fbx-transactions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("fbx_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    refetchInterval: 10000,
  });
}

export function useFbxActions() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["fbx-balance"] });
    qc.invalidateQueries({ queryKey: ["fbx-orders"] });
    qc.invalidateQueries({ queryKey: ["fbx-transactions"] });
  };

  return {
    recharge: async (amount: number) => {
      const res = await fbxFetch("recharge", { amount });
      invalidate();
      return res;
    },
    transfer: async (to_email: string, amount: number) => {
      const res = await fbxFetch("transfer", { to_email, amount });
      invalidate();
      return res;
    },
    createOrder: async (type: "buy" | "sell", quantity: number, pix_key?: string) => {
      const res = await fbxFetch("create-order", { type, quantity, pix_key });
      invalidate();
      return res;
    },
    matchOrder: async (order_id: string) => {
      const res = await fbxFetch("match-order", { order_id });
      invalidate();
      return res;
    },
    confirmOrder: async (order_id: string) => {
      const res = await fbxFetch("confirm-order", { order_id });
      invalidate();
      return res;
    },
    cancelOrder: async (order_id: string) => {
      const res = await fbxFetch("cancel-order", { order_id });
      invalidate();
      return res;
    },
  };
}

export function useFbxStats() {
  return useQuery({
    queryKey: ["fbx-stats"],
    queryFn: () => fbxFetch("stats"),
    staleTime: 30000,
  });
}

export { fbxFetch };
