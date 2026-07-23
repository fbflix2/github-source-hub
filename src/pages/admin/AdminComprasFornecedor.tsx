import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Plus, Trash2, Pencil, Upload, Package, Building2, Users, BarChart3,
  CheckCircle2, XCircle, AlertTriangle, Clock, Search, Eye, FileText,
  TrendingUp, Award, ShieldAlert, Copy, IdCard, KeyRound, Mail, Lock, AtSign, ShieldCheck, UserPlus, ExternalLink, Link2
} from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import FriendRequestLinksTab from "@/components/admin/FriendRequestLinksTab";

const copyToClipboard = (value: string | null | undefined, label: string) => {
  if (!value) {
    toast.error(`${label} vazio`);
    return;
  }
  navigator.clipboard.writeText(value).then(
    () => toast.success(`${label} copiado`),
    () => toast.error("Falha ao copiar")
  );
};

type Supplier = {
  id: string;
  name: string;
  notes: string | null;
  status: string;
  created_at: string;
};

type Batch = {
  id: string;
  supplier_id: string;
  name: string;
  notes: string | null;
  purchased_at: string;
  created_at: string;
  reviewed?: boolean;
  reviewed_at?: string | null;
};

type Account = {
  id: string;
  batch_id: string;
  supplier_id: string;
  profile_link: string | null;
  login: string | null;
  password: string | null;
  email_principal: string | null;
  email_password: string | null;
  email_alt: string | null;
  status: "aguardando" | "em_teste" | "aprovado" | "reprovado";
  logged_in: boolean;
  login_result: string | null;
  sold: boolean;
  client_name: string | null;
  sold_at: string | null;
  country: string | null;
  account_year: number | null;
  has_bm: boolean;
  notes: string | null;
  created_at: string;
  two_factor?: string | null;
  profile_name?: string | null;
  birth_date?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  aguardando: "Aguardando",
  em_teste: "Em teste",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
};

const LOGIN_RESULT_LABEL: Record<string, string> = {
  ok: "OK",
  checkpoint: "Checkpoint",
  bloqueado: "Bloqueado",
  documento: "Documento solicitado",
  suspenso_anuncios: "Suspenso para anúncios",
};

function statusColor(status: string) {
  switch (status) {
    case "aprovado": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "em_teste": return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "aguardando": return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "reprovado": return "bg-red-500/15 text-red-400 border-red-500/30";
    default: return "bg-white/10 text-white/70 border-white/20";
  }
}

function extractNameFromProfileLink(link?: string | null): string | null {
  if (!link) return null;
  try {
    const u = new URL(link);
    // facebook.com/people/<Nome-Sobrenome>/<pfbid...>/
    const m = u.pathname.match(/\/people\/([^/]+)/i);
    if (m?.[1]) {
      const decoded = decodeURIComponent(m[1]).replace(/[-_+]+/g, " ").trim();
      if (decoded && !/^\d+$/.test(decoded)) return decoded;
    }
    // facebook.com/<handle> — only if it looks like a name (letters + dot/dash)
    const seg = u.pathname.split("/").filter(Boolean)[0];
    if (seg && /[a-zA-Z]/.test(seg) && !/^(profile\.php|people|pages|watch|reel|groups|marketplace|login|settings|help|photo|photos|stories|messages|notifications|gaming|events|bookmarks)$/i.test(seg)) {
      const decoded = decodeURIComponent(seg).replace(/[.\-_+]+/g, " ").trim();
      if (decoded.length >= 3 && /\s/.test(decoded)) return decoded;
    }
  } catch {}
  return null;
}

