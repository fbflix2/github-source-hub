import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Copy, Check, Users, DollarSign, TrendingUp, Percent,
  Share2, ShoppingCart, Wallet, Handshake, ChevronLeft, ChevronRight,
  Bell, X, Package, BarChart3, ShieldAlert, FileText, ArrowRight, Link2,
} from "lucide-react";

interface Partner {
  id: string;
  slug: string;
  commission_rate: number;
  guarantee_days: number;
  balance: number;
  total_earned: number;
  total_referrals: number;
  status: string;
  pix_key_type?: string | null;
  pix_key?: string | null;
  pix_holder_name?: string | null;
  pix_holder_document?: string | null;
  pix_bank?: string | null;
}

interface Referral {
  id: string;
  order_total: number;
  commission_amount: number;
  status: string;
  created_at: string;
}

const ITEMS_PER_PAGE = 4;

type TabKey = "overview" | "products" | "finance";

interface PromoProduct {
  id: string;
  name: string;
  slug: string | null;
  price: number | null;
  image_url: string | null;
  description: string | null;
}

export default function GanheAqui() {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [userName, setUserName] = useState("");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [userCpf, setUserCpf] = useState<string>("");
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab: TabKey = tabParam === "products" || tabParam === "finance" ? tabParam : "overview";
  const [tab, setTabState] = useState<TabKey>(initialTab);
  const setTab = (next: TabKey) => {
    setTabState(next);
    const sp = new URLSearchParams(searchParams);
    if (next === "overview") sp.delete("tab"); else sp.set("tab", next);
    setSearchParams(sp, { replace: true });
  };
  useEffect(() => {
    const t = searchParams.get("tab");
    const valid: TabKey = t === "products" || t === "finance" ? t : "overview";
    if (valid !== tab) setTabState(valid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [products, setProducts] = useState<PromoProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    loadPartnerData();
  }, []);

  const loadPartnerData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, cpf")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile?.full_name) setUserName(profile.full_name);
    if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
    if (profile?.cpf) setUserCpf(profile.cpf);

    const { data: partnerData } = await supabase
      .from("partners")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (partnerData) {
      setPartner(partnerData as Partner);
      const { data: refs } = await supabase
        .from("partner_referrals")
        .select("*")
        .eq("partner_id", partnerData.id)
        .order("created_at", { ascending: false })
        .limit(500);
      setReferrals((refs || []) as Referral[]);
      const { data: wd } = await supabase
        .from("partner_withdrawals")
        .select("*")
        .eq("partner_id", partnerData.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setWithdrawals(wd || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (tab !== "products" || products.length > 0) return;
    setProductsLoading(true);
    supabase
      .from("products")
      .select("id,name,slug,price,image_url,description,status,available")
      .eq("status", "active")
      .eq("available", true)
      .order("price", { ascending: false })
      .limit(60)
      .then(({ data }) => {
        setProducts((data || []) as PromoProduct[]);
        setProductsLoading(false);
      });
  }, [tab, products.length]);

  const copyLink = async () => {
    if (!partner) return;
    const url = `${window.location.origin}/parceiro/${partner.slug}`;
    
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        toast.success("Link copiado!");
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        toast.error("Erro ao copiar link");
      }
      document.body.removeChild(textArea);
    }
  };

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => p.name?.toLowerCase().includes(q));
  }, [products, productSearch]);

  const filteredReferrals = useMemo(() => {
    if (statusFilter === "all") return referrals;
    return referrals.filter(r => r.status === statusFilter);
  }, [referrals, statusFilter]);

  const totalPages = Math.ceil(filteredReferrals.length / ITEMS_PER_PAGE);
  const paginatedReferrals = filteredReferrals.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  useEffect(() => { setPage(0); }, [statusFilter]);

  const savePixData = async (data: Partial<Partner>) => {
    if (!partner) return;
    const { error } = await supabase
      .from("partners")
      .update(data)
      .eq("id", partner.id);
    if (error) { toast.error("Erro ao salvar dados PIX"); return; }
    setPartner({ ...partner, ...data });
    toast.success("Dados PIX salvos");
  };

  const initials = userName
    ? userName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "P";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Non-partner view
  if (!partner) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-10 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Handshake className="size-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-white">Programa de Parceiros</h2>
          <p className="text-slate-400 max-w-md mx-auto">
            Indique clientes e ganhe comissão em cada venda. Entre em contato com o suporte para se tornar um parceiro.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
            {howItWorksSteps.map((step, i) => (
              <div key={i} className="rounded-xl border border-[#2A2A2A]/50 bg-[#1A1A1A]/50 p-4 text-center space-y-2">
                <div className="mx-auto w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <step.icon className="size-5 text-primary" />
                </div>
                <p className="text-xs font-semibold text-white">{step.title}</p>
                <p className="text-[11px] text-slate-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const partnerLink = `fbflix.com.br/parceiro/${partner.slug}`;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header Section — hidden on Products/Finance tabs */}
      {tab === "overview" && (
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-[#2A2A2A] pb-8">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-full bg-gradient-to-br from-primary to-primary/40 flex items-center justify-center border-2 border-[#2A2A2A] overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-white">{initials}</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">{userName || "Parceiro"}</h1>
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                partner.status === "active"
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-red-500/10 text-red-400"
              }`}>
                <span className={`size-1.5 rounded-full ${partner.status === "active" ? "bg-emerald-500" : "bg-red-400"}`} />
                {partner.status === "active" ? "Ativo" : "Inativo"}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 group">
              <span className="text-slate-400 text-sm">{partnerLink}</span>
              <button
                onClick={copyLink}
                className="hover:text-primary transition-colors flex items-center gap-1 text-slate-400"
                title="Copiar Link"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                <span className="text-xs font-medium uppercase tracking-wider">
                  {copied ? "Copiado" : "Copiar"}
                </span>
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="size-10 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg flex items-center justify-center shrink-0">
            <Bell className="size-5 text-slate-400" />
          </div>
        </div>
      </header>
      )}

      {/* Tabs (mobile fallback — top nav drives tabs on desktop) */}
      <div className="md:hidden flex items-center gap-1 mb-6 border-b border-[#2A2A2A]">
        {([
          { key: "overview", label: "Visão Geral", icon: BarChart3 },
          { key: "products", label: "Produtos", icon: Package },
          { key: "finance", label: "Financeiro", icon: Wallet },
        ] as { key: TabKey; label: string; icon: any }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? "text-primary border-primary"
                : "text-slate-500 border-transparent hover:text-slate-300"
            }`}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          {/* Compact Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-5">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Indicações</p>
              <h2 className="text-2xl font-bold text-white">{partner.total_referrals}</h2>
              <div className="mt-2 flex items-center gap-1 text-slate-400">
                <Users className="size-3" />
                <span className="text-xs font-medium">{referrals.filter(r => {
                  const d = new Date(r.created_at);
                  const now = new Date();
                  return d >= new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
                }).length} novas esta semana</span>
              </div>
            </div>
            <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-5">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Comissão Atual</p>
              <h2 className="text-2xl font-bold text-white">{partner.commission_rate}%</h2>
              <div className="mt-2 bg-primary/10 rounded-full h-1.5 w-full overflow-hidden">
                <div className="bg-primary h-full" style={{ width: `${Math.min((partner.commission_rate / 20) * 100, 100)}%` }} />
              </div>
              <p className="mt-1 text-[10px] text-slate-500 text-right uppercase">
                {Math.min(Math.round((partner.commission_rate / 20) * 100), 100)}% para 20%
              </p>
            </div>
            <button
              onClick={() => setTab("finance")}
              className="bg-[#1A1A1A] border border-[#2A2A2A] hover:border-primary/40 rounded-xl p-5 text-left transition-colors group"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Saldo Disponível</p>
                <Wallet className="size-4 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-white">R$ {partner.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</h2>
              <div className="mt-2 flex items-center gap-1 text-primary text-xs font-bold uppercase tracking-wider group-hover:gap-2 transition-all">
                Acessar Financeiro <ArrowRight className="size-3" />
              </div>
            </button>
          </div>

          {/* Como Funciona */}
          <section className="mb-8">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500 mb-4">Como Funciona</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {howItWorksSteps.map((step, i) => (
                <div key={i} className="flex items-center gap-4 bg-[#1A1A1A]/50 border border-[#2A2A2A]/50 p-4 rounded-xl">
                  <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <step.icon className="size-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-white">{step.title}</p>
                    <p className="text-xs text-slate-500">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Transactions Table */}
          <section className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl overflow-hidden">
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2A2A2A]">
          <h3 className="font-bold text-lg text-white">Minhas Indicações</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Filtrar:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#0F0F0F] border border-[#2A2A2A] text-xs text-slate-300 rounded-lg px-3 py-1.5 focus:ring-primary focus:border-primary outline-none"
            >
              <option value="all">Todos Status</option>
              <option value="credited">Creditado</option>
              <option value="pending">Pendente</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
        </div>

        {filteredReferrals.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Users className="size-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">
              {statusFilter === "all"
                ? "Nenhuma indicação registrada ainda."
                : "Nenhuma indicação com este status."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#2A2A2A]/30">
                  <tr>
                    <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Data</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Valor do Pedido</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Comissão Gerada</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2A2A]">
                  {paginatedReferrals.map((ref) => (
                    <tr key={ref.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-300">
                        {new Date(ref.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-white">
                        R$ {ref.order_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-primary">
                        R$ {ref.commission_amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ReferralStatusBadge status={ref.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-[#2A2A2A] flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Mostrando {paginatedReferrals.length} de {filteredReferrals.length} indicações
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="size-8 rounded border border-[#2A2A2A] flex items-center justify-center hover:bg-[#2A2A2A] transition-colors disabled:opacity-30"
                >
                  <ChevronLeft className="size-4 text-slate-400" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="size-8 rounded border border-[#2A2A2A] flex items-center justify-center hover:bg-[#2A2A2A] transition-colors disabled:opacity-30"
                >
                  <ChevronRight className="size-4 text-slate-400" />
                </button>
              </div>
            </div>
          </>
        )}
          </section>
        </>
      )}

      {tab === "products" && (
        <ProductsTab
          partnerSlug={partner.slug}
          products={filteredProducts}
          loading={productsLoading}
          search={productSearch}
          onSearch={setProductSearch}
          commissionRate={partner.commission_rate}
        />
      )}

      {tab === "finance" && (
        <FinanceTab
          partner={partner}
          onWithdraw={() => {
            if (Number(partner.balance) <= 0) {
              toast.error("Você não tem saldo disponível para saque.");
              return;
            }
            setShowWithdraw(true);
          }}
          onSavePix={savePixData}
          withdrawals={withdrawals}
        />
      )}

      {/* Footer */}
      <footer className="mt-8 text-center">
        <p className="text-slate-600 text-[10px] uppercase tracking-widest">© 2024 FBX Token / FbFlix. Todos os direitos reservados.</p>
      </footer>

      {showWithdraw && partner && userId && (
        <WithdrawModal
          partner={partner}
          userId={userId}
          defaultCpf={partner.pix_key || userCpf}
          defaultHolder={partner.pix_holder_name || userName}
          defaultKeyType={partner.pix_key_type || "cpf"}
          previous={withdrawals}
          onClose={() => setShowWithdraw(false)}
          onSuccess={() => { setShowWithdraw(false); loadPartnerData(); }}
        />
      )}
    </div>
  );
}

// --- Data ---

const howItWorksSteps = [
  { icon: Share2, title: "Compartilhe", desc: "Envie seu link exclusivo" },
  { icon: ShoppingCart, title: "Cliente compra", desc: "Adesão confirmada na rede" },
  { icon: Wallet, title: "Você ganha", desc: "Comissão direto no saldo" },
];

// --- Products Tab ---

function ProductsTab({
  partnerSlug, products, loading, search, onSearch, commissionRate,
}: {
  partnerSlug: string;
  products: PromoProduct[];
  loading: boolean;
  search: string;
  onSearch: (v: string) => void;
  commissionRate: number;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("todos");

  const getType = (name: string): string => {
    const n = name.toLowerCase();
    if (n.includes("bm")) return "bm";
    if (n.includes("perfil")) return "perfil";
    if (n.includes("proxy")) return "proxy";
    if (n.includes("página") || n.includes("pagina") || n.includes("fanpage")) return "pagina";
    return "outros";
  };

  const types = [
    { id: "todos", label: "Todos", icon: Package },
    { id: "bm", label: "BM", icon: Briefcase },
    { id: "perfil", label: "Perfis", icon: User },
    { id: "proxy", label: "Proxies", icon: Globe },
    { id: "pagina", label: "Páginas", icon: FileText },
    { id: "outros", label: "Outros", icon: Box },
  ];

  const filteredProducts = typeFilter === "todos"
    ? products
    : products.filter(p => getType(p.name) === typeFilter);

  const counts = products.reduce<Record<string, number>>((acc, p) => {
    const t = getType(p.name);
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  const buildLink = (p: PromoProduct) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://fbflix.com.br";
    const target = p.slug ? `/produto/${p.slug}` : "/loja";
    return `${origin}/parceiro/${partnerSlug}?to=${encodeURIComponent(target)}`;
  };

  const copy = async (p: PromoProduct) => {
    try {
      await navigator.clipboard.writeText(buildLink(p));
      setCopiedId(p.id);
      toast.success("Link de divulgação copiado!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  return (
    <section>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-lg font-bold text-white">Produtos para promover</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Copie o link exclusivo de cada produto. Toda venda gerada conta como sua indicação.
          </p>
        </div>
        <input
          value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Buscar produto..."
          className="w-full sm:w-64 bg-[#1A1A1A] border border-[#2A2A2A] text-white rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      {/* Type Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        {types.map(t => {
          const Icon = t.icon;
          const count = t.id === "todos" ? products.length : (counts[t.id] || 0);
          const active = typeFilter === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTypeFilter(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${
                active
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-[#1A1A1A] border-[#2A2A2A] text-slate-400 hover:border-primary/30 hover:text-white"
              }`}
            >
              <Icon className="size-3.5" />
              {t.label}
              <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] ${active ? "bg-primary/20" : "bg-[#0F0F0F]"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-10 text-center">
          <Package className="size-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Nenhum produto encontrado para este filtro.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map(p => (
            <div key={p.id} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4 flex flex-col gap-3 hover:border-primary/30 transition-colors">
              <div className="flex items-start gap-3">
                <div className="size-14 rounded-lg bg-[#0F0F0F] border border-[#2A2A2A] overflow-hidden shrink-0 flex items-center justify-center">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="size-5 text-slate-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white line-clamp-2">{p.name}</p>
                  {p.price != null && (
                    <p className="text-xs text-primary font-bold mt-1">
                      R$ {Number(p.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  )}
                  {p.price != null && (
                    <p className="text-[10px] text-emerald-400 font-semibold mt-0.5 uppercase tracking-wider">
                      Comissão: R$ {(Number(p.price) * (commissionRate / 100)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      <span className="text-slate-500 normal-case font-normal"> ({commissionRate}%)</span>
                    </p>
                  )}
                </div>
              </div>
              {p.description && (
                <p className="text-xs text-slate-400 line-clamp-3">{p.description}</p>
              )}
              <button
                onClick={() => copy(p)}
                className="mt-auto w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
              >
                {copiedId === p.id ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
                {copiedId === p.id ? "Link copiado" : "Copiar link"}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// --- Finance Tab ---

function FinanceTab({
  partner, onWithdraw, onSavePix, withdrawals,
}: {
  partner: Partner;
  onWithdraw: () => void;
  onSavePix: (data: Partial<Partner>) => Promise<void>;
  withdrawals: any[];
}) {
  return (
    <div className="space-y-8">
      {/* Top cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Saldo Disponível</p>
            <h2 className="text-3xl font-bold text-white">R$ {partner.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</h2>
          </div>
          <button
            onClick={onWithdraw}
            className="mt-4 w-full bg-primary hover:bg-primary/90 text-white py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2"
          >
            <Wallet className="size-4" /> Solicitar Saque
          </button>
        </div>
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-5">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Ganho Total</p>
          <h2 className="text-3xl font-bold text-white">R$ {partner.total_earned.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</h2>
          <div className="mt-2 flex items-center gap-1 text-emerald-500">
            <TrendingUp className="size-3" />
            <span className="text-xs font-medium">Lifetime</span>
          </div>
        </div>
      </div>

      {/* PIX data */}
      <PixDataSection partner={partner} onSave={onSavePix} />

      {/* Withdrawals history */}
      {withdrawals.length > 0 && (
        <section>
          <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500 mb-3">Histórico de Saques</h3>
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl divide-y divide-[#2A2A2A]">
            {withdrawals.slice(0, 10).map(w => (
              <div key={w.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-slate-400">{new Date(w.created_at).toLocaleDateString("pt-BR")}</span>
                <span className="text-white font-bold">R$ {Number(w.amount).toFixed(2)}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  w.status === "paid" ? "text-emerald-500" : w.status === "rejected" ? "text-red-400" : "text-yellow-500"
                }`}>
                  {w.status === "paid" ? "Pago" : w.status === "rejected" ? "Recusado" : "Pendente"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Conditions */}
      <section>
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500 mb-3 flex items-center gap-2">
          <FileText className="size-4" /> Condições de Recebimento
        </h3>
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-5 space-y-3 text-sm text-slate-300">
          <ul className="space-y-2 list-disc list-inside marker:text-primary">
            <li>Comissão atual: <span className="font-bold text-white">{partner.commission_rate}%</span> sobre cada venda confirmada.</li>
            <li>Período de garantia: as comissões ficam <span className="font-bold text-white">pendentes por {partner.guarantee_days} dias</span> após a compra. Se o pedido for reembolsado dentro deste prazo, a comissão é cancelada.</li>
            <li>Após o período de garantia, o valor é creditado automaticamente no <span className="font-bold text-white">Saldo Disponível</span>.</li>
            <li>Saques são processados via <span className="font-bold text-white">PIX em até 48h úteis</span> após a aprovação.</li>
            <li>O PIX é enviado obrigatoriamente para a chave cadastrada acima, em nome do titular informado.</li>
            <li>Saque mínimo: <span className="font-bold text-white">R$ 20,00</span>.</li>
          </ul>
        </div>
      </section>

      {/* Terms for partners */}
      <section>
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500 mb-3 flex items-center gap-2">
          <ShieldAlert className="size-4 text-red-400" /> Termos do Programa de Parceiros
        </h3>
        <div className="bg-[#1A1A1A] border border-red-500/20 rounded-xl p-5 space-y-3 text-sm text-slate-300">
          <p className="text-xs text-red-400 font-bold uppercase tracking-wider">Leia com atenção</p>
          <ul className="space-y-2 list-disc list-inside marker:text-red-400">
            <li><span className="font-bold text-white">Conta única por CPF.</span> Não é permitido manter mais de uma conta de parceiro com o mesmo CPF, mesmo que sob nomes diferentes.</li>
            <li><span className="font-bold text-white">Compras próprias não geram comissão.</span> Qualquer indicação identificada como autocompra (mesmo CPF, mesmos dados, mesmo IP, mesmo cartão, mesma chave PIX, mesmo dispositivo) será automaticamente invalidada.</li>
            <li><span className="font-bold text-white">Fraude = cancelamento.</span> Tentativas de burlar o sistema — criar contas-laranja, usar dados de terceiros, simular vendas, manipular o link — resultam no <span className="text-red-400 font-bold">cancelamento imediato da conta</span>, perda total do saldo acumulado e bloqueio de futuras participações.</li>
            <li>Não é permitido oferecer cashback, descontos ou qualquer compensação financeira ao cliente final em troca do uso do seu link de parceiro.</li>
            <li>É proibido divulgar o link em canais de SPAM, sites adultos, conteúdo ilegal ou redes que violem os Termos da FBFLIX.</li>
            <li>A FBFLIX se reserva o direito de revisar, suspender ou cancelar comissões e contas que apresentem comportamento suspeito, mesmo após o crédito.</li>
            <li>Os termos deste programa podem ser atualizados a qualquer momento e a versão vigente é a publicada nesta página.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

// --- Sub-components ---

function ReferralStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    credited: { bg: "bg-emerald-500/10", text: "text-emerald-500", label: "CREDITADO" },
    pending: { bg: "bg-yellow-500/10", text: "text-yellow-500", label: "PENDENTE" },
    cancelled: { bg: "bg-red-500/10", text: "text-red-400", label: "CANCELADO" },
  };
  const c = config[status] || config.pending;
  return (
    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

function FaturamentoMeter({ earned }: { earned: number }) {
  const milestones = [5000, 10000, 50000, 100000];
  // Find current target: smallest milestone greater than earned, else the largest
  const target = milestones.find(m => earned < m) ?? milestones[milestones.length - 1];
  const prev = (() => {
    const idx = milestones.indexOf(target);
    return idx > 0 ? milestones[idx - 1] : 0;
  })();
  const isMaxed = earned >= milestones[milestones.length - 1];
  const pct = isMaxed
    ? 100
    : Math.max(0, Math.min(100, ((earned - prev) / (target - prev)) * 100));
  const fmt = (v: number) =>
    v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : `${v}`;
  return (
    <div className="flex-1 md:w-56 md:flex-none">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Faturamento</p>
        <p className="text-xs font-bold text-primary">
          R$ {earned.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </p>
      </div>
      <div className="h-2 w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">
          R$ {fmt(prev)}
        </span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          {isMaxed ? "Meta máxima atingida" : `Meta: R$ ${fmt(target)}`}
        </span>
      </div>
    </div>
  );
}

function WithdrawModal({
  partner, userId, defaultCpf, defaultHolder, defaultKeyType, previous, onClose, onSuccess,
}: {
  partner: Partner;
  userId: string;
  defaultCpf: string;
  defaultHolder: string;
  defaultKeyType?: string;
  previous: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState<string>(String(partner.balance.toFixed(2)));
  const [keyType, setKeyType] = useState<string>(defaultKeyType || "cpf");
  const [pixKey, setPixKey] = useState<string>(defaultCpf || "");
  const [holder, setHolder] = useState<string>(defaultHolder || "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const value = parseFloat(amount.replace(",", "."));
    if (!value || value <= 0) { toast.error("Informe um valor válido"); return; }
    if (value > Number(partner.balance)) { toast.error("Valor maior que o saldo disponível"); return; }
    if (!pixKey.trim()) { toast.error("Informe a chave PIX"); return; }
    setSaving(true);
    const { error } = await supabase.from("partner_withdrawals").insert({
      partner_id: partner.id,
      user_id: userId,
      amount: value,
      pix_key: pixKey.trim(),
      pix_key_type: keyType,
      holder_name: holder.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message || "Erro ao solicitar saque"); return; }
    toast.success("Saque solicitado! O pagamento é processado em até 48h úteis.");
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Solicitar Saque</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="size-5" /></button>
        </div>

        <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 text-xs text-slate-300">
          Saldo disponível: <span className="font-bold text-primary">R$ {Number(partner.balance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          <p className="text-[11px] text-slate-500 mt-1">Pagamentos via PIX em até 48h úteis após a aprovação.</p>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Valor (R$)</label>
          <input
            type="number" step="0.01" min="0" value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] text-white rounded-lg px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Tipo</label>
            <select
              value={keyType} onChange={e => setKeyType(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] text-white rounded-lg px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
            >
              <option value="cpf">CPF</option>
              <option value="cnpj">CNPJ</option>
              <option value="email">E-mail</option>
              <option value="telefone">Telefone</option>
              <option value="aleatoria">Aleatória</option>
            </select>
          </div>
          <div className="space-y-2 col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Chave PIX</label>
            <input
              value={pixKey} onChange={e => setPixKey(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] text-white rounded-lg px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Titular (opcional)</label>
          <input
            value={holder} onChange={e => setHolder(e.target.value)}
            className="w-full bg-[#1A1A1A] border border-[#2A2A2A] text-white rounded-lg px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
          />
        </div>

        <button
          onClick={submit} disabled={saving}
          className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-all disabled:opacity-50"
        >
          {saving ? "Enviando..." : "Confirmar Solicitação"}
        </button>

        {previous.length > 0 && (
          <div className="pt-3 border-t border-white/[0.05]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Últimos saques</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {previous.slice(0, 5).map(w => (
                <div key={w.id} className="flex items-center justify-between text-xs bg-[#1A1A1A] rounded px-3 py-2">
                  <span className="text-slate-400">{new Date(w.created_at).toLocaleDateString("pt-BR")}</span>
                  <span className="text-white font-bold">R$ {Number(w.amount).toFixed(2)}</span>
                  <span className={`text-[9px] font-bold uppercase ${
                    w.status === "paid" ? "text-emerald-500" : w.status === "rejected" ? "text-red-400" : "text-yellow-500"
                  }`}>{w.status === "paid" ? "Pago" : w.status === "rejected" ? "Recusado" : "Pendente"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PixDataSection({
  partner,
  onSave,
}: {
  partner: Partner;
  onSave: (data: Partial<Partner>) => Promise<void>;
}) {
  const [keyType, setKeyType] = useState(partner.pix_key_type || "cpf");
  const [pixKey, setPixKey] = useState(partner.pix_key || "");
  const [holder, setHolder] = useState(partner.pix_holder_name || "");
  const [doc, setDoc] = useState(partner.pix_holder_document || "");
  const [bank, setBank] = useState(partner.pix_bank || "");
  const [saving, setSaving] = useState(false);

  const dirty =
    keyType !== (partner.pix_key_type || "cpf") ||
    pixKey !== (partner.pix_key || "") ||
    holder !== (partner.pix_holder_name || "") ||
    doc !== (partner.pix_holder_document || "") ||
    bank !== (partner.pix_bank || "");

  const save = async () => {
    if (!pixKey.trim()) { toast.error("Informe a chave PIX"); return; }
    if (!holder.trim()) { toast.error("Informe o titular da conta"); return; }
    setSaving(true);
    await onSave({
      pix_key_type: keyType,
      pix_key: pixKey.trim(),
      pix_holder_name: holder.trim(),
      pix_holder_document: doc.trim() || null,
      pix_bank: bank.trim() || null,
    });
    setSaving(false);
  };

  const inputCls =
    "w-full bg-[#1A1A1A] border border-[#2A2A2A] text-white rounded-lg px-3 py-2.5 text-sm focus:border-primary focus:outline-none";
  const labelCls = "text-[10px] font-bold uppercase tracking-widest text-slate-500";

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
          Dados PIX para Recebimento
        </h3>
        {partner.pix_key && !dirty && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">
            ✓ Cadastrado
          </span>
        )}
      </div>
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-5 space-y-4">
        <p className="text-xs text-slate-400">
          Cadastre seus dados bancários para receber suas comissões. Os pagamentos são feitos via PIX em até 48h úteis após a aprovação.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <label className={labelCls}>Tipo de chave</label>
            <select value={keyType} onChange={e => setKeyType(e.target.value)} className={inputCls}>
              <option value="cpf">CPF</option>
              <option value="cnpj">CNPJ</option>
              <option value="email">E-mail</option>
              <option value="telefone">Telefone</option>
              <option value="aleatoria">Aleatória</option>
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className={labelCls}>Chave PIX</label>
            <input value={pixKey} onChange={e => setPixKey(e.target.value)} className={inputCls} placeholder="Digite sua chave PIX" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className={labelCls}>Titular da conta</label>
            <input value={holder} onChange={e => setHolder(e.target.value)} className={inputCls} placeholder="Nome completo do titular" />
          </div>
          <div className="space-y-2">
            <label className={labelCls}>CPF/CNPJ do titular</label>
            <input value={doc} onChange={e => setDoc(e.target.value)} className={inputCls} placeholder="000.000.000-00" />
          </div>
          <div className="space-y-2 md:col-span-3">
            <label className={labelCls}>Banco</label>
            <input value={bank} onChange={e => setBank(e.target.value)} className={inputCls} placeholder="Ex: Nubank, Itaú, Bradesco" />
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="w-full md:w-auto px-6 h-11 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Salvando..." : dirty ? "Salvar dados PIX" : "Dados salvos"}
        </button>
      </div>
    </section>
  );
}
