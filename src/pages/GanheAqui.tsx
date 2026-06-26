import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Copy, Check, Users, DollarSign, TrendingUp, Percent,
  Share2, ShoppingCart, Wallet, Handshake, ChevronLeft, ChevronRight,
  Bell, X, Package, BarChart3, ShieldAlert, FileText, ArrowRight, Link2,
  Briefcase, UserCircle2, Globe, Box, Flame, Crown, Eye, ArrowDownAZ, ArrowUpAZ,
  MousePointerClick, Route, CreditCard, CircleCheck, Activity, Wrench,
} from "lucide-react";
import ToolsTab from "@/components/partner/ToolsTab";

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

const DAILY_QUOTES = [
  "Foco no processo, o resultado é consequência.",
  "Cada link compartilhado é uma porta aberta.",
  "Disciplina vence motivação todos os dias.",
  "Você não precisa ser perfeito, precisa ser constante.",
  "Quem planta indicação hoje, colhe comissão amanhã.",
  "Grandes vendas começam com uma conversa simples.",
  "Pequenas ações diárias geram resultados extraordinários.",
  "Não venda produtos, resolva problemas.",
  "Sua rede é seu maior patrimônio.",
  "O sucesso ama quem aparece todos os dias.",
  "Hoje é um ótimo dia pra bater meta.",
  "Confiança se constrói entregando valor.",
  "Quem domina o link, domina o jogo.",
];
const dailyQuote = DAILY_QUOTES[
  Math.floor((new Date().setHours(0,0,0,0) / 86400000)) % DAILY_QUOTES.length
];

type TabKey = "overview" | "products" | "finance";
type TabKeyExt = TabKey | "journey" | "tools";

interface PromoProduct {
  id: string;
  name: string;
  slug: string | null;
  price: number | null;
  image_url: string | null;
  description: string | null;
}

