import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Search, ExternalLink, Bell, CheckCircle, Clock, AlertTriangle, ListFilter,
  ShieldAlert, Plus, Loader2, RefreshCw, Shield, Filter, X, Type, Upload, Send
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { extractBmNameFromInput, extractBmUrlFromInput } from "@/lib/bm-link";

interface BmTracking {
  id: string;
  order_id: string | null;
  order_item_id: string | null;
  stock_item_id: string | null;
  client_user_id: string;
  client_name: string | null;
  client_email: string | null;
  product_name: string;
  bm_link: string;
  sale_price: number;
  sold_at: string;
  expires_at: string;
  status: string;
  notified_at: string | null;
  removed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  perfil_matriz?: string | null;
  bm_display_name?: string | null;
}

function useCountdown(expiresAt: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return { expired: true, text: "Expirado", days: 0, hours: 0 };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return { expired: false, text: `${days}d ${hours}h`, days, hours };
}

function CountdownBadge({ expiresAt, status }: { expiresAt: string; status: string }) {
  const { expired, text, days } = useCountdown(expiresAt);

  if (status === "em_estoque") return null;
  if (status === "removed" || status === "expired") return null;

  if (expired || days === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400 animate-pulse">
        <AlertTriangle className="size-3" />
        {expired ? "Expirado" : text}
      </span>
    );
  }
  if (days <= 1) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-400">
        <Clock className="size-3" />{text}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
      <Clock className="size-3" />{text}
    </span>
  );
}

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  em_estoque: { label: "Na Loja", color: "text-purple-400", bg: "bg-purple-500/15", border: "border-purple-500/30" },
  active: { label: "Vendido", color: "text-green-400", bg: "bg-green-500/15", border: "border-green-500/30" },
  pending_setup: { label: "Aguardando Config", color: "text-blue-400", bg: "bg-blue-500/15", border: "border-blue-500/30" },
  notified: { label: "Notificado", color: "text-yellow-400", bg: "bg-yellow-500/15", border: "border-yellow-500/30" },
  removed: { label: "Removido", color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30" },
  expired: { label: "Expirado", color: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/30" },
};

function StatusBadge({ status }: { status: string }) {
  const s = statusConfig[status] || statusConfig.active;
  return <Badge className={`${s.bg} ${s.color} ${s.border} text-[11px] font-semibold`}>{s.label}</Badge>;
}

const formatPrice = (v: number) => {
  if (!v || v === 0) return null;
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
};

const isEmail = (str: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);

const getBmDisplayName = (item: BmTracking | null) => {
  if (!item) return "—";
  const name = item.bm_display_name || extractBmNameFromInput(item.bm_link) || item.product_name || "—";
  if (isEmail(name)) return item.product_name || "BM";
  return name;
};

const isBmTrackingRow = (item: any) => {
  const normalizedNames = [
    item.product_name,
    item.stock_items?.name,
    item.stock_items?.data?.nomeProduto,
  ].filter(Boolean).map((name) => name.toString().toLowerCase().trim());

  if (normalizedNames.some((name) => name === "email" || name === "e-mail" || name.includes("e-mail"))) {
    return false;
  }

  const stockType = item.stock_items?.type?.toString().toLowerCase().trim();
  if (stockType) return stockType === "bm";

  const rawInput = item.stock_items?.data?.rawBmInput || "";
  const combined = [
    item.product_name,
    item.bm_link,
    item.stock_items?.name,
    item.stock_items?.identification_link,
    rawInput,
  ].filter(Boolean).join(" ").toLowerCase();

  return combined.includes("business.facebook.com") || /\bbm\b/.test(combined) || combined.includes("business manager");
};

const getLast4Digits = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : digits;
};

const hasBmCode = (value: unknown, code: string) => {
  const digitGroups = String(value ?? "").match(/\d{4,}/g) || [];
  return digitGroups.some((group) => group.slice(-4) === code);
};

const getItemBmNames = (item: any): string[] => {
  const bmNames = item?.data?.bmNames;
  if (Array.isArray(bmNames)) return bmNames.map((bm) => String(bm).trim()).filter(Boolean);
  if (typeof bmNames === "string") return bmNames.split(/[\n,;|]+/).map((bm) => bm.trim()).filter(Boolean);
  return [];
};

const isEmailLikeStockItem = (item: any) => {
  const names = [item?.name, item?.data?.nomeProduto].filter(Boolean).map((name) => String(name).toLowerCase().trim());
  return names.some((name) => name === "email" || name === "e-mail" || name.includes("e-mail"));
};

const itemMatchesBmCode = (item: any, code: string) => {
  const type = item?.type?.toString().toLowerCase().trim();
  if (!code || code.length !== 4) return false;

  if (type === "perfil") {
    return getItemBmNames(item).some((bmName) => hasBmCode(bmName, code));
  }

  if (type === "bm" && !isEmailLikeStockItem(item)) {
    return [
      item?.identification,
      item?.identification_link,
      item?.name,
      item?.data?.rawBmInput,
      item?.data?.nomeProduto,
    ].some((field) => hasBmCode(field, code));
  }

  return false;
};