function normalizeAccountCredentials(account: Account): Account {
  const raw = account.notes?.trim();
  if (!raw || !raw.includes("|")) {
    return account;
  }

  const parts = raw.split("|").map((p) => p.trim());
  if (parts.length < 2) {
    return account;
  }

  const login = parts[0] || account.login;
  const password = parts[1] || account.password;
  const rest = parts.slice(2);

  // Real email = has @ and a TLD with a dot (e.g. user@domain.com). This excludes
  // passwords that happen to include "@" (e.g. "AnhSon@17103Cz").
  const isRealEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  const emails = rest.filter(isRealEmail);
  const principalEmail = emails.find((e) => /@(hotmail|outlook|live|msn)\./i.test(e)) || emails[0] || account.email_principal;
  const altEmail = emails.find((e) => /@(fviainboxes|fviamail)\./i.test(e)) || emails.find((e) => e !== principalEmail) || account.email_alt;

  let emailPassword = account.email_password;
  if (principalEmail) {
    const idx = rest.indexOf(principalEmail);
    const candidate = rest[idx + 1];
    // Password may contain "@" (e.g. AnhSon@17103Cz); only reject real emails / urls.
    if (candidate && !isRealEmail(candidate) && !/^https?:\/\//i.test(candidate)) {
      emailPassword = candidate;
    }
  }

  // Detect 2FA token (base32 secret): uppercase A-Z and digits 2-7, length >= 10,
  // appears between password and emails. Skip if already an email/url/cookie blob.
  let twoFactor: string | null = account.two_factor ?? null;
  for (const part of rest) {
    if (!part) continue;
    if (part.includes("@") || /^https?:\/\//i.test(part)) break;
    if (/^[A-Z2-7]{10,}=*$/.test(part)) {
      twoFactor = part;
      break;
    }
  }

  const profileLink = account.profile_link || (/^\d{6,}$/.test(login || "") ? `https://facebook.com/profile.php?id=${login}` : null);

  return {
    ...account,
    login,
    password,
    email_principal: principalEmail || null,
    email_password: emailPassword || null,
    email_alt: altEmail || null,
    profile_link: profileLink,
    two_factor: twoFactor,
  };
}

export default function AdminComprasFornecedor() {
  const [tab, setTab] = useState("dashboard");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterSupplier, setFilterSupplier] = useState<string>("all");
  const [filterBatch, setFilterBatch] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterLoginResult, setFilterLoginResult] = useState<string>("all");
  const [filterSold, setFilterSold] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [batchDateFrom, setBatchDateFrom] = useState("");
  const [batchDateTo, setBatchDateTo] = useState("");
  const [batchSupplierFilter, setBatchSupplierFilter] = useState<string>("all");
  const [batchSearch, setBatchSearch] = useState("");
  const [batchIdFilter, setBatchIdFilter] = useState<string>("all");
  const [batchReviewedFilter, setBatchReviewedFilter] = useState<string>("all"); // all | reviewed | not_reviewed

  // Convert a timestamp to YYYY-MM-DD in Brazil timezone (America/Sao_Paulo, UTC-3)
  const toBrazilDate = (ts: string | null | undefined): string => {
    if (!ts) return "";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    // pt-BR locale with sv-SE-style ISO output via en-CA
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(d);
  };

  const todayBR = () => toBrazilDate(new Date().toISOString());
  const setDatePreset = (preset: "today" | "yesterday" | "7d" | "30d" | "month") => {
    const today = new Date();
    const fmt = (d: Date) => toBrazilDate(d.toISOString());
    if (preset === "today") {
      const t = todayBR(); setBatchDateFrom(t); setBatchDateTo(t);
    } else if (preset === "yesterday") {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      const ys = fmt(y); setBatchDateFrom(ys); setBatchDateTo(ys);
    } else if (preset === "7d") {
      const from = new Date(today); from.setDate(from.getDate() - 6);
      setBatchDateFrom(fmt(from)); setBatchDateTo(todayBR());
    } else if (preset === "30d") {
      const from = new Date(today); from.setDate(from.getDate() - 29);
      setBatchDateFrom(fmt(from)); setBatchDateTo(todayBR());
    } else if (preset === "month") {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      setBatchDateFrom(fmt(from)); setBatchDateTo(todayBR());
    }
  };

  // Modals
  const [supplierModal, setSupplierModal] = useState<{ open: boolean; supplier?: Supplier }>({ open: false });
  const [batchModal, setBatchModal] = useState<{ open: boolean; batch?: Batch }>({ open: false });
  const [importModal, setImportModal] = useState<{ open: boolean; batch?: Batch }>({ open: false });
  const [accountModal, setAccountModal] = useState<{ open: boolean; account?: Account }>({ open: false });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, b, a] = await Promise.all([
        supabase.from("suppliers").select("*").order("created_at", { ascending: false }),
        supabase.from("supplier_batches").select("*").order("created_at", { ascending: false }),
        supabase.from("supplier_accounts").select("*").order("created_at", { ascending: false }).limit(2000),
      ]);
      if (s.error) throw s.error;
      if (b.error) throw b.error;
      if (a.error) throw a.error;
      setSuppliers((s.data || []) as Supplier[]);
      setBatches((b.data || []) as Batch[]);
      setAccounts(((a.data || []) as Account[]).map(normalizeAccountCredentials));
    } catch (err: any) {
      toast.error("Erro ao carregar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    const onFocus = () => void loadAll();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const interval = window.setInterval(() => void loadAll(), 30000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.clearInterval(interval);
    };
  }, []);

  // Auto-fetch profile names via fb-photo (og:title) for accounts that have a
  // profile link but no name saved yet. Runs in the background with concurrency.
  useEffect(() => {
    const pending = accounts.filter(
      (a) =>
        !!a.profile_link &&
        !a.profile_name &&
        !extractNameFromProfileLink(a.profile_link)
    );
    if (pending.length === 0) return;

    let cancelled = false;
    const CONCURRENCY = 3;
    const queue = [...pending];

    async function worker() {
      while (!cancelled && queue.length > 0) {
        const acc = queue.shift();
        if (!acc) break;
        try {
          const url =
            `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/fb-photo?url=` +
            encodeURIComponent(acc.profile_link!);
          const r = await fetch(url, {
            headers: {
              apikey: (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${(import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
          });
          const j = await r.json().catch(() => ({}));
          const name: string | null = j?.name || null;
          if (!name || cancelled) continue;
          const clean = String(name).trim().slice(0, 120);
          if (!clean) continue;
          await supabase.from("supplier_accounts").update({ profile_name: clean }).eq("id", acc.id);
          if (cancelled) return;
          setAccounts((prev) =>
            prev.map((x) => (x.id === acc.id ? { ...x, profile_name: clean } : x))
          );
        } catch {
          /* ignore individual failures */
        }
      }
    }

    const workers = Array.from({ length: CONCURRENCY }, () => worker());
    Promise.all(workers).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accounts]);

  const supplierMap = useMemo(() => Object.fromEntries(suppliers.map(s => [s.id, s])), [suppliers]);
  const batchMap = useMemo(() => Object.fromEntries(batches.map(b => [b.id, b])), [batches]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter(a => {
      if (filterSupplier !== "all" && a.supplier_id !== filterSupplier) return false;
      if (filterBatch !== "all" && a.batch_id !== filterBatch) return false;
      if (filterStatus === "all") {
        // Por padrão, contas aprovadas ficam ocultas da fila (já estão finalizadas).
        if (a.status === "aprovado") return false;
      } else if (a.status !== filterStatus) {
        return false;
      }
      if (filterLoginResult !== "all" && a.login_result !== filterLoginResult) return false;
      if (filterSold === "sold" && !a.sold) return false;
      if (filterSold === "not_sold" && a.sold) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !(a.login || "").toLowerCase().includes(q) &&
          !(a.profile_link || "").toLowerCase().includes(q) &&
          !(a.client_name || "").toLowerCase().includes(q)
        ) return false;
      }
      return true;
    }).sort((a, b) => {
      // Fila ordenada e estável: por lote e depois pela data de criação (mais antigas primeiro).
      const batchA = a.batch_id || "";
      const batchB = b.batch_id || "";
      if (batchA !== batchB) return batchA.localeCompare(batchB);
      const ca = a.created_at || "";
      const cb = b.created_at || "";
      if (ca !== cb) return ca.localeCompare(cb);
      return a.id.localeCompare(b.id);
    });
  }, [accounts, filterSupplier, filterBatch, filterStatus, filterLoginResult, filterSold, search]);

  // ===== Metrics =====
  const stats = useMemo(() => {
    const total = accounts.length;
    const aprovado = accounts.filter(a => a.status === "aprovado").length;
    const reprovado = accounts.filter(a => a.status === "reprovado").length;
    const checkpoint = accounts.filter(a => a.login_result === "checkpoint").length;
    const bloqueado = accounts.filter(a => a.login_result === "bloqueado").length;
    const vendidas = accounts.filter(a => a.sold).length;
    const taxa = total > 0 ? (aprovado / total) * 100 : 0;
    return { total, aprovado, reprovado, checkpoint, bloqueado, vendidas, taxa };
  }, [accounts]);

  const supplierStats = useMemo(() => {
    return suppliers.map(s => {
      const sAccs = accounts.filter(a => a.supplier_id === s.id);
      const total = sAccs.length;
      const apr = sAccs.filter(a => a.status === "aprovado").length;
      const rep = sAccs.filter(a => a.status === "reprovado").length;
      const taxa = total > 0 ? (apr / total) * 100 : 0;
      return { ...s, total, aprovado: apr, reprovado: rep, taxa };
    }).sort((a, b) => b.taxa - a.taxa);
  }, [suppliers, accounts]);

  const batchStats = useMemo(() => {
    return batches
      .filter((b) => {
        if (batchSupplierFilter !== "all" && b.supplier_id !== batchSupplierFilter) return false;
        if (batchIdFilter !== "all" && b.id !== batchIdFilter) return false;
        if (batchReviewedFilter === "reviewed" && !b.reviewed) return false;
        if (batchReviewedFilter === "not_reviewed" && b.reviewed) return false;
        if (batchSearch.trim()) {
          const q = batchSearch.toLowerCase();
          const supplierName = (supplierMap[b.supplier_id]?.name || "").toLowerCase();
          const batchAccounts = accounts.filter((a) => a.batch_id === b.id);
          const hasAccountMatch = batchAccounts.some((a) =>
            [a.login, a.profile_link, a.notes]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(q))
          );

          if (!b.name.toLowerCase().includes(q) && !supplierName.includes(q) && !hasAccountMatch) return false;
        }
        const d = toBrazilDate(b.purchased_at || b.created_at);
        if (batchDateFrom && d < batchDateFrom) return false;
        if (batchDateTo && d > batchDateTo) return false;
        return true;
      })
      .map((b) => {
        const bAccs = accounts
          .filter((a) => a.batch_id === b.id)
          .sort((a, z) => (z.created_at || "").localeCompare(a.created_at || ""));
        const total = bAccs.length;
        const apr = bAccs.filter((a) => a.status === "aprovado").length;
        const chk = bAccs.filter((a) => a.login_result === "checkpoint").length;
        const blq = bAccs.filter((a) => a.login_result === "bloqueado").length;
        const taxaApr = total > 0 ? (apr / total) * 100 : 0;
        const taxaProb = total > 0 ? ((chk + blq) / total) * 100 : 0;
        return {
          ...b,
          total,
          aprovado: apr,
          checkpoint: chk,
          bloqueado: blq,
          taxaApr,
          taxaProb,
          items: bAccs,
          purchaseDateKey: toBrazilDate(b.purchased_at || b.created_at),
        };
      })
      .sort((a, z) => (z.purchased_at || z.created_at || "").localeCompare(a.purchased_at || a.created_at || ""));
  }, [batches, accounts, batchDateFrom, batchDateTo, batchSupplierFilter, batchSearch, batchIdFilter, batchReviewedFilter, supplierMap]);

  const worstBatch = useMemo(() => {
    return [...batchStats].filter((b) => b.total > 0).sort((a, z) => z.taxaProb - a.taxaProb)[0];
  }, [batchStats]);

  const groupedBatchStats = useMemo(() => {
    const groups = new Map<string, typeof batchStats>();

    batchStats.forEach((batch) => {
      const key = batch.purchaseDateKey || "Sem data";
      const current = groups.get(key) || [];
      current.push(batch);
      groups.set(key, current);
    });

    return Array.from(groups.entries()).map(([date, groupBatches]) => ({
      date,
      batches: groupBatches.sort((a, z) => (z.purchased_at || z.created_at || "").localeCompare(a.purchased_at || a.created_at || "")),
    }));
  }, [batchStats]);

  // ===== Quick action =====
  const quickUpdate = async (id: string, patch: Partial<Account>) => {
    // Atualização otimista — UI reage imediatamente (card aprovado some sem delay).
    const previous = accounts.find((a) => a.id === id);
    setAccounts((prev) => prev.map((a) => (a.id === id ? ({ ...a, ...patch } as Account) : a)));
    const { error } = await supabase.from("supplier_accounts").update(patch).eq("id", id);
    if (error) {
      // Reverte caso falhe
      if (previous) {
        setAccounts((prev) => prev.map((a) => (a.id === id ? previous : a)));
      }
      toast.error(error.message);
      return;
    }
    toast.success("Atualizado");
  };

  // ===== Supplier CRUD =====
  const saveSupplier = async (form: { name: string; notes: string }) => {
    if (!form.name.trim()) { toast.error("Nome obrigatório"); return; }
    if (supplierModal.supplier) {
      const { error } = await supabase
        .from("suppliers")
        .update({ name: form.name.trim(), notes: form.notes || null })
        .eq("id", supplierModal.supplier.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("suppliers")
        .insert({ name: form.name.trim(), notes: form.notes || null, created_by: user?.id });
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Fornecedor salvo");
    setSupplierModal({ open: false });
    loadAll();
  };

  const deleteSupplier = async (id: string) => {
    if (!confirm("Excluir fornecedor e TODOS os lotes/contas vinculados?")) return;
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído");
    loadAll();
  };

  // ===== Batch CRUD =====
  const saveBatch = async (form: { supplier_id: string; name: string; notes: string; purchased_at: string }) => {
    if (!form.supplier_id || !form.name.trim()) { toast.error("Fornecedor e nome obrigatórios"); return; }
    if (batchModal.batch) {
      const { error } = await supabase
        .from("supplier_batches")
        .update({ supplier_id: form.supplier_id, name: form.name.trim(), notes: form.notes || null, purchased_at: form.purchased_at })
        .eq("id", batchModal.batch.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("supplier_batches")
        .insert({ supplier_id: form.supplier_id, name: form.name.trim(), notes: form.notes || null, purchased_at: form.purchased_at, created_by: user?.id });
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Lote salvo");
    setBatchModal({ open: false });
    loadAll();
  };

  const deleteBatch = async (id: string) => {
    if (!confirm("Excluir lote e TODAS as contas dele?")) return;
    const { error } = await supabase.from("supplier_batches").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído");
    loadAll();
  };

  const toggleBatchReviewed = async (b: Batch) => {
    const next = !b.reviewed;
    const { error } = await supabase
      .from("supplier_batches")
      .update({ reviewed: next, reviewed_at: next ? new Date().toISOString() : null })
      .eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    setBatches((prev) => prev.map((x) => x.id === b.id ? { ...x, reviewed: next, reviewed_at: next ? new Date().toISOString() : null } : x));
    toast.success(next ? "Lote marcado como revisado" : "Lote marcado como não revisado");
  };

  // ===== Import .txt (auto-detect formats) =====
  // Supports:
  //   ID|SENHA_FB|EMAIL_PRINCIPAL|SENHA_EMAIL|EMAIL_ALT  (5 parts)
  //   ID|SENHA_FB||EMAIL_PRINCIPAL|SENHA_EMAIL|EMAIL_ALT (with empty 3rd)
  //   login|senha|link
  //   login:senha[:link]
  const importAccounts = async (batch: Batch, content: string) => {
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    type Parsed = {
      login: string;
      password: string;
      profile_link?: string;
      email_principal?: string;
      email_password?: string;
      email_alt?: string;
      raw: string;
    };
    const parsed: Parsed[] = [];

    for (const line of lines) {
      const usePipe = line.includes("|");
      const parts = (usePipe ? line.split("|") : line.split(":")).map(p => p.trim());
      if (parts.length < 2) continue;

      const linkIdx = parts.findIndex(p => /^https?:\/\//i.test(p));
      let login = "", password = "", profile_link: string | undefined;
      let email_principal: string | undefined;
      let email_password: string | undefined;
      let email_alt: string | undefined;

      if (usePipe) {
        // First two are always login/senha; remaining tokens are inspected
        login = parts[0] || "";
        password = parts[1] || "";
        const rest = parts.slice(2);

        // Pull link
        const restLinkIdx = rest.findIndex(p => /^https?:\/\//i.test(p));
        if (restLinkIdx >= 0) profile_link = rest[restLinkIdx];

        // Detect REAL emails (must have TLD). Passwords like "AnhSon@17103Cz"
        // also contain "@" but are NOT emails — exclude them via the TLD check.
        const isRealEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
        const isPrincipalDomain = (e: string) => /@(hotmail|outlook|live|msn)\./i.test(e);
        const isAltDomain = (e: string) => /@(fviainboxes|fviamail)\./i.test(e);

        const emails = rest.filter(isRealEmail);
        const principalMatch = emails.find(isPrincipalDomain);
        const altMatch = emails.find(isAltDomain);
        email_principal = principalMatch || emails[0];
        email_alt = altMatch && altMatch !== email_principal ? altMatch : emails.find(e => e !== email_principal);

        // Email password = token immediately after the principal email.
        // Canonical formats supported:
        //   ID|SENHA_FB|EMAIL_PRINCIPAL|SENHA_EMAIL|EMAIL_ALT
        //   ID|SENHA_FB|2FA|COOKIES|EMAIL_PRINCIPAL|SENHA_EMAIL|EMAIL_ALT
        if (email_principal) {
          const idxEmail = rest.indexOf(email_principal);
          const candidate = rest[idxEmail + 1];
          // Password may legitimately contain "@"; only reject real emails / urls.
          if (candidate && !isRealEmail(candidate) && !/^https?:\/\//i.test(candidate)) {
            email_password = candidate;
          }
        }

        // Build profile link from ID if it looks numeric and no link given
        if (!profile_link && /^\d{6,}$/.test(login)) {
          profile_link = `https://facebook.com/profile.php?id=${login}`;
        }
      } else if (linkIdx >= 0) {
        profile_link = parts[linkIdx];
        const rest = parts.filter((_, i) => i !== linkIdx);
        login = rest[0] || "";
        password = rest.slice(1).join(":") || "";
      } else if (parts.length === 2) {
        [login, password] = parts;
      } else {
        login = parts[0];
        password = parts.slice(1).join(":");
      }

      if (!login || !password) continue;
      parsed.push({ login, password, profile_link, email_principal, email_password, email_alt, raw: line });
    }

    if (parsed.length === 0) { toast.error("Nenhuma conta válida encontrada"); return; }

    const rows = parsed.map(p => ({
      batch_id: batch.id,
      supplier_id: batch.supplier_id,
      login: p.login,
      password: p.password,
      profile_link: p.profile_link || null,
      email_principal: p.email_principal || null,
      email_password: p.email_password || null,
      email_alt: p.email_alt || null,
      notes: p.raw,
    }));

    // Insert in chunks to avoid limits
    const chunkSize = 200;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase.from("supplier_accounts").insert(chunk);
      if (error) { toast.error("Erro: " + error.message); return; }
    }
    toast.success(`${parsed.length} contas importadas`);
    setImportModal({ open: false });
    loadAll();
  };

  // ===== Account update =====
  const saveAccount = async (a: Account) => {
    const { error } = await supabase.from("supplier_accounts").update({
      profile_link: a.profile_link, login: a.login, password: a.password,
      email_principal: a.email_principal, email_password: a.email_password, email_alt: a.email_alt,
      status: a.status, logged_in: a.logged_in, login_result: a.login_result,
      sold: a.sold, client_name: a.client_name,
      sold_at: a.sold ? (a.sold_at || new Date().toISOString()) : null,
      country: a.country, account_year: a.account_year,
      has_bm: a.has_bm, notes: a.notes,
    }).eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Conta atualizada");
    setAccountModal({ open: false });
    loadAll();
  };

  const deleteAccount = async (id: string) => {
    if (!confirm("Excluir esta conta?")) return;
    const { error } = await supabase.from("supplier_accounts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluída");
    setAccounts(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="space-y-5 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compras Fornecedor</h1>
          <p className="text-sm text-white/60">Gerencie contas compradas — fornecedores, lotes e qualidade</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <BarChart3 className="size-4 mr-1.5" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <Building2 className="size-4 mr-1.5" /> Fornecedores
          </TabsTrigger>
          <TabsTrigger value="batches" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <Package className="size-4 mr-1.5" /> Lotes
          </TabsTrigger>
          <TabsTrigger value="accounts" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <Users className="size-4 mr-1.5" /> Contas
          </TabsTrigger>
          <TabsTrigger value="friend-links" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <Link2 className="size-4 mr-1.5" /> Links Perfil
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friend-links" className="space-y-3 mt-4">
          <FriendRequestLinksTab batches={batches} suppliers={suppliers} />
        </TabsContent>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard icon={Users} label="Total contas" value={stats.total} color="text-white" />
            <StatCard icon={CheckCircle2} label="Aprovadas" value={`${stats.aprovado} (${stats.taxa.toFixed(1)}%)`} color="text-emerald-400" />
            <StatCard icon={AlertTriangle} label="Checkpoint" value={stats.checkpoint} color="text-amber-400" />
            <StatCard icon={XCircle} label="Bloqueadas" value={stats.bloqueado} color="text-red-400" />
            <StatCard icon={TrendingUp} label="Vendidas" value={stats.vendidas} color="text-blue-400" />
            <StatCard icon={ShieldAlert} label="Reprovadas" value={stats.reprovado} color="text-red-400" />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="size-4 text-amber-400" /> Ranking de fornecedores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {supplierStats.length === 0 && <p className="text-sm text-white/50">Nenhum fornecedor cadastrado ainda</p>}
                {supplierStats.map((s, i) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 p-2 rounded-md bg-white/5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-white/40 w-6">#{i + 1}</span>
                      <span className="text-sm font-medium truncate">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-white/50">{s.total} contas</span>
                      <span className={`font-bold ${s.taxa >= 70 ? "text-emerald-400" : s.taxa >= 40 ? "text-amber-400" : "text-red-400"}`}>
                        {s.taxa.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="size-4 text-red-400" /> Lote com mais problemas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!worstBatch && <p className="text-sm text-white/50">Sem dados suficientes</p>}
                {worstBatch && (
                  <div className="space-y-2">
                    <div className="text-base font-bold">{worstBatch.name}</div>
                    <div className="text-xs text-white/60">Fornecedor: {supplierMap[worstBatch.supplier_id]?.name || "-"}</div>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="bg-white/5 p-2 rounded text-center">
                        <div className="text-xs text-white/50">Total</div>
                        <div className="font-bold">{worstBatch.total}</div>
                      </div>
                      <div className="bg-amber-500/10 p-2 rounded text-center">
                        <div className="text-xs text-amber-400">Checkpoint</div>
                        <div className="font-bold text-amber-400">{worstBatch.checkpoint}</div>
                      </div>
                      <div className="bg-red-500/10 p-2 rounded text-center">
                        <div className="text-xs text-red-400">Bloqueado</div>
                        <div className="font-bold text-red-400">{worstBatch.bloqueado}</div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* SUPPLIERS */}
        <TabsContent value="suppliers" className="space-y-3 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setSupplierModal({ open: true })} size="sm">
              <Plus className="size-4 mr-1" /> Novo fornecedor
            </Button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {suppliers.length === 0 && (
              <Card className="bg-white/5 border-white/10 col-span-full">
                <CardContent className="p-6 text-center text-sm text-white/50">
                  Nenhum fornecedor. Crie o primeiro acima.
                </CardContent>
              </Card>
            )}
            {supplierStats.map(s => (
              <Card key={s.id} className="bg-white/5 border-white/10 hover:border-primary/30 transition">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-base truncate">{s.name}</div>
                      {s.notes && <div className="text-xs text-white/50 mt-0.5 line-clamp-2">{s.notes}</div>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => setSupplierModal({ open: true, supplier: s })}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7 text-red-400 hover:text-red-300" onClick={() => deleteSupplier(s.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white/5 p-2 rounded">
                      <div className="text-xs text-white/50">Total</div>
                      <div className="font-bold text-sm">{s.total}</div>
                    </div>
                    <div className="bg-emerald-500/10 p-2 rounded">
                      <div className="text-xs text-emerald-400">Aprov.</div>
                      <div className="font-bold text-sm text-emerald-400">{s.aprovado}</div>
                    </div>
                    <div className="bg-red-500/10 p-2 rounded">
                      <div className="text-xs text-red-400">Reprov.</div>
                      <div className="font-bold text-sm text-red-400">{s.reprovado}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/50">Aproveitamento</span>
                    <span className={`font-bold ${s.taxa >= 70 ? "text-emerald-400" : s.taxa >= 40 ? "text-amber-400" : "text-red-400"}`}>
                      {s.taxa.toFixed(1)}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* BATCHES */}
        <TabsContent value="batches" className="space-y-3 mt-4">
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-white/40" />
                  <Input
                    value={batchSearch}
                    onChange={(e) => setBatchSearch(e.target.value)}
                    placeholder="Buscar lote, fornecedor ou item comprado..."
                    className="pl-8 h-9 bg-white/5 border-white/10"
                  />
                </div>
                <Select value={batchSupplierFilter} onValueChange={setBatchSupplierFilter}>
                  <SelectTrigger className="w-[180px] h-9 bg-white/5 border-white/10">
                    <SelectValue placeholder="Fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos fornecedores</SelectItem>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={batchIdFilter} onValueChange={setBatchIdFilter}>
                  <SelectTrigger className="w-[220px] h-9 bg-white/5 border-white/10">
                    <SelectValue placeholder="Lote" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os lotes</SelectItem>
                    {batches
                      .filter(b => batchSupplierFilter === "all" || b.supplier_id === batchSupplierFilter)
                      .map(b => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.reviewed ? "✓ " : ""}{b.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Select value={batchReviewedFilter} onValueChange={setBatchReviewedFilter}>
                  <SelectTrigger className="w-[170px] h-9 bg-white/5 border-white/10">
                    <SelectValue placeholder="Revisão" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos (revisão)</SelectItem>
                    <SelectItem value="not_reviewed">Não revisados</SelectItem>
                    <SelectItem value="reviewed">Revisados</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={loadAll} size="sm" variant="outline">
                  Atualizar
                </Button>
                <Button onClick={() => setBatchModal({ open: true })} size="sm" disabled={suppliers.length === 0}>
                  <Plus className="size-4 mr-1" /> Novo lote
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-white/60">Período:</span>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setDatePreset("today")}>Hoje</Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setDatePreset("yesterday")}>Ontem</Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setDatePreset("7d")}>7 dias</Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setDatePreset("30d")}>30 dias</Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setDatePreset("month")}>Este mês</Button>
                <span className="text-white/30">|</span>
                <Input
                  type="date"
                  value={batchDateFrom}
                  onChange={(e) => setBatchDateFrom(e.target.value)}
                  className="h-8 w-[150px] bg-white/5 border-white/10 [color-scheme:dark]"
                />
                <span className="text-white/40 text-xs">até</span>
                <Input
                  type="date"
                  value={batchDateTo}
                  onChange={(e) => setBatchDateTo(e.target.value)}
                  className="h-8 w-[150px] bg-white/5 border-white/10 [color-scheme:dark]"
                />
                {(batchDateFrom || batchDateTo || batchSupplierFilter !== "all" || batchSearch || batchIdFilter !== "all" || batchReviewedFilter !== "all") && (
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => {
                    setBatchDateFrom(""); setBatchDateTo("");
                    setBatchSupplierFilter("all"); setBatchSearch("");
                    setBatchIdFilter("all"); setBatchReviewedFilter("all");
                  }}>
                    Limpar tudo
                  </Button>
                )}
                <span className="ml-auto text-xs text-white/50">
                  {batchStats.length} de {batches.length} lotes
                </span>
              </div>
            </CardContent>
          </Card>
          {suppliers.length === 0 && (
            <Card className="bg-amber-500/10 border-amber-500/30">
              <CardContent className="p-3 text-xs text-amber-300">Cadastre um fornecedor antes de criar lotes.</CardContent>
            </Card>
          )}
          <div className="space-y-4">
            {groupedBatchStats.map((group) => (
              <div key={group.date} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Compras de {group.date === todayBR() ? "hoje" : group.date}</h3>
                    <p className="text-xs text-white/50">{group.batches.length} lote(s) nesta data</p>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.batches.map((b) => (
                    <Card key={b.id} className="bg-white/5 border-white/10 hover:border-primary/30 transition">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-base truncate flex items-center gap-2">
                              {b.name}
                              {(b as any).type === "replacement" && (
                                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[9px] px-1.5 py-0">Reposição</Badge>
                              )}
                              {b.reviewed && (
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] px-1.5 py-0">Revisado</Badge>
                              )}
                            </div>
                            <div className="text-xs text-white/50 mt-0.5">{supplierMap[b.supplier_id]?.name || "-"}</div>
                            <div className="text-[10px] text-white/40 mt-0.5">
                              {new Date(b.purchased_at || b.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <Button size="icon" variant="ghost" className="size-7" onClick={() => setImportModal({ open: true, batch: b })} title="Importar .txt">
                              <Upload className="size-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="size-7" onClick={() => setBatchModal({ open: true, batch: b })}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="size-7 text-red-400 hover:text-red-300" onClick={() => deleteBatch(b.id)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="bg-white/5 p-2 rounded">
                            <div className="text-xs text-white/50">Contas</div>
                            <div className="font-bold">{b.total}</div>
                          </div>
                          <div className="bg-emerald-500/10 p-2 rounded">
                            <div className="text-xs text-emerald-400">Aprov.</div>
                            <div className="font-bold text-emerald-400">{b.taxaApr.toFixed(0)}%</div>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-medium text-white/70">Itens desta compra</div>
                          {b.items.length > 0 ? (() => {
                            const item = b.items[0];
                            return (
                            <div key={item.id} className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 space-y-1">
                              <div className="flex items-center gap-1 flex-wrap">
                                <Badge className={`${statusColor(item.status)} border text-[10px] px-1.5 py-0`}>{STATUS_LABEL[item.status]}</Badge>
                                {item.has_bm && <Badge className="bg-purple-500/15 text-purple-400 border border-purple-500/30 px-1.5 py-0 text-[10px]">BM</Badge>}
                                {item.login_result && <Badge className="bg-white/10 text-white/70 border border-white/20 px-1.5 py-0 text-[10px]">{LOGIN_RESULT_LABEL[item.login_result]}</Badge>}
                                {b.items.length > 1 && (
                                  <Badge className="bg-primary/15 text-primary border border-primary/30 px-1.5 py-0 text-[10px] ml-auto">
                                    +{b.items.length - 1} no lote
                                  </Badge>
                                )}
                              </div>
                              <div className="space-y-0.5">
                                {[
                                  { icon: IdCard, label: "ID", value: item.login, color: "text-sky-400" },
                                  { icon: KeyRound, label: "Senha FB", value: item.password, color: "text-amber-400", mono: true },
                                  ...(item.two_factor ? [{ icon: ShieldCheck, label: "2FA", value: item.two_factor, color: "text-cyan-400", mono: true }] : []),
                                  { icon: Mail, label: "Email", value: item.email_principal, color: "text-emerald-400" },
                                  { icon: Lock, label: "Senha email", value: item.email_password, color: "text-orange-400", mono: true },
                                  { icon: AtSign, label: "Email alt", value: item.email_alt, color: "text-purple-400" },
                                ].map(({ icon: Icon, label, value, color, mono }) => (
                                  <div key={label} className="flex items-center gap-1 text-[10px] group">
                                    <Icon className={`size-2.5 shrink-0 ${color}`} />
                                    <span className="text-white/40 shrink-0 w-[60px]">{label}:</span>
                                    <span className={`flex-1 truncate text-white/85 ${mono ? "font-mono" : ""}`}>{value || "—"}</span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-4 w-4 p-0 opacity-50 hover:opacity-100 hover:bg-white/10 shrink-0"
                                      onClick={(e) => { e.stopPropagation(); copyToClipboard(value, label); }}
                                      title={`Copiar ${label}`}
                                      disabled={!value}
                                    >
                                      <Copy className="size-2.5" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                            );
                          })() : (
                            <div className="rounded-md border border-dashed border-white/10 px-2 py-2 text-[11px] text-white/45">Nenhum item vinculado a este lote ainda.</div>
                          )}
                        </div>
                        <Button size="sm" variant="outline" className="w-full" onClick={() => {
                          setFilterBatch(b.id);
                          setFilterSupplier("all");
                          setTab("accounts");
                        }}>
                          <Eye className="size-3.5 mr-1" /> Ver contas do lote
                        </Button>
                        <Button
                          size="sm"
                          variant={b.reviewed ? "secondary" : "default"}
                          className={`w-full ${b.reviewed ? "" : "bg-emerald-600 hover:bg-emerald-500 text-white"}`}
                          onClick={() => toggleBatchReviewed(b)}
                        >
                          <ShieldCheck className="size-3.5 mr-1" />
                          {b.reviewed ? "Desmarcar revisão" : "Marcar como revisado"}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
            {batchStats.length === 0 && suppliers.length > 0 && (
              <Card className="bg-white/5 border-white/10 col-span-full">
                <CardContent className="p-6 text-center text-sm text-white/50">Nenhum lote encontrado com os filtros atuais</CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ACCOUNTS */}
        <TabsContent value="accounts" className="space-y-3 mt-4">
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-3 flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-white/40" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar login, link ou cliente..." className="pl-8 h-9 bg-white/5 border-white/10" />
              </div>
              <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                <SelectTrigger className="w-[160px] h-9 bg-white/5 border-white/10"><SelectValue placeholder="Fornecedor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos fornecedores</SelectItem>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterBatch} onValueChange={setFilterBatch}>
                <SelectTrigger className="w-[160px] h-9 bg-white/5 border-white/10"><SelectValue placeholder="Lote" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos lotes</SelectItem>
                  {batches.filter(b => filterSupplier === "all" || b.supplier_id === filterSupplier).map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px] h-9 bg-white/5 border-white/10"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterLoginResult} onValueChange={setFilterLoginResult}>
                <SelectTrigger className="w-[160px] h-9 bg-white/5 border-white/10"><SelectValue placeholder="Login" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos logins</SelectItem>
                  {Object.entries(LOGIN_RESULT_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterSold} onValueChange={setFilterSold}>
                <SelectTrigger className="w-[140px] h-9 bg-white/5 border-white/10"><SelectValue placeholder="Venda" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="sold">Vendidas</SelectItem>
                  <SelectItem value="not_sold">Não vendidas</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <div className="text-xs text-white/50">{filteredAccounts.length} de {accounts.length} contas</div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredAccounts.map(a => (
              <Card key={a.id} className="bg-white/5 border-white/10 hover:border-primary/30 transition">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{a.login || "—"}</div>
                      {(a.profile_name || extractNameFromProfileLink(a.profile_link)) && (
                        <div className="text-[11px] text-white/70 truncate">
                          👤 {a.profile_name || extractNameFromProfileLink(a.profile_link)}
                        </div>
                      )}
                      <div className="text-[10px] text-white/40 truncate">{batchMap[a.batch_id]?.name} · {supplierMap[a.supplier_id]?.name}</div>
                    </div>
                    <Badge className={`${statusColor(a.status)} border text-[10px] px-1.5 py-0`}>{STATUS_LABEL[a.status]}</Badge>
                  </div>

                  {/* Credenciais organizadas: ID | SENHA FB | EMAIL PRINCIPAL | SENHA EMAIL | EMAIL ALT */}
                  <div className="space-y-1 rounded-md bg-black/20 border border-white/5 p-2">
                    {[
                      { icon: IdCard, label: "ID da conta", value: a.login, color: "text-sky-400" },
                      { icon: KeyRound, label: "Senha FB", value: a.password, color: "text-amber-400", mono: true },
                      ...(a.two_factor ? [{ icon: ShieldCheck, label: "Token 2FA", value: a.two_factor, color: "text-cyan-400", mono: true }] : []),
                      { icon: Mail, label: "Email principal", value: a.email_principal, color: "text-emerald-400" },
                      { icon: Lock, label: "Senha do email", value: a.email_password, color: "text-orange-400", mono: true },
                      { icon: AtSign, label: "Email alternativo", value: a.email_alt, color: "text-purple-400" },
                    ].map(({ icon: Icon, label, value, color, mono }) => (
                      <div key={label} className="flex items-center gap-1.5 text-[11px] group">
                        <Icon className={`size-3 shrink-0 ${color}`} />
                        <span className="text-white/40 shrink-0 w-[88px]">{label}:</span>
                        <span className={`flex-1 truncate text-white/85 ${mono ? "font-mono" : ""}`}>{value || "—"}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0 opacity-50 hover:opacity-100 hover:bg-white/10 shrink-0"
                          onClick={() => copyToClipboard(value, label)}
                          title={`Copiar ${label}`}
                          disabled={!value}
                        >
                          <Copy className="size-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full mt-1 h-6 text-[10px] text-white/50 hover:text-white hover:bg-white/10 gap-1"
                      onClick={() => {
                        const derivedName = a.profile_name || extractNameFromProfileLink(a.profile_link);
                        const lines = [
                          derivedName ? `Nome do perfil: ${derivedName}` : "",
                          a.login ? `ID da conta: ${a.login}` : "",
                          a.password ? `Senha FB: ${a.password}` : "",
                          a.two_factor ? `Token 2FA: ${a.two_factor}` : "",
                          a.email_principal ? `Email principal: ${a.email_principal}` : "",
                          a.email_password ? `Senha do email: ${a.email_password}` : "",
                          a.email_alt ? `Email alternativo: ${a.email_alt}` : "",
                          a.profile_link ? `Link do perfil: ${a.profile_link}` : "",
                        ].filter(Boolean).join("\n");
                        if (!lines) { toast.error("Nenhum dado para copiar"); return; }
                        navigator.clipboard.writeText(lines).then(
                          () => toast.success("Todos os dados copiados!"),
                          () => toast.error("Falha ao copiar")
                        );
                      }}
                      title="Copiar todos os dados"
                    >
                      <Copy className="size-3" /> Copiar Tudo
                    </Button>
                  </div>

                  {a.profile_link && (
                    <div className="space-y-0.5">
                      <a href={a.profile_link} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-400 hover:underline truncate block">
                        {a.profile_link}
                      </a>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1 text-[10px]">
                    {a.logged_in && <Badge className="bg-blue-500/15 text-blue-400 border border-blue-500/30 px-1.5 py-0">Logada</Badge>}
                    {a.login_result && <Badge className="bg-white/10 text-white/70 border border-white/20 px-1.5 py-0">{LOGIN_RESULT_LABEL[a.login_result]}</Badge>}
                    {a.sold && <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0">Vendida</Badge>}
                    {a.has_bm && <Badge className="bg-purple-500/15 text-purple-400 border border-purple-500/30 px-1.5 py-0">BM</Badge>}
                    {a.country && <Badge className="bg-white/10 text-white/70 border border-white/20 px-1.5 py-0">{a.country}</Badge>}
                  </div>

                  <div className="grid grid-cols-3 gap-1">
                    <Button size="sm" variant="outline" className="h-7 px-1 text-[10px]" onClick={() => quickUpdate(a.id, { logged_in: true })} title="Loguei">
                      <Clock className="size-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-1 text-[10px] border-amber-500/30 text-amber-400 hover:bg-amber-500/10" onClick={() => quickUpdate(a.id, { status: "reprovado", login_result: "checkpoint", logged_in: true })} title="Checkpoint">
                      <AlertTriangle className="size-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-1 text-[10px] border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => quickUpdate(a.id, { status: "reprovado", login_result: "bloqueado", logged_in: true })} title="Bloqueado">
                      <XCircle className="size-3" />
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-8 text-[11px] font-semibold border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/15 mt-1"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (a.status === "aprovado") return;
                      if (!confirm(`Marcar conta "${a.login || a.id}" como APROVADA? Ela sairá da fila.`)) return;
                      quickUpdate(a.id, { status: "aprovado", login_result: "ok", logged_in: true });
                    }}
                    title="Marcar como aprovada (requer confirmação)"
                  >
                    <CheckCircle2 className="size-3 mr-1" /> Aprovar conta
                  </Button>

                  <div className="flex justify-between items-center pt-1">
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setAccountModal({ open: true, account: a })}>
                      <Pencil className="size-3 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-red-400 hover:text-red-300" onClick={() => deleteAccount(a.id)}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredAccounts.length === 0 && (
              <Card className="bg-white/5 border-white/10 col-span-full">
                <CardContent className="p-6 text-center text-sm text-white/50">
                  {loading ? "Carregando..." : "Nenhuma conta encontrada"}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <SupplierModal modal={supplierModal} onClose={() => setSupplierModal({ open: false })} onSave={saveSupplier} />
      <BatchModal modal={batchModal} suppliers={suppliers} onClose={() => setBatchModal({ open: false })} onSave={saveBatch} />
      <ImportModal modal={importModal} onClose={() => setImportModal({ open: false })} onImport={importAccounts} />
      <AccountModal modal={accountModal} onClose={() => setAccountModal({ open: false })} onSave={saveAccount} />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: any; color: string }) {
  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-xs text-white/50"><Icon className="size-3.5" /> {label}</div>
        <div className={`text-xl font-bold mt-1 ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function SupplierModal({ modal, onClose, onSave }: any) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (modal.open) {
      setName(modal.supplier?.name || "");
      setNotes(modal.supplier?.notes || "");
    }
  }, [modal]);
  return (
    <Dialog open={modal.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#120808] border-white/10 max-w-md">
        <DialogHeader><DialogTitle>{modal.supplier ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white/5 border-white/10" />
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="bg-white/5 border-white/10" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave({ name, notes })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BatchModal({ modal, suppliers, onClose, onSave }: any) {
  const [supplier_id, setSupplier] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [purchased_at, setPurchased] = useState(new Date().toISOString().slice(0, 10));
  useEffect(() => {
    if (modal.open) {
      setSupplier(modal.batch?.supplier_id || (suppliers[0]?.id || ""));
      setName(modal.batch?.name || new Date().toLocaleDateString("pt-BR"));
      setNotes(modal.batch?.notes || "");
      setPurchased(modal.batch?.purchased_at || new Date().toISOString().slice(0, 10));
    }
  }, [modal, suppliers]);
  return (
    <Dialog open={modal.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#120808] border-white/10 max-w-md">
        <DialogHeader><DialogTitle>{modal.batch ? "Editar lote" : "Novo lote"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Fornecedor *</Label>
            <Select value={supplier_id} onValueChange={setSupplier}>
              <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Nome do lote *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white/5 border-white/10" />
          </div>
          <div>
            <Label className="text-xs">Data da compra</Label>
            <Input type="date" value={purchased_at} onChange={(e) => setPurchased(e.target.value)} className="bg-white/5 border-white/10" />
          </div>
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="bg-white/5 border-white/10" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave({ supplier_id, name, notes, purchased_at })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportModal({ modal, onClose, onImport }: any) {
  const [content, setContent] = useState("");
  useEffect(() => { if (modal.open) setContent(""); }, [modal]);
  const onFile = async (e: any) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setContent(text);
  };
  return (
    <Dialog open={modal.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#120808] border-white/10 max-w-lg">
        <DialogHeader><DialogTitle>Importar contas — {modal.batch?.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-white/60">
            Formatos aceitos por linha:<br/>
            • <code className="text-primary">ID|SENHA_FB|EMAIL|SENHA_EMAIL|EMAIL_ALT</code> (formato completo)<br/>
            • <code className="text-primary">login|senha|link</code> ou <code className="text-primary">login:senha[:link]</code><br/>
            O sistema separa automaticamente login, senha do FB, emails e senha do email.
          </p>
          <div>
            <Label className="text-xs">Arquivo .txt</Label>
            <Input type="file" accept=".txt,text/plain" onChange={onFile} className="bg-white/5 border-white/10" />
          </div>
          <div>
            <Label className="text-xs">Ou cole o conteúdo aqui</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} placeholder="login1:senha1&#10;login2:senha2:https://facebook.com/profile" className="bg-white/5 border-white/10 font-mono text-xs" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onImport(modal.batch, content)} disabled={!content.trim()}>
            <Upload className="size-4 mr-1" /> Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccountModal({ modal, onClose, onSave }: any) {
  const [a, setA] = useState<Account | null>(null);
  useEffect(() => { if (modal.open) setA(modal.account ? normalizeAccountCredentials(modal.account) : null); }, [modal]);
  if (!a) return null;
  const upd = (k: keyof Account, v: any) => setA({ ...a, [k]: v });
  return (
    <Dialog open={modal.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#120808] border-white/10 max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar conta</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs">Link do perfil</Label>
            <Input value={a.profile_link || ""} onChange={(e) => upd("profile_link", e.target.value)} className="bg-white/5 border-white/10" />
          </div>
          <div>
            <Label className="text-xs">Login (ID Facebook)</Label>
            <Input value={a.login || ""} onChange={(e) => upd("login", e.target.value)} className="bg-white/5 border-white/10" />
          </div>
          <div>
            <Label className="text-xs">Senha do Facebook</Label>
            <Input value={a.password || ""} onChange={(e) => upd("password", e.target.value)} className="bg-white/5 border-white/10" />
          </div>
          <div className="col-span-2 grid grid-cols-2 gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/10">
            <div className="col-span-2 text-[11px] uppercase tracking-wide text-white/50 font-semibold">📧 Emails da conta</div>
            <div>
              <Label className="text-xs">Email principal (Hotmail/Outlook)</Label>
              <Input
                value={a.email_principal || ""}
                onChange={(e) => upd("email_principal", e.target.value)}
                placeholder="usuario@hotmail.com"
                className="bg-white/5 border-white/10"
              />
            </div>
            <div>
              <Label className="text-xs">Senha do email principal</Label>
              <Input
                value={a.email_password || ""}
                onChange={(e) => upd("email_password", e.target.value)}
                className="bg-white/5 border-white/10"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Email alternativo (fviainboxes.com)</Label>
              <Input
                value={a.email_alt || ""}
                onChange={(e) => upd("email_alt", e.target.value)}
                placeholder="usuario@fviainboxes.com"
                className="bg-white/5 border-white/10"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={a.status} onValueChange={(v) => upd("status", v)}>
              <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Resultado do login</Label>
            <Select value={a.login_result || "none"} onValueChange={(v) => upd("login_result", v === "none" ? null : v)}>
              <SelectTrigger className="bg-white/5 border-white/10"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {Object.entries(LOGIN_RESULT_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <Switch checked={a.logged_in} onCheckedChange={(v) => upd("logged_in", v)} />
            <Label className="text-xs">Já foi logada</Label>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <Switch checked={a.has_bm} onCheckedChange={(v) => upd("has_bm", v)} />
            <Label className="text-xs">Possui BM</Label>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <Switch checked={a.sold} onCheckedChange={(v) => upd("sold", v)} />
            <Label className="text-xs">Vendida</Label>
          </div>
          {a.sold && (
            <div className="col-span-2">
              <Label className="text-xs">Nome do cliente</Label>
              <Input value={a.client_name || ""} onChange={(e) => upd("client_name", e.target.value)} className="bg-white/5 border-white/10" />
            </div>
          )}
          <div>
            <Label className="text-xs">País</Label>
            <Input value={a.country || ""} onChange={(e) => upd("country", e.target.value)} placeholder="BR, US..." className="bg-white/5 border-white/10" />
          </div>
          <div>
            <Label className="text-xs">Ano da conta</Label>
            <Input type="number" value={a.account_year || ""} onChange={(e) => upd("account_year", e.target.value ? parseInt(e.target.value) : null)} className="bg-white/5 border-white/10" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea value={a.notes || ""} onChange={(e) => upd("notes", e.target.value)} rows={3} className="bg-white/5 border-white/10" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(a)}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