interface PromoBanner {
  id: string;
  title: string | null;
  subtitle: string | null;
  image_url: string | null;
  image_style: string | null;
  background_color: string | null;
  cta_text: string | null;
  link_url: string | null;
  category: string | null;
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
  const initialTab: TabKeyExt = (["products","finance","journey","tools"].includes(tabParam || "") ? tabParam : "overview") as TabKeyExt;
  const [tab, setTabState] = useState<TabKeyExt>(initialTab);
  const setTab = (next: TabKeyExt) => {
    setTabState(next);
    const sp = new URLSearchParams(searchParams);
    if (next === "overview") sp.delete("tab"); else sp.set("tab", next);
    setSearchParams(sp, { replace: true });
  };
  useEffect(() => {
    const t = searchParams.get("tab");
    const valid: TabKeyExt = (["products","finance","journey","tools"].includes(t || "") ? t : "overview") as TabKeyExt;
    if (valid !== tab) setTabState(valid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [products, setProducts] = useState<PromoProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [topSellers, setTopSellers] = useState<string[]>([]);
  const [topViewed, setTopViewed] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [promoBanners, setPromoBanners] = useState<PromoBanner[]>([]);

  // Journey
  const [journeyEvents, setJourneyEvents] = useState<any[]>([]);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [journeyRange, setJourneyRange] = useState<number>(30);

  useEffect(() => {
    loadPartnerData();
  }, []);

  // Load partner banners once for overview + products
  useEffect(() => {
    (async () => {
      const { data: bn } = await supabase
        .from("partner_banners" as any)
        .select("id,title,subtitle,image_url,image_style,background_color,cta_text,link_url,category")
        .eq("active", true)
        .order("position", { ascending: true });
      if (bn && bn.length) setPromoBanners(((bn || []) as unknown) as PromoBanner[]);
    })();
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
    (async () => {
      const { data: prods } = await supabase
        .from("products")
        .select("id,name,slug,price,image_url,description,status,available")
        .eq("status", "active")
        .eq("available", true)
        .order("price", { ascending: false })
        .limit(60);
      setProducts((prods || []) as PromoProduct[]);
      // Fetch partner-only banners (exclusive of the client store)
      const { data: bn } = await supabase
        .from("partner_banners" as any)
        .select("id,title,subtitle,image_url,image_style,background_color,cta_text,link_url,category")
        .eq("active", true)
        .order("position", { ascending: true });
      setPromoBanners(((bn || []) as unknown) as PromoBanner[]);
      // Fallback: compute top sellers from order_items directly
      const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
      const { data: items } = await supabase
        .from("order_items")
        .select("product_id, orders!inner(status, created_at)")
        .in("orders.status", ["paid", "completed"])
        .gte("orders.created_at", since)
        .not("product_id", "is", null)
        .limit(1000);
      const counts: Record<string, number> = {};
      (items || []).forEach((it: any) => {
        if (it.product_id) counts[it.product_id] = (counts[it.product_id] || 0) + 1;
      });
      const sortedSales = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([id]) => id);
      setTopSellers(sortedSales);

      // Real "Mais visitado" from product_views (last 90 days), excluding the top 2 sellers
      const { data: views } = await supabase
        .from("product_views" as any)
        .select("product_id")
        .gte("viewed_at", since)
        .limit(5000);
      const vcounts: Record<string, number> = {};
      (views || []).forEach((v: any) => {
        if (v.product_id) vcounts[v.product_id] = (vcounts[v.product_id] || 0) + 1;
      });
      const topV = Object.entries(vcounts)
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => id)
        .find((id) => !sortedSales.includes(id)) || null;
      setTopViewed(topV);
      setProductsLoading(false);
    })();
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

  // Load journey events when entering Jornada tab
  useEffect(() => {
    if (tab !== "journey" || !partner) return;
    setJourneyLoading(true);
    (async () => {
      const since = new Date(Date.now() - journeyRange * 24 * 3600 * 1000).toISOString();
      const { data } = await supabase
        .from("partner_journey_events" as any)
        .select("*")
        .eq("partner_id", partner.id)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(2000);
      setJourneyEvents((data || []) as any[]);
      setJourneyLoading(false);
    })();
  }, [tab, partner, journeyRange]);

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
            <p className="text-slate-400 text-sm mt-1 italic max-w-md">
              "{dailyQuote}"
            </p>
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
          { key: "journey", label: "Jornada", icon: Route },
          { key: "tools", label: "Ferramentas", icon: Wrench },
          { key: "finance", label: "Financeiro", icon: Wallet },
        ] as { key: TabKeyExt; label: string; icon: any }[]).map(t => (
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
          <OverviewBanner banners={promoBanners.filter(b => !b.category || /overview|geral|dica|incentivo|estrat/i.test(b.category))} />
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

          {/* Leads Heatmap (real-time) */}
          <LeadsHeatmap partnerId={partner.id} />

          {/* Quick Access Cards */}
          <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => {
                navigator.clipboard.writeText(partnerLink);
                toast.success("Link copiado!");
              }}
              className="group bg-[#1A1A1A] border border-[#2A2A2A] hover:border-primary/40 rounded-xl p-5 text-left transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Link2 className="size-5" />
                </div>
                <ArrowRight className="size-4 text-slate-500 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
              <p className="font-bold text-sm text-white">Link Global</p>
              <p className="text-xs text-slate-500 mt-1 truncate">{partnerLink.replace(/^https?:\/\//, "")}</p>
            </button>

            <button
              onClick={() => setTab("products")}
              className="group bg-[#1A1A1A] border border-[#2A2A2A] hover:border-primary/40 rounded-xl p-5 text-left transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Package className="size-5" />
                </div>
                <ArrowRight className="size-4 text-slate-500 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
              <p className="font-bold text-sm text-white">Ver produtos para promover</p>
              <p className="text-xs text-slate-500 mt-1">Campeões de venda e mais comissão</p>
            </button>

            <button
              onClick={() => setTab("journey")}
              className="group bg-[#1A1A1A] border border-[#2A2A2A] hover:border-primary/40 rounded-xl p-5 text-left transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Route className="size-5" />
                </div>
                <ArrowRight className="size-4 text-slate-500 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
              <p className="font-bold text-sm text-white">Acompanhar jornada</p>
              <p className="text-xs text-slate-500 mt-1">Funil e visitantes em tempo real</p>
            </button>
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
          topSellers={topSellers}
          topViewed={topViewed}
          banners={promoBanners}
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

      {tab === "journey" && (
        <JourneyTab
          events={journeyEvents}
          loading={journeyLoading}
          range={journeyRange}
          onRangeChange={setJourneyRange}
          commissionRate={partner.commission_rate}
        />
      )}

      {tab === "tools" && (
        <ToolsTab partnerId={partner.id} partnerSlug={partner.slug} />
      )}

      {/* Footer */}
      <footer className="mt-8 text-center">
        <p className="text-slate-600 text-[10px] uppercase tracking-widest">© 2026 FBX Token / FbFlix. Todos os direitos reservados.</p>
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

// --- Leads Heatmap (real-time) ---

function LeadsHeatmap({ partnerId }: { partnerId: string }) {
  const [events, setEvents] = useState<Array<{ created_at: string; event_type: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const since = new Date();
      since.setDate(since.getDate() - 6);
      since.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("partner_journey_events" as any)
        .select("created_at, event_type")
        .eq("partner_id", partnerId)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(5000);
      if (mounted) {
        setEvents((data || []) as any);
        setLoading(false);
      }
    };
    load();

    const ch = supabase
      .channel(`leads-heatmap-${partnerId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "partner_journey_events", filter: `partner_id=eq.${partnerId}` },
        (payload: any) => {
          setEvents((prev) => [{ created_at: payload.new.created_at, event_type: payload.new.event_type }, ...prev]);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [partnerId]);

  // Build 7d x 24h grid
  const { grid, maxCount, totals, hottest } = useMemo(() => {
    const days: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(d);
    }
    const grid: number[][] = days.map(() => Array(24).fill(0));
    for (const ev of events) {
      const d = new Date(ev.created_at);
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const idx = days.findIndex((x) => x.getTime() === dayStart.getTime());
      if (idx >= 0) grid[idx][d.getHours()]++;
    }
    let maxCount = 0;
    grid.forEach((row) => row.forEach((v) => { if (v > maxCount) maxCount = v; }));
    const totals = {
      total: events.length,
      clicks: events.filter((e) => e.event_type === "click").length,
      views: events.filter((e) => e.event_type === "view_product").length,
      purchases: events.filter((e) => e.event_type === "purchase").length,
    };
    // hottest hour
    let bestHour = -1; let bestCount = 0;
    const hourTotals = Array(24).fill(0);
    grid.forEach((row) => row.forEach((v, h) => { hourTotals[h] += v; }));
    hourTotals.forEach((v, h) => { if (v > bestCount) { bestCount = v; bestHour = h; } });
    return { grid, maxCount, totals, hottest: { hour: bestHour, count: bestCount }, days } as any;
  }, [events]);

  const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const rowLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return dayLabels[d.getDay()];
  });

  const intensity = (v: number) => {
    if (v === 0 || maxCount === 0) return "bg-[#1f1f1f]";
    const ratio = v / maxCount;
    if (ratio > 0.8) return "bg-primary";
    if (ratio > 0.55) return "bg-primary/75";
    if (ratio > 0.3) return "bg-primary/50";
    if (ratio > 0.1) return "bg-primary/30";
    return "bg-primary/15";
  };

  return (
    <section className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="size-4 text-primary" />
            <h3 className="font-bold text-base text-white">Leads em tempo real</h3>
            <span className="ml-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" /> Ao vivo
            </span>
          </div>
          <p className="text-xs text-slate-500">Mapa de calor dos últimos 7 dias por hora do dia</p>
        </div>
        <div className="flex flex-wrap gap-4 text-xs">
          <Stat label="Total" value={totals.total} />
          <Stat label="Cliques" value={totals.clicks} />
          <Stat label="Views" value={totals.views} />
          <Stat label="Vendas" value={totals.purchases} accent />
        </div>
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center text-xs text-slate-500">Carregando…</div>
      ) : totals.total === 0 ? (
        <div className="py-10 text-center">
          <Activity className="size-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400 font-medium">Ainda sem leads</p>
          <p className="text-xs text-slate-600 mt-1">Compartilhe seu link para começar a ver o mapa de calor.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Hours header */}
              <div className="flex items-center gap-1 pl-10 mb-1">
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="w-3.5 text-[9px] text-slate-600 text-center font-mono">
                    {h % 3 === 0 ? h : ""}
                  </div>
                ))}
              </div>
              {grid.map((row: number[], i: number) => (
                <div key={i} className="flex items-center gap-1 mb-1">
                  <div className="w-10 text-[10px] text-slate-500 font-bold uppercase">{rowLabels[i]}</div>
                  {row.map((v, h) => (
                    <div
                      key={h}
                      title={`${rowLabels[i]} ${h}:00 — ${v} evento${v === 1 ? "" : "s"}`}
                      className={`w-3.5 h-3.5 rounded-[3px] ${intensity(v)} transition-colors`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-500">
              <span>Menos</span>
              <div className="flex gap-1">
                <div className="w-3 h-3 rounded-[2px] bg-[#1f1f1f]" />
                <div className="w-3 h-3 rounded-[2px] bg-primary/15" />
                <div className="w-3 h-3 rounded-[2px] bg-primary/30" />
                <div className="w-3 h-3 rounded-[2px] bg-primary/50" />
                <div className="w-3 h-3 rounded-[2px] bg-primary/75" />
                <div className="w-3 h-3 rounded-[2px] bg-primary" />
              </div>
              <span>Mais</span>
            </div>
            {hottest.hour >= 0 && (
              <p className="text-slate-400">
                Pico de atividade: <span className="text-primary font-bold">{String(hottest.hour).padStart(2, "0")}:00</span>
                <span className="text-slate-600"> · {hottest.count} eventos</span>
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="text-right">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${accent ? "text-primary" : "text-white"}`}>{value}</p>
    </div>
  );
}

// --- Products Tab ---

function ProductsTab({
  partnerSlug, products, loading, search, onSearch, commissionRate, topSellers, topViewed, banners,
}: {
  partnerSlug: string;
  products: PromoProduct[];
  loading: boolean;
  search: string;
  onSearch: (v: string) => void;
  commissionRate: number;
  topSellers: string[];
  topViewed: string | null;
  banners: PromoBanner[];
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("todos");
  const [sortBy, setSortBy] = useState<"campeoes" | "comissao" | "preco_maior" | "preco_menor">("campeoes");
  const [currentBanner, setCurrentBanner] = useState(0);

  // Curated fallback shown only when admin hasn't uploaded any partner banners yet
  const defaultBanners: PromoBanner[] = useMemo(() => ([
    {
      id: "default-1",
      title: "Compartilhe seu link e fature todo mês",
      subtitle: "A cada venda gerada pelo seu link, você recebe comissão direto no saldo. Sem limite de indicações.",
      image_url: null,
      image_style: "gradient",
      background_color: null,
      cta_text: null,
      link_url: null,
      category: "Dica de venda",
    },
    {
      id: "default-2",
      title: "Foque nos campeões de venda",
      subtitle: "Os produtos com selo Campeão e Vendendo Muito convertem mais. Comece divulgando esses.",
      image_url: null,
      image_style: "gradient",
      background_color: null,
      cta_text: null,
      link_url: null,
      category: "Estratégia",
    },
    {
      id: "default-3",
      title: "Use seu link em grupos e stories",
      subtitle: "Cole o link em grupos de marketing digital, stories e bio. Quanto mais alcance, mais comissão.",
      image_url: null,
      image_style: "gradient",
      background_color: null,
      cta_text: null,
      link_url: null,
      category: "Incentivo",
    },
  ]), []);

  const displayBanners: PromoBanner[] = banners.length > 0 ? banners : defaultBanners;

  useEffect(() => {
    if (displayBanners.length <= 1) return;
    const t = setInterval(() => setCurrentBanner((p) => (p + 1) % displayBanners.length), 6000);
    return () => clearInterval(t);
  }, [displayBanners.length]);

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
    { id: "perfil", label: "Perfis", icon: UserCircle2 },
    { id: "proxy", label: "Proxies", icon: Globe },
    { id: "pagina", label: "Páginas", icon: FileText },
    { id: "outros", label: "Outros", icon: Box },
  ];

  const baseFiltered = typeFilter === "todos"
    ? products
    : products.filter(p => getType(p.name) === typeFilter);

  const topRank = (id: string) => {
    const idx = topSellers.indexOf(id);
    if (idx !== -1) return idx;
    if (topViewed && id === topViewed) return 2;
    return 999;
  };

  const filteredProducts = useMemo(() => {
    const arr = [...baseFiltered];
    if (sortBy === "campeoes") {
      arr.sort((a, b) => topRank(a.id) - topRank(b.id) || (Number(b.price) || 0) - (Number(a.price) || 0));
    } else if (sortBy === "comissao" || sortBy === "preco_maior") {
      arr.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    } else {
      arr.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    }
    return arr;
  }, [baseFiltered, sortBy, topSellers, topViewed]);

  const topBadge = (id: string): { label: string; icon: any; cls: string } | null => {
    const idx = topSellers.indexOf(id);
    if (idx === 0) return { label: "Campeão de vendas", icon: Crown, cls: "from-amber-500 to-orange-500" };
    if (idx === 1) return { label: "Vendendo muito", icon: Flame, cls: "from-rose-500 to-pink-500" };
    if (topViewed && id === topViewed) return { label: "Mais visitado", icon: Eye, cls: "from-violet-500 to-fuchsia-500" };
    return null;
  };

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
      {/* Thin promo banner carousel */}
      {displayBanners.length > 0 && (() => {
        const b = displayBanners[currentBanner];
        const isCover = b?.image_style === "cover" && !!b?.image_url;
        return (
          <div
            className="relative w-full rounded-xl overflow-hidden border border-[#2A2A2A] mb-5 h-[120px] md:h-[150px] group"
            style={b?.background_color && !isCover ? { backgroundColor: b.background_color } : undefined}
          >
            {isCover && (
              <>
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                  style={{ backgroundImage: `url('${b.image_url}')` }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent" />
              </>
            )}
            {!isCover && !b?.background_color && (
              <>
                <div className="absolute -right-16 -top-16 w-64 h-64 bg-primary/20 rounded-full blur-[80px] pointer-events-none" />
                <div className="absolute -left-16 -bottom-16 w-56 h-56 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
              </>
            )}
            <div className="relative z-10 flex items-center justify-between h-full px-5 md:px-6 gap-4">
              <div className="flex-1 min-w-0">
                {b?.category && (
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/15 border border-primary/25 mb-1.5">
                    <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-primary" />
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{b.category}</span>
                  </div>
                )}
                <h3 className={`text-base md:text-xl font-bold leading-tight truncate ${isCover ? "text-white" : "text-foreground"}`}>
                  {b?.title}
                </h3>
                {b?.subtitle && (
                  <p className={`text-xs md:text-sm mt-0.5 line-clamp-1 ${isCover ? "text-slate-300" : "text-muted-foreground"}`}>
                    {b.subtitle}
                  </p>
                )}
              </div>
              {displayBanners.length > 1 && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setCurrentBanner((p) => (p - 1 + displayBanners.length) % displayBanners.length)}
                    className="p-1.5 rounded-md bg-black/40 border border-white/10 hover:bg-black/60 transition-colors"
                    aria-label="Anterior"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 text-white" />
                  </button>
                  <span className="text-[10px] text-slate-300 font-medium tabular-nums">{currentBanner + 1}/{displayBanners.length}</span>
                  <button
                    onClick={() => setCurrentBanner((p) => (p + 1) % displayBanners.length)}
                    className="p-1.5 rounded-md bg-black/40 border border-white/10 hover:bg-black/60 transition-colors"
                    aria-label="Próximo"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              )}
            </div>
            {/* dots */}
            {displayBanners.length > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {displayBanners.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentBanner(i)}
                    className={`h-1 rounded-full transition-all ${i === currentBanner ? "w-5 bg-primary" : "w-1.5 bg-white/30"}`}
                    aria-label={`Banner ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })()}

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

      {/* Sort Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mr-1">Ordenar:</span>
        {[
          { id: "campeoes", label: "Campeões de venda", icon: Crown },
          { id: "comissao", label: "Maior comissão", icon: DollarSign },
          { id: "preco_maior", label: "Maior preço", icon: ArrowDownAZ },
          { id: "preco_menor", label: "Menor preço", icon: ArrowUpAZ },
        ].map(s => {
          const Icon = s.icon;
          const active = sortBy === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSortBy(s.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                active
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-[#1A1A1A] border-[#2A2A2A] text-slate-400 hover:border-primary/30 hover:text-white"
              }`}
            >
              <Icon className="size-3.5" />
              {s.label}
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
          {filteredProducts.map(p => {
            const badge = topBadge(p.id);
            const BadgeIcon = badge?.icon;
            return (
            <div key={p.id} className={`relative bg-[#1A1A1A] border rounded-xl p-4 flex flex-col gap-3 transition-colors ${badge ? "border-primary/40 shadow-[0_0_0_1px_rgba(34,197,94,0.15)]" : "border-[#2A2A2A] hover:border-primary/30"}`}>
              {badge && BadgeIcon && (
                <div className={`absolute -top-2 left-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r ${badge.cls} text-white text-[10px] font-bold uppercase tracking-wider shadow-md`}>
                  <BadgeIcon className="size-3" />
                  {badge.label}
                </div>
              )}
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
            );
          })}
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

// ============================== Journey Tab ==============================

interface JourneyTabProps {
  events: any[];
  loading: boolean;
  range: number;
  onRangeChange: (n: number) => void;
  commissionRate: number;
}

function JourneyTab({ events, loading, range, onRangeChange, commissionRate }: JourneyTabProps) {
  // Funnel counts (distinct visitors per stage)
  const funnel = useMemo(() => {
    const stages: Array<"click" | "view_product" | "checkout" | "purchase"> = [
      "click", "view_product", "checkout", "purchase",
    ];
    const sets: Record<string, Set<string>> = {};
    stages.forEach(s => (sets[s] = new Set()));
    events.forEach(e => {
      if (sets[e.event_type]) sets[e.event_type].add(e.visitor_id);
    });
    return stages.map(s => ({ stage: s, count: sets[s].size }));
  }, [events]);

  const totalClicks = funnel[0].count || 0;
  const totalPurchases = funnel[3].count || 0;
  const conversionRate = totalClicks > 0 ? ((totalPurchases / totalClicks) * 100).toFixed(2) : "0";
  const totalCommission = useMemo(
    () => events
      .filter(e => e.event_type === "purchase")
      .reduce((s, e) => s + Number(e.commission_amount || 0), 0),
    [events]
  );

  // Group events by visitor for the leads list
  const visitorLeads = useMemo(() => {
    const map = new Map<string, any>();
    for (const e of events) {
      const cur = map.get(e.visitor_id) || {
        visitor_id: e.visitor_id,
        events: [],
        user_id: null,
        product_name: null,
        last_at: e.created_at,
        status: "click",
        amount: 0,
        commission: 0,
      };
      cur.events.push(e);
      if (e.user_id) cur.user_id = e.user_id;
      if (e.product_name) cur.product_name = e.product_name;
      if (new Date(e.created_at) > new Date(cur.last_at)) cur.last_at = e.created_at;
      // status priority
      const order = { click: 1, view_product: 2, checkout: 3, purchase: 4 } as any;
      if (order[e.event_type] > order[cur.status]) cur.status = e.event_type;
      if (e.event_type === "purchase") {
        cur.amount = Number(e.amount || 0);
        cur.commission = Number(e.commission_amount || 0);
      }
      map.set(e.visitor_id, cur);
    }
    return Array.from(map.values()).sort((a, b) =>
      new Date(b.last_at).getTime() - new Date(a.last_at).getTime()
    );
  }, [events]);

  const stageMeta: Record<string, { label: string; color: string; icon: any }> = {
    click:        { label: "Clique",       color: "text-slate-300",   icon: MousePointerClick },
    view_product: { label: "Viu Produto",  color: "text-sky-400",     icon: Eye },
    checkout:     { label: "Checkout",     color: "text-amber-400",   icon: CreditCard },
    purchase:     { label: "Comprou",      color: "text-emerald-400", icon: CircleCheck },
  };

  return (
    <section className="space-y-6">
      {/* Header + filtros */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Route className="size-5 text-primary" />
            Jornada de Compra
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Acompanhe cada visitante desde o clique no seu link até a venda confirmada.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase">Período:</span>
          <select
            value={range}
            onChange={e => onRangeChange(Number(e.target.value))}
            className="bg-[#0F0F0F] border border-[#2A2A2A] text-xs text-slate-300 rounded-lg px-3 py-1.5 focus:ring-primary focus:border-primary outline-none"
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
            <option value={365}>Último ano</option>
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Cliques únicos" value={totalClicks} icon={MousePointerClick} />
        <KPI label="Vendas" value={totalPurchases} icon={CircleCheck} accent />
        <KPI label="Conversão" value={`${conversionRate}%`} icon={Activity} />
        <KPI label="Comissão (período)" value={`R$ ${totalCommission.toLocaleString("pt-BR",{minimumFractionDigits:2})}`} icon={DollarSign} accent />
      </div>

      {/* Funnel */}
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-5 md:p-6">
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500 mb-4">Funil de Conversão</h3>
        {loading ? (
          <div className="py-10 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" /></div>
        ) : totalClicks === 0 ? (
          <div className="py-10 text-center">
            <Route className="size-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Ainda não há dados de jornada neste período.</p>
            <p className="text-xs text-slate-600 mt-1">Compartilhe seu link de parceiro para começar a rastrear visitantes.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {funnel.map((f, i) => {
              const pct = totalClicks > 0 ? (f.count / totalClicks) * 100 : 0;
              const meta = stageMeta[f.stage];
              const Icon = meta.icon;
              const dropFromPrev = i > 0 && funnel[i - 1].count > 0
                ? (((funnel[i - 1].count - f.count) / funnel[i - 1].count) * 100).toFixed(0)
                : null;
              return (
                <div key={f.stage} className="group">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className={`flex items-center gap-2 text-sm font-bold ${meta.color}`}>
                      <Icon className="size-4" />
                      {meta.label}
                    </div>
                    <div className="flex items-center gap-3">
                      {dropFromPrev !== null && Number(dropFromPrev) > 0 && (
                        <span className="text-[10px] text-rose-400/70">-{dropFromPrev}% vs anterior</span>
                      )}
                      <span className="text-xs text-slate-400 tabular-nums">{f.count}</span>
                      <span className="text-xs font-bold text-white tabular-nums w-12 text-right">{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="bg-[#0F0F0F] rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: f.stage === "purchase"
                          ? "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary)/0.6))"
                          : f.stage === "checkout" ? "linear-gradient(90deg, #f59e0b, #f59e0b80)"
                          : f.stage === "view_product" ? "linear-gradient(90deg, #38bdf8, #38bdf880)"
                          : "linear-gradient(90deg, #64748b, #64748b80)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Leads list */}
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2A2A2A] flex items-center justify-between">
          <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
            <Users className="size-4 text-primary" />
            Visitantes & Indicações
          </h3>
          <span className="text-xs text-slate-500">{visitorLeads.length} no período</span>
        </div>
        {visitorLeads.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            Nenhum visitante registrado ainda.
          </div>
        ) : (
          <div className="divide-y divide-[#2A2A2A] max-h-[520px] overflow-y-auto">
            {visitorLeads.slice(0, 100).map(lead => {
              const meta = stageMeta[lead.status];
              const Icon = meta.icon;
              const visitorShort = `#${(lead.visitor_id || "").slice(0, 6)}`;
              return (
                <div key={lead.visitor_id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`size-9 rounded-lg bg-[#0F0F0F] border border-[#2A2A2A] flex items-center justify-center shrink-0 ${meta.color}`}>
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">
                        {lead.user_id ? `Cliente ${visitorShort}` : `Visitante ${visitorShort}`}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {lead.product_name ? `Interesse: ${lead.product_name}` : "Navegando na loja"}
                        {" · "}{new Date(lead.last_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {lead.status === "purchase" ? (
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Comprou</p>
                        <p className="text-sm font-bold text-primary tabular-nums">
                          + R$ {Number(lead.commission || 0).toLocaleString("pt-BR",{minimumFractionDigits:2})}
                        </p>
                      </div>
                    ) : (
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-[#0F0F0F] border border-[#2A2A2A] ${meta.color}`}>
                        {meta.label}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
        <p className="text-[11px] text-slate-400 leading-relaxed">
          <strong className="text-primary">Como funciona:</strong> cada visitante recebe um identificador anônimo ao
          clicar no seu link. A atribuição dura <strong>30 dias</strong> — se ele comprar nesse período, a venda é creditada para você
          automaticamente. Sua comissão atual é de <strong className="text-primary">{commissionRate}%</strong> sobre cada pedido confirmado.
        </p>
      </div>
    </section>
  );
}

function KPI({ label, value, icon: Icon, accent }: { label: string; value: any; icon: any; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-4 border ${accent ? "bg-primary/5 border-primary/30" : "bg-[#1A1A1A] border-[#2A2A2A]"}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
        <Icon className={`size-4 ${accent ? "text-primary" : "text-slate-500"}`} />
      </div>
      <p className={`text-xl font-bold tabular-nums ${accent ? "text-primary" : "text-white"}`}>{value}</p>
    </div>
  );
}