const fetchBmSearchCandidates = async () => {
  const all: any[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("stock_items")
      .select("id, name, type, identification, identification_link, status, data, created_at, order_item_id")
      .is("deleted_at", null)
      .in("type", ["perfil", "bm"])
      .range(from, from + pageSize - 1);

    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return all;
};

export default function AdminGestaoBMs() {
  const { isAdmin, loading: authLoading } = useAdminAuth();
  const [items, setItems] = useState<BmTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    client_name: "", client_email: "", product_name: "", bm_link: "", sale_price: "", notes: ""
  });
  const [adding, setAdding] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState<any[]>([]);
  const [searchingGlobal, setSearchingGlobal] = useState(false);
  const [bulkSearchOpen, setBulkSearchOpen] = useState(false);
  const [bulkSearchList, setBulkSearchList] = useState("");
  const [bulkSearchResults, setBulkSearchResults] = useState<{ id: string; found: boolean; item?: any }[]>([]);
  const [searchingBulk, setSearchingBulk] = useState(false);
  const [protectOpen, setProtectOpen] = useState(false);
  const [protectItem, setProtectItem] = useState<BmTracking | null>(null);
  const [protectForm, setProtectForm] = useState({ bmName: "", bmLink: "" });
  const [protecting, setProtecting] = useState(false);
  const [safeBmClients, setSafeBmClients] = useState<Set<string>>(new Set());
  const [protectedBmTrackingIds, setProtectedBmTrackingIds] = useState<Set<string>>(new Set());

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("bm_tracking")
      .select("*, stock_items:stock_item_id(name, type, identification_link, data)")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar BMs: " + error.message);
    } else {
      const rows = (data || []).filter(isBmTrackingRow);
      // Collect user IDs that have no client_name so we can resolve from profiles
      const nullUuid = "00000000-0000-0000-0000-000000000000";
      const missingNameIds = [
        ...new Set(
          rows
            .filter((r: any) => !r.client_name && r.client_user_id && r.client_user_id !== nullUuid)
            .map((r: any) => r.client_user_id)
        ),
      ];

      let profileMap: Record<string, string> = {};
      if (missingNameIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", missingNameIds);
        if (profiles) {
          profiles.forEach((p: any) => {
            if (p.full_name) profileMap[p.user_id] = p.full_name;
          });
        }
      }

      const mapped = rows.map((item: any) => ({
        ...item,
        client_name: item.client_name || profileMap[item.client_user_id] || null,
        perfil_matriz: item.stock_items?.data?.perfilBackup || null,
        bm_display_name: extractBmNameFromInput(item.stock_items?.data?.rawBmInput)
          || item.stock_items?.name
          || extractBmNameFromInput(item.stock_items?.identification_link)
          || extractBmNameFromInput(item.bm_link)
          || item.product_name,
        stock_items: undefined,
      }));
      setItems(mapped as BmTracking[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin !== null) {
      fetchItems();
      const safeBmSet = new Set<string>();
      
      supabase.from("safe_bm_vaults").select("user_id, bm_tracking_id").then(({ data }) => {
        const protectedIds = new Set<string>();
        if (data) {
          data.forEach((v: any) => {
            safeBmSet.add(v.user_id);
            if (v.bm_tracking_id) protectedIds.add(v.bm_tracking_id);
          });
        }
        setProtectedBmTrackingIds(protectedIds);
      });

      const SAFE_BM_PRODUCT_ID = "e5118c63-ed52-4f4e-8983-f44c1ba0d17b";
      supabase
        .from("order_items")
        .select("orders!inner(user_id, status)")
        .eq("product_id", SAFE_BM_PRODUCT_ID)
        .eq("orders.status", "completed")
        .then(({ data }) => {
          if (data) {
            data.forEach((oi: any) => {
              const uid = oi.orders?.user_id;
              if (uid) safeBmSet.add(uid);
            });
          }
          setSafeBmClients(new Set(safeBmSet));
        });
    }
  }, [isAdmin]);

  useEffect(() => {
    const expireOld = async () => {
      const now = new Date();
      const toExpire = items.filter(i => 
        (i.status === "active" || i.status === "notified") && 
        new Date(i.expires_at).getTime() < now.getTime() - 86400000
      );
      if (toExpire.length === 0) return;
      for (const item of toExpire) {
        await supabase.from("bm_tracking").update({ status: "expired" } as any).eq("id", item.id);
      }
      if (toExpire.length > 0) fetchItems();
    };
    if (items.length > 0) expireOld();
  }, [items.length]);

  // Unique client names for filter
  const uniqueClients = useMemo(() => {
    const names = new Set<string>();
    items.forEach(i => {
      if (i.client_name && i.client_name.trim()) names.add(i.client_name.trim());
    });
    return Array.from(names).sort();
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter(item => {
      if (statusFilter !== "all") {
        if (statusFilter === "vendidos") {
          // "Vendidos" includes active + notified + pending_setup (all sold BMs)
          if (item.status !== "active" && item.status !== "notified" && item.status !== "pending_setup") return false;
        } else {
          if (item.status !== statusFilter) return false;
        }
      }
      if (clientFilter && (item.client_name || "").trim() !== clientFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (item.client_name || "").toLowerCase().includes(q) ||
          item.bm_link.toLowerCase().includes(q) ||
          item.product_name.toLowerCase().includes(q) ||
          getBmDisplayName(item).toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, search, statusFilter, clientFilter]);

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      total: items.length,
      emEstoque: items.filter(i => i.status === "em_estoque").length,
      vendidos: items.filter(i => i.status === "active" || i.status === "notified" || i.status === "pending_setup").length,
      expiringToday: items.filter(i => {
        const diff = new Date(i.expires_at).getTime() - now;
        return (i.status === "active" || i.status === "notified") && diff > 0 && diff < 86400000;
      }).length,
      expired: items.filter(i => i.status === "expired").length,
      removed: items.filter(i => i.status === "removed").length,
    };
  }, [items]);

  const handleGlobalSearch = async () => {
    if (!globalSearchTerm.trim()) return;
    setSearchingGlobal(true);
    setGlobalSearchResults([]);
    try {
      const code = getLast4Digits(globalSearchTerm.trim());
      if (code.length !== 4) {
        setGlobalSearchResults([]);
        return;
      }

      const candidates = await fetchBmSearchCandidates();
      const matches = candidates
        .filter((item) => itemMatchesBmCode(item, code))
        .sort((a, b) => {
          if (a.type === "bm" && b.type !== "bm") return -1;
          if (a.type !== "bm" && b.type === "bm") return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

      // Enrich sold items with buyer info (order_item_id -> orders.user_id -> profiles.full_name)
      const soldIds = matches
        .filter((m: any) => m.status === "vendido" && m.order_item_id)
        .map((m: any) => m.order_item_id);

      const buyerByItem: Record<string, { name: string; order_code?: string; order_id?: string }> = {};
      if (soldIds.length > 0) {
        const { data: oiRows } = await supabase
          .from("order_items")
          .select("id, order_id, orders:order_id(id, code, user_id, created_at)")
          .in("id", soldIds);
        const userIds = [
          ...new Set(((oiRows as any[]) || []).map((r) => r.orders?.user_id).filter(Boolean)),
        ];
        let profileMap: Record<string, { name?: string; phone?: string }> = {};
        if (userIds.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("user_id, full_name, phone")
            .in("user_id", userIds);
          (profs || []).forEach((p: any) => {
            profileMap[p.user_id] = { name: p.full_name, phone: p.phone };
          });
        }
        ((oiRows as any[]) || []).forEach((r) => {
          const uid = r.orders?.user_id;
          buyerByItem[r.id] = {
            name: profileMap[uid]?.name || "—",
            order_code: r.orders?.code,
            order_id: r.orders?.id,
            user_id: uid,
            phone: profileMap[uid]?.phone,
            order_created_at: r.orders?.created_at,
          } as any;
        });
      }

      // Check which stock_items already have a Safe BM vault
      const stockIds = matches.filter((m: any) => m.status === "vendido").map((m: any) => m.id);
      const protectedStockIds = new Set<string>();
      if (stockIds.length > 0) {
        const { data: trackings } = await supabase
          .from("bm_tracking")
          .select("id, stock_item_id")
          .in("stock_item_id", stockIds);
        const trackingIds = (trackings || []).map((t: any) => t.id);
        const trackingToStock: Record<string, string> = {};
        (trackings || []).forEach((t: any) => { trackingToStock[t.id] = t.stock_item_id; });
        if (trackingIds.length > 0) {
          const { data: vaults } = await supabase
            .from("safe_bm_vaults")
            .select("bm_tracking_id, status")
            .in("bm_tracking_id", trackingIds)
            .in("status", ["active", "pending", "suspended"]);
          (vaults || []).forEach((v: any) => {
            const sid = trackingToStock[v.bm_tracking_id];
            if (sid) protectedStockIds.add(sid);
          });
        }
      }

      const enriched = matches.map((m: any) => ({
        ...m,
        _buyer: m.order_item_id ? buyerByItem[m.order_item_id] : undefined,
        _hasSafeBm: protectedStockIds.has(m.id),
      }));

      setGlobalSearchResults(enriched);
    } catch (err: any) {
      toast.error("Erro na busca global: " + err.message);
      console.error("Global search error:", err);
    } finally {
      setSearchingGlobal(false);
    }
  };

  const [notifyingItemId, setNotifyingItemId] = useState<string | null>(null);
  const handleNotifySafeBm = async (item: any) => {
    const buyer = item._buyer;
    if (!buyer?.phone) {
      toast.error("Cliente sem telefone cadastrado.");
      return;
    }
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "bom dia" : hour < 18 ? "boa tarde" : "boa noite";
    const firstName = String(buyer.name || "Cliente").split(" ")[0];
    const bmList = Array.isArray(item.data?.bmNames)
      ? item.data.bmNames.join(", ")
      : (item.data?.bmNames || item.identification || "");
    const orderDate = buyer.order_created_at ? new Date(buyer.order_created_at) : null;
    const days = orderDate
      ? Math.max(0, Math.floor((Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    // Try to load editable template from DB; fall back to inline default
    const fallback =
      `Olá {{nome}}, {{saudacao}}, tudo bem?\n\n` +
      `Percebemos que já se passaram *{{dias}} dias* desde a aquisição da sua BM *{{bm}}* e ela ainda consta no nosso perfil matriz de backup. 🔒\n\n` +
      `Deseja adicionar esse BM ao *Safe BM (Cofre Digital)* e não correr o risco de perder esse BM?\n\n` +
      `Caso seu perfil caia ou seja desabilitado, você recebe o acesso da sua BM de forma *automática, na hora*, mesmo com o perfil bloqueado. ✅\n\n` +
      `Podemos seguir e remover nosso perfil matriz, ou deseja aplicar a proteção do *Cofre Digital* ao seu BM?\n\n` +
      `👉 fbflix.com.br/safe-bm`;
    const { data: tpl } = await supabase
      .from("whatsapp_templates")
      .select("message_body")
      .eq("event_key", "safe_bm_offer")
      .eq("active", true)
      .maybeSingle();
    const template = tpl?.message_body || fallback;
    const message = template
      .split("{{nome}}").join(firstName)
      .split("{{saudacao}}").join(greeting)
      .split("{{dias}}").join(String(days))
      .split("{{bm}}").join(bmList);

    setNotifyingItemId(item.id);
    try {
      const phone = String(buyer.phone).replace(/\D/g, "");
      const normalized = phone.startsWith("55") ? phone : `55${phone}`;
      const { error } = await supabase.functions.invoke("wapi-send", {
        body: {
          action: "send-text",
          phone: normalized,
          message,
          user_id: buyer.user_id,
          event_key: "safe_bm_offer",
          metadata: { stock_item_id: item.id, days_since_purchase: days },
        },
      });
      if (error) throw error;
      toast.success(`Notificação enviada para ${firstName}`);
    } catch (err: any) {
      toast.error("Falha ao enviar: " + err.message);
    } finally {
      setNotifyingItemId(null);
    }
  };

  const handleBulkSearch = async () => {
    const lines = bulkSearchList.split(/[\n,;]+/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    setSearchingBulk(true);
    try {
      const candidates = await fetchBmSearchCandidates();
      const results = [];
      for (const originalId of lines) {
        const last4 = getLast4Digits(originalId);
        if (last4.length !== 4) {
          results.push({ id: originalId, found: false });
          continue;
        }

        const matches = candidates.filter((item) => itemMatchesBmCode(item, last4));

        if (matches.length > 0) {
          const bestMatch = matches.find((m: any) => m.type?.toLowerCase() === "bm") || matches[0];
          results.push({ id: originalId, found: true, item: bestMatch });
        } else {
          results.push({ id: originalId, found: false });
        }
      }
      setBulkSearchResults(results);
    } catch (err: any) {
      toast.error("Erro na busca em massa: " + err.message);
    } finally {
      setSearchingBulk(false);
    }
  };

  const handleOpenProtect = (item: BmTracking) => {
    const bmNameFromLink = getBmDisplayName(item);
    setProtectItem(item);
    setProtectForm({ bmName: bmNameFromLink, bmLink: "" });
    setProtectOpen(true);
  };

  const handleProtect = async () => {
    if (!protectItem) return;
    if (!protectForm.bmName.trim()) return toast.error("Digite o nome da BM");
    if (!protectForm.bmLink.trim()) return toast.error("Cole o link de convite da BM");

    setProtecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-fix-duplicate", {
        body: {
          action: "admin_protect_bm",
          client_user_id: protectItem.client_user_id,
          bm_name: protectForm.bmName.trim(),
          bm_link: protectForm.bmLink.trim(),
          bm_tracking_id: protectItem.id,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Erro ao proteger");
      }

      toast.success(
        data.mode === "configured_existing"
          ? "Cofre existente configurado com sucesso!"
          : "Novo cofre Safe BM criado com sucesso!"
      );
      setProtectOpen(false);
      if (protectItem) {
        setProtectedBmTrackingIds(prev => new Set([...prev, protectItem.id]));
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao proteger BM");
    } finally {
      setProtecting(false);
    }
  };

  const handleNotify = async (item: BmTracking) => {
    const { error: notifErr } = await supabase.from("notifications").insert({
      user_id: item.client_user_id,
      title: "Remoção de Perfil Backup - BM",
      message: `Seus 7 dias de backup na BM "${item.product_name}" expiraram. Por favor, remova nosso perfil de administrador. Após o 8º dia, não somos mais responsáveis pela BM.`,
      type: "info",
    });
    if (notifErr) {
      toast.error("Erro ao notificar: " + notifErr.message);
      return;
    }
    const { error } = await supabase
      .from("bm_tracking")
      .update({ status: "notified", notified_at: new Date().toISOString() } as any)
      .eq("id", item.id);
    if (error) {
      toast.error("Erro ao atualizar status: " + error.message);
    } else {
      toast.success("Cliente notificado com sucesso!");
      fetchItems();
    }
  };

  const handleMarkRemoved = async (item: BmTracking) => {
    const { error } = await supabase
      .from("bm_tracking")
      .update({ status: "removed", removed_at: new Date().toISOString() } as any)
      .eq("id", item.id);
    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      toast.success("Marcado como removido!");
      fetchItems();
    }
  };

  const handleAdd = async () => {
    if (!addForm.bm_link || !addForm.product_name) {
      toast.error("Link da BM e nome do produto são obrigatórios");
      return;
    }
    setAdding(true);
    let clientUserId = "00000000-0000-0000-0000-000000000000";
    if (addForm.client_email) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .ilike("full_name", `%${addForm.client_name}%`)
        .limit(1)
        .maybeSingle();
      if (profile) clientUserId = profile.user_id;
    }

    const { error } = await supabase.from("bm_tracking").insert({
      client_user_id: clientUserId,
      client_name: addForm.client_name || null,
      client_email: addForm.client_email || null,
      product_name: addForm.product_name,
      bm_link: addForm.bm_link,
      sale_price: parseFloat(addForm.sale_price) || 0,
      notes: addForm.notes || null,
    } as any);

    if (error) {
      toast.error("Erro ao adicionar: " + error.message);
    } else {
      toast.success("BM adicionada com sucesso!");
      setAddOpen(false);
      setAddForm({ client_name: "", client_email: "", product_name: "", bm_link: "", sale_price: "", notes: "" });
      fetchItems();
    }
    setAdding(false);
  };

  const hasActiveFilters = statusFilter !== "all" || clientFilter !== "" || search !== "";

  const clearFilters = () => {
    setStatusFilter("all");
    setClientFilter("");
    setSearch("");
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de BMs</h1>
          <p className="text-sm text-muted-foreground">Controle de backup e remoção de perfil admin</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchItems}>
            <RefreshCw className="size-4 mr-1" /> Atualizar
          </Button>
          <div className="flex gap-2">
            <div className="flex bg-muted/50 rounded-md p-0.5 border border-border">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setGlobalSearchOpen(true)}
                className="h-8 px-3 text-xs"
              >
                <Search className="size-3.5 mr-1.5" /> Busca Global
              </Button>
              <div className="w-px h-4 bg-border self-center" />
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setBulkSearchOpen(true)}
                className="h-8 px-3 text-xs"
              >
               <ListFilter className="size-3.5 mr-1.5" /> Busca em Massa
             </Button>
           </div>
           <div className="flex bg-muted/50 rounded-md p-0.5 border border-border">
             <Button 
               variant="ghost" 
               size="sm" 
               onClick={() => {
                 setGlobalSearchTerm("");
                 setGlobalSearchResults([]);
                 setGlobalSearchOpen(true);
               }}
               className="h-8 px-3 text-xs"
             >
               <Search className="size-3.5 mr-1.5" /> Global (Tudo)
             </Button>
           </div>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="size-4 mr-1" /> Adicionar BM
            </Button>
          </div>
      {/* Bulk Search Dialog */}
      <Dialog open={bulkSearchOpen} onOpenChange={setBulkSearchOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListFilter className="size-5 text-primary" />
              Busca em Massa por ID de BM
            </DialogTitle>
            <DialogDescription>
              Cole uma lista de IDs de BM (um por linha ou separados por vírgula). Buscaremos pelos últimos 4 dígitos.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden">
            <div className="flex flex-col gap-3">
              <Label className="text-xs text-muted-foreground uppercase font-bold">Lista de IDs</Label>
              <Textarea
                placeholder="Ex:&#10;27648576038076903&#10;27648576038076951&#10;..."
                value={bulkSearchList}
                onChange={(e) => setBulkSearchList(e.target.value)}
                className="flex-1 min-h-[200px] font-mono text-sm"
              />
              <Button onClick={handleBulkSearch} disabled={searchingBulk || !bulkSearchList.trim()} className="w-full">
                {searchingBulk ? <Loader2 className="size-4 animate-spin mr-2" /> : <Upload className="size-4 mr-2" />}
                Verificar IDs no Sistema
              </Button>
            </div>

            <div className="flex flex-col gap-3 overflow-hidden">
              <Label className="text-xs text-muted-foreground uppercase font-bold flex justify-between">
                Resultado da Verificação
                {bulkSearchResults.length > 0 && (
                  <span className="text-primary normal-case font-normal">
                    {bulkSearchResults.filter(r => r.found).length} de {bulkSearchResults.length} encontrados
                  </span>
                )}
              </Label>
              <div className="flex-1 overflow-y-auto border rounded-md bg-muted/20 p-2 space-y-2">
                {bulkSearchResults.length === 0 && !searchingBulk && (
                  <div className="h-full flex items-center justify-center text-muted-foreground italic text-sm text-center px-4">
                    Aguardando lista para verificação...
                  </div>
                )}
                
                {bulkSearchResults.map((res, i) => (
                  <div key={i} className={`p-2 rounded border flex items-center justify-between gap-3 text-sm ${
                    res.found ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"
                  }`}>
                    <div className="min-w-0">
                      <p className="font-mono text-xs truncate" title={res.id}>{res.id}</p>
                      {res.found && (
                        <div className="flex flex-col">
                          <p className="text-[10px] text-green-400 font-medium truncate">
                            BM {res.id.slice(-4)} no sistema
                          </p>
                          {res.item?.type?.toLowerCase() === "perfil" && (
                            <p className="text-[9px] text-purple-400 truncate italic">
                              Encontrada dentro do perfil: {res.item?.name || "Sem nome"}
                            </p>
                          )}
                          {res.item?.type?.toLowerCase() === "bm" && (
                            <p className="text-[9px] text-blue-400 truncate italic">
                              Item tipo BM: {res.item?.name || "Sem nome"}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">
                      {res.found ? (
                        <div className="flex items-center gap-1.5">
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] py-0 h-5">NO SISTEMA</Badge>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6" 
                            onClick={() => window.open(`/admin/estoque?search=${res.item.id}`, "_blank")}
                          >
                            <ExternalLink className="size-3" />
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-red-400 border-red-500/30 text-[10px] py-0 h-5">NÃO ENCONTRADO</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Global Search Dialog */}
      <Dialog open={globalSearchOpen} onOpenChange={setGlobalSearchOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="size-5 text-primary" />
              Rastreamento Global de BMs
            </DialogTitle>
            <DialogDescription>
              Pesquise pelo código da BM; a busca considera os 4 últimos dígitos e só cruza com BMs cadastradas no item.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Digite o ID da BM ou nome..."
              value={globalSearchTerm}
              onChange={(e) => setGlobalSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGlobalSearch()}
              className="flex-1"
            />
            <Button onClick={handleGlobalSearch} disabled={searchingGlobal}>
              {searchingGlobal ? <Loader2 className="size-4 animate-spin" /> : "Buscar"}
            </Button>
          </div>

          <div className="space-y-3">
            {globalSearchResults.length === 0 && !searchingGlobal && globalSearchTerm && (
              <div className="text-center py-8 text-muted-foreground italic">
                Nenhum item encontrado com este termo.
              </div>
            )}

            {globalSearchResults.map((item) => (
              <div key={item.id} className="p-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {item.type === "perfil" ? "Perfil" : item.type}
                      </Badge>
                      <span className="font-semibold text-foreground">{item.name || "Sem nome"}</span>
                    </div>
                    <div className="text-sm text-muted-foreground flex flex-col gap-1">
                      <span><strong>ID/Identificação:</strong> {item.identification || "—"}</span>
                      {item.data?.bmNames && (
                        <span><strong>BMs no item:</strong> {Array.isArray(item.data.bmNames) ? item.data.bmNames.join(", ") : item.data.bmNames}</span>
                      )}
                      <span><strong>Status:</strong> {item.status}</span>
                      {item.status === "vendido" && item._buyer && (
                        <span className="text-amber-400">
                          <strong>Comprado por:</strong> {item._buyer.name}
                          {item._buyer.order_code ? ` — ${item._buyer.order_code}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground mb-2">
                      Criado em: {new Date(item.created_at).toLocaleDateString("pt-BR")}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/admin/estoque?search=${item.id}`, "_blank")}
                        className="text-[11px] h-7"
                      >
                        Ver no Estoque
                      </Button>
                      {item.status === "vendido" && item._buyer && (() => {
                        const orderDate = item._buyer.order_created_at ? new Date(item._buyer.order_created_at) : null;
                        const days = orderDate
                          ? Math.floor((Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24))
                          : 0;
                        if (item._hasSafeBm) {
                          return (
                            <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] gap-1">
                              <Shield className="size-3" /> Já possui Safe BM
                            </Badge>
                          );
                        }
                        if (days >= 7 && item._buyer.phone) {
                          return (
                            <Button
                              size="sm"
                              onClick={() => handleNotifySafeBm(item)}
                              disabled={notifyingItemId === item.id}
                              className="text-[11px] h-7 gap-1 bg-primary hover:bg-primary/90"
                            >
                              {notifyingItemId === item.id ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Send className="size-3" />
                              )}
                              Notificar cliente ({days}d)
                            </Button>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

        </div>
      </div>

      {/* Stats - compact */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
        {[
          { label: "Na Loja", count: stats.emEstoque, color: "purple", onClick: () => setStatusFilter(statusFilter === "em_estoque" ? "all" : "em_estoque") },
          { label: "Vendidos", count: stats.vendidos, color: "green", onClick: () => setStatusFilter(statusFilter === "vendidos" ? "all" : "vendidos") },
          { label: "Expirando", count: stats.expiringToday, color: "yellow", onClick: undefined },
          { label: "Expirados", count: stats.expired, color: "red", onClick: () => setStatusFilter(statusFilter === "expired" ? "all" : "expired") },
          { label: "Removidos", count: stats.removed, color: "emerald", onClick: () => setStatusFilter(statusFilter === "removed" ? "all" : "removed") },
        ].map(s => (
          <button
            key={s.label}
            onClick={s.onClick}
            className={`p-3 rounded-lg border transition-all text-left ${
              s.color === "purple" ? "border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10" :
              s.color === "green" ? "border-green-500/20 bg-green-500/5 hover:bg-green-500/10" :
              s.color === "yellow" ? "border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/10" :
              s.color === "red" ? "border-red-500/20 bg-red-500/5 hover:bg-red-500/10" :
              "border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10"
            }`}
          >
            <p className="text-2xl font-bold text-foreground">{s.count}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por BM, produto..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <Filter className="size-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="em_estoque">Na Loja</SelectItem>
                <SelectItem value="vendidos">Vendidos (todos)</SelectItem>
                <SelectItem value="active">Vendidos (s/ notificar)</SelectItem>
                <SelectItem value="notified">Notificados</SelectItem>
                <SelectItem value="pending_setup">Aguardando Config</SelectItem>
                <SelectItem value="expired">Expirados</SelectItem>
                <SelectItem value="removed">Removidos</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10 px-3 text-muted-foreground">
                <X className="size-4 mr-1" /> Limpar
              </Button>
            )}
          </div>
          {hasActiveFilters && (
            <p className="text-xs text-muted-foreground mt-2">
              Mostrando {filtered.length} de {items.length} registros
            </p>
          )}
        </CardContent>
      </Card>

      {/* BM Cards / List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma BM encontrada
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Table header - desktop only */}
          <div className="hidden lg:grid lg:grid-cols-[1fr_120px_1fr_100px_80px_100px_120px] gap-4 px-4 py-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
            <span>BM</span>
            <span>Produto</span>
            <span>Nome BM</span>
            <span>Preço</span>
            <span>Prazo</span>
            <span>Status</span>
            <span className="text-right">Ações</span>
          </div>

          {filtered.map(item => {
            const bmName = getBmDisplayName(item);
            const bmUrl = extractBmUrlFromInput(item.bm_link);
            const price = formatPrice(Number(item.sale_price));
            const dateStr = item.status === "em_estoque"
              ? new Date(item.created_at).toLocaleDateString("pt-BR")
              : new Date(item.sold_at).toLocaleDateString("pt-BR");
            const isProtected = protectedBmTrackingIds.has(item.id);
            const canProtect = (item.status === "active" || item.status === "notified") &&
              item.client_user_id !== "00000000-0000-0000-0000-000000000000" &&
              safeBmClients.has(item.client_user_id) && !isProtected;

            return (
              <Card key={item.id} className={`transition-all ${
                item.status === "expired" ? "border-red-500/20 bg-red-500/5" :
                item.status === "removed" ? "opacity-60" : ""
              }`}>
                <CardContent className="p-4">
                  {/* Desktop layout */}
                  <div className="hidden lg:grid lg:grid-cols-[1fr_120px_1fr_100px_80px_100px_120px] gap-4 items-center">
                    {/* Date */}
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{dateStr}</p>
                    </div>

                    {/* Product */}
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{item.product_name}</p>
                      {item.perfil_matriz && (
                        <p className="text-[10px] text-purple-400 truncate">{item.perfil_matriz}</p>
                      )}
                    </div>

                    {/* BM Name + Link */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-foreground truncate" title={bmName}>
                          {bmName}
                        </p>
                        <a
                          href={bmUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80 transition-colors shrink-0"
                          title="Abrir BM"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 truncate flex items-center gap-1">
                        <Type className="size-2.5" /> {item.product_name}
                      </p>
                    </div>

                    {/* Price */}
                    <p className={`text-sm font-semibold ${price ? "text-foreground" : "text-muted-foreground/40"}`}>
                      {price || "—"}
                    </p>

                    {/* Countdown */}
                    <div>
                      <CountdownBadge expiresAt={item.expires_at} status={item.status} />
                    </div>

                    {/* Status */}
                    <StatusBadge status={item.status} />

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1 flex-wrap">
                      {isProtected && (
                        <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] px-2 py-0.5">
                          <Shield className="size-3 mr-0.5" /> Protegido
                        </Badge>
                      )}
                      {canProtect && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-purple-400 border-purple-500/30 hover:bg-purple-500/10 h-6 text-[10px] px-2"
                          onClick={() => handleOpenProtect(item)}
                        >
                          <Shield className="size-3 mr-0.5" /> Proteger
                        </Button>
                      )}
                      {item.status === "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10 h-6 text-[10px] px-2"
                          onClick={() => handleNotify(item)}
                        >
                          <Bell className="size-3 mr-0.5" /> Notificar
                        </Button>
                      )}
                      {(item.status === "active" || item.status === "notified") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 h-6 text-[10px] px-2"
                          onClick={() => handleMarkRemoved(item)}
                        >
                          <CheckCircle className="size-3 mr-0.5" /> Removido
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Mobile layout */}
                  <div className="lg:hidden space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-foreground text-sm truncate">{bmName}</p>
                          <StatusBadge status={item.status} />
                        </div>
                      </div>
                      <a
                        href={bmUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 p-1"
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-2">
                      <span className="text-muted-foreground">
                        BM: <span className="font-medium text-foreground">{bmName}</span>
                      </span>
                      {price && (
                        <span className="font-semibold text-foreground">{price}</span>
                      )}
                      <span className="text-muted-foreground">{dateStr}</span>
                      <CountdownBadge expiresAt={item.expires_at} status={item.status} />
                    </div>

                    <div className="flex items-center gap-1 flex-wrap">
                      {isProtected && (
                        <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] px-2 py-0.5">
                          <Shield className="size-3 mr-0.5" /> Protegido
                        </Badge>
                      )}
                      {canProtect && (
                        <Button size="sm" variant="outline" className="text-purple-400 border-purple-500/30 hover:bg-purple-500/10 h-7 text-xs" onClick={() => handleOpenProtect(item)}>
                          <Shield className="size-3 mr-1" /> Proteger
                        </Button>
                      )}
                      {item.status === "active" && (
                        <Button size="sm" variant="outline" className="text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10 h-7 text-xs" onClick={() => handleNotify(item)}>
                          <Bell className="size-3 mr-1" /> Notificar
                        </Button>
                      )}
                      {(item.status === "active" || item.status === "notified") && (
                        <Button size="sm" variant="outline" className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 h-7 text-xs" onClick={() => handleMarkRemoved(item)}>
                          <CheckCircle className="size-3 mr-1" /> Removido
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add BM Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar BM Manualmente</DialogTitle>
            <DialogDescription>Registre uma BM vendida para acompanhar o período de 7 dias</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Produto *</Label>
              <Input value={addForm.product_name} onChange={e => setAddForm(f => ({ ...f, product_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Link da BM *</Label>
              <Input value={addForm.bm_link} onChange={e => setAddForm(f => ({ ...f, bm_link: e.target.value }))} placeholder="https://business.facebook.com/..." />
            </div>
            <div className="space-y-2">
              <Label>Preço de Venda (R$)</Label>
              <Input type="number" value={addForm.sale_price} onChange={e => setAddForm(f => ({ ...f, sale_price: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={adding}>
              {adding && <Loader2 className="size-4 mr-1 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Protect BM Dialog */}
      <Dialog open={protectOpen} onOpenChange={setProtectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="size-5 text-purple-400" />
              Proteger BM via Safe BM
            </DialogTitle>
            <DialogDescription>
              Configure o cofre Safe BM para a BM <strong>{getBmDisplayName(protectItem)}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da BM</Label>
              <Input
                value={protectForm.bmName}
                onChange={e => setProtectForm(f => ({ ...f, bmName: e.target.value }))}
                placeholder="Ex: BM Principal"
              />
            </div>
            <div className="space-y-2">
              <Label>Link de Convite da BM</Label>
              <Input
                value={protectForm.bmLink}
                onChange={e => setProtectForm(f => ({ ...f, bmLink: e.target.value }))}
                placeholder="https://business.facebook.com/settings/..."
              />
              <p className="text-xs text-muted-foreground">
                Cole o link de convite de admin da BM para configurar o cofre seguro.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProtectOpen(false)}>Cancelar</Button>
            <Button onClick={handleProtect} disabled={protecting} className="bg-purple-600 hover:bg-purple-500">
              {protecting ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Shield className="size-4 mr-1" />}
              Proteger BM
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
