import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Store,
  Percent,
  Coins,
  Users,
  TrendingUp,
  Palette,
  Globe,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
  Wallet,
  ShoppingBag,
  LayoutDashboard,
  Receipt,
  LifeBuoy,
  LogOut,
  Menu,
  X,
  Sparkles,
  Settings,
  ChevronDown,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { ResellerLoja } from "@/components/revenda/ResellerLoja";
import ResellerCentralProxy from "@/components/revenda/ResellerCentralProxy";
import ResellerAssinaturas from "@/components/revenda/ResellerAssinaturas";
import ResellerMaintenance from "@/components/revenda/ResellerMaintenance";
import ResellerDashboard from "@/components/revenda/ResellerDashboard";
import ResellerStoreConfig from "@/components/revenda/ResellerStoreConfig";
import ResellerGatewayConfig from "@/components/revenda/ResellerGatewayConfig";
import ResellerPagamentos from "@/components/revenda/ResellerPagamentos";
import ResellerClientes from "@/components/revenda/ResellerClientes";
import ResellerCatalogoPrecos from "@/components/revenda/ResellerCatalogoPrecos";
import ResellerRevenueGoal from "@/components/revenda/ResellerRevenueGoal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ResellerBannersManager } from "@/components/revenda/ResellerBannersManager";
import SiteImageUpload from "@/components/admin/SiteImageUpload";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NavLink } from "react-router-dom";
import { Ticket, Wrench, CreditCard, Package } from "lucide-react";
import { Image as ImageIcon } from "lucide-react";

// Converte #RRGGBB para o formato "H S% L%" usado pelas variáveis CSS do design system
function hexToHslTriplet(hex: string): string | null {
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / (max - min) + (g < b ? 6 : 0); break;
      case g: h = (b - r) / (max - min) + 2; break;
      case b: h = (r - g) / (max - min) + 4; break;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

interface Reseller {
  id: string;
  user_id: string;
  slug: string;
  company_name: string;
  brand_name: string | null;
  status: string;
  model: "percentage" | "credit";
  commission_rate: number;
  balance_credits: number;
  min_proxies_per_month: number;
  min_monthly_recharge: number;
  proxy_unit_cost: number;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  support_email: string | null;
  support_whatsapp: string | null;
  custom_domain: string | null;
  domain_status: string | null;
  lovable_verify_token: string | null;
  openpix_pix_key: string | null;
  openpix_pix_key_type: string | null;
  total_gmv: number;
  total_commissions_earned: number;
  total_referrals: number;
  proxy_price_mode?: string | null;
  proxy_price_multiplier?: number | null;
  proxy_fixed_price?: number | null;
  hero_title?: string | null;
  hero_subtitle?: string | null;
  about_text?: string | null;
}

interface Commission {
  id: string;
  order_id: string;
  order_total: number;
  commission_amount: number;
  status: string;
  created_at: string;
  credited_at: string | null;
}

interface LedgerEntry {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

export default function RevendaPortal() {
  const [loading, setLoading] = useState(true);
  const [reseller, setReseller] = useState<Reseller | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [savingBrand, setSavingBrand] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null; balance: number } | null>(null);
  const [unreadTickets, setUnreadTickets] = useState(0);
  const [activeSection, setActiveSection] = useState<
    "dashboard" | "overview" | "loja" | "vendas" | "manutencao" | "link" | "ajuda" | "dominio" | "identidade" | "central-proxy" | "assinaturas" | "minha-loja" | "pagamentos" | "gateway" | "clientes" | "banners"
  >("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const navigate = useNavigate();
  const [brand, setBrand] = useState({
    brand_name: "",
    logo_url: "",
    favicon_url: "",
    primary_color: "#22c55e",
    accent_color: "#0ea5e9",
    support_email: "",
    support_whatsapp: "",
    custom_domain: "",
  });

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data: r } = await supabase
        .from("resellers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (r) {
        setReseller(r as Reseller);
        setBrand({
          brand_name: r.brand_name || "",
          logo_url: r.logo_url || "",
          favicon_url: r.favicon_url || "",
          primary_color: r.primary_color || "#22c55e",
          accent_color: r.accent_color || "#0ea5e9",
          support_email: r.support_email || "",
          support_whatsapp: r.support_whatsapp || "",
          custom_domain: r.custom_domain || "",
        });
        const [{ data: c }, { data: l }, { data: p }, { count: tkCount }] = await Promise.all([
          supabase
            .from("reseller_commissions")
            .select("*")
            .eq("reseller_id", r.id)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("reseller_credit_ledger")
            .select("*")
            .eq("reseller_id", r.id)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("profiles")
            .select("full_name,avatar_url,balance")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("tickets")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .in("status", ["open", "waiting_client"]),
        ]);
        setCommissions((c as Commission[]) || []);
        setLedger((l as LedgerEntry[]) || []);
        setProfile({
          full_name: (p as any)?.full_name ?? null,
          avatar_url: (p as any)?.avatar_url ?? null,
          balance: Number((p as any)?.balance ?? 0),
        });
        setUnreadTickets(tkCount || 0);
      }
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const pending = commissions
      .filter((c) => c.status === "pending")
      .reduce((s, c) => s + Number(c.commission_amount || 0), 0);
    const credited = commissions
      .filter((c) => c.status === "credited")
      .reduce((s, c) => s + Number(c.commission_amount || 0), 0);
    return { pending, credited };
  }, [commissions]);

  // Aplica a identidade visual do revendedor globalmente (cobre portais/modais/toasts)
  useEffect(() => {
    if (!reseller) return;
    const primaryHsl = hexToHslTriplet(reseller.primary_color || "");
    const accentHsl = hexToHslTriplet(reseller.accent_color || "");
    if (!primaryHsl && !accentHsl) return;
    const styleEl = document.createElement("style");
    styleEl.id = "reseller-branding-vars";
    const rules: string[] = [];
    if (primaryHsl) {
      rules.push(`--primary: ${primaryHsl} !important;`);
      rules.push(`--ring: ${primaryHsl} !important;`);
      rules.push(`--sidebar-primary: ${primaryHsl} !important;`);
      rules.push(`--sidebar-ring: ${primaryHsl} !important;`);
    }
    if (accentHsl) {
      rules.push(`--accent: ${accentHsl} !important;`);
    }
    styleEl.textContent = `:root, .dark, html, body { ${rules.join(" ")} }`;
    // Remove qualquer instância anterior
    document.getElementById("reseller-branding-vars")?.remove();
    document.head.appendChild(styleEl);
    return () => {
      styleEl.remove();
    };
  }, [reseller?.primary_color, reseller?.accent_color, reseller?.id]);

  const saveBranding = async () => {
    if (!reseller) return;
    setSavingBrand(true);
    const { error } = await supabase
      .from("resellers")
      .update({
        brand_name: brand.brand_name || null,
        logo_url: brand.logo_url || null,
        favicon_url: brand.favicon_url || null,
        primary_color: brand.primary_color,
        accent_color: brand.accent_color,
        support_email: brand.support_email || null,
        support_whatsapp: brand.support_whatsapp || null,
        custom_domain: brand.custom_domain || null,
      })
      .eq("id", reseller.id);
    setSavingBrand(false);
    if (error) toast.error("Erro ao salvar: " + error.message);
    else {
      toast.success("Identidade visual atualizada");
      setReseller({ ...reseller, ...brand } as Reseller);
    }
  };

  const copyLink = () => {
    if (!reseller) return;
    navigator.clipboard.writeText(`${window.location.origin}/revenda/${reseller.slug}`);
    setCopied(true);
    toast.success("Link copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  const [verifyingDomain, setVerifyingDomain] = useState(false);
  const verifyDomain = async () => {
    if (!reseller) return;
    setVerifyingDomain(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-reseller-domain", {
        body: { reseller_id: reseller.id },
      });
      if (error) throw error;
      if (data?.status === "verified") {
        toast.success(data.message || "Domínio verificado!");
      } else {
        toast.error(data?.message || "Não foi possível verificar. Aguarde a propagação DNS.");
      }
      if (data?.status) {
        setReseller({ ...reseller, domain_status: data.status } as Reseller);
      }
    } catch (e: any) {
      toast.error("Erro ao verificar: " + (e?.message ?? "desconhecido"));
    } finally {
      setVerifyingDomain(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0505]">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!reseller) {
    return (
      <div className="max-w-xl mx-auto mt-16 p-8 text-center space-y-3">
        <Store className="size-12 text-muted-foreground mx-auto" />
        <h1 className="text-xl font-bold">Você ainda não é revendedor</h1>
        <p className="text-sm text-muted-foreground">
          Fale com o administrador para habilitar seu painel de revenda white-label.
        </p>
      </div>
    );
  }

  const suspended = reseller.status === "suspended" || reseller.status === "inactive";

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "clientes", label: "Clientes", icon: Users },
    { id: "central-proxy", label: "Central Proxy", icon: Globe },
    { id: "assinaturas", label: "Assinaturas", icon: Users },
    { id: "manutencao", label: "Manutenção", icon: Wrench },
    { id: "minha-loja", label: "Minha Loja", icon: ShoppingBag },
    { id: "pagamentos", label: "Pagamentos", icon: CreditCard },
    {
      id: "configuracoes",
      label: "Configurações",
      icon: Settings,
      children: [
        { id: "dominio", label: "Domínio Próprio", icon: Globe },
        { id: "link", label: "Link de Revenda", icon: Globe },
        { id: "identidade", label: "Identidade Visual", icon: Palette },
        { id: "banners", label: "Banners da Loja", icon: ImageIcon },
        { id: "gateway", label: "Gateway de Pagamento", icon: CreditCard },
      ],
    },
  ] as const;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div
      className="reseller-portal-root fixed inset-0 flex w-full font-display overflow-hidden text-foreground selection:bg-primary selection:text-primary-foreground"
      style={(() => {
        const hsl = hexToHslTriplet(reseller.primary_color || "");
        const base: React.CSSProperties = {
          // Tonalidade azul-navy premium para o painel do revendedor
          background:
            "radial-gradient(1200px 800px at 15% -10%, hsl(215 55% 14%) 0%, transparent 60%), radial-gradient(1000px 700px at 110% 110%, hsl(220 50% 12%) 0%, transparent 55%), hsl(220 45% 8%)",
          ["--background" as any]: "220 45% 8%",
          ["--card" as any]: "220 40% 11%",
          ["--popover" as any]: "220 40% 11%",
          ["--muted" as any]: "220 30% 15%",
          ["--secondary" as any]: "220 30% 14%",
          ["--border" as any]: "215 45% 28%",
          ["--input" as any]: "215 45% 25%",
          ["--sidebar-border" as any]: "215 45% 28%",
          ["--sidebar-background" as any]: "220 45% 9%",
        };
        if (hsl) {
          base["--primary" as any] = hsl;
          base["--ring" as any] = hsl;
          base["--sidebar-primary" as any] = hsl;
          base["--sidebar-ring" as any] = hsl;
        }
        return base;
      })()}
    >
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] bg-primary/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[35%] h-[35%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30%] h-[30%] bg-white/[0.02] rounded-full blur-[100px]" />
      </div>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:relative z-50 lg:z-10 h-full w-64 shrink-0 flex flex-col bg-[hsl(var(--card))]/40 backdrop-blur-2xl transition-all duration-300 overflow-hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          sidebarCollapsed && "lg:-translate-x-full lg:w-0"
        )}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-3">
            {reseller.logo_url ? (
              <img
                src={reseller.logo_url}
                alt={reseller.company_name}
                className="size-10 rounded-xl object-cover ring-1 ring-border/60"
              />
            ) : (
              <div
                className="size-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-lg"
                style={{ background: reseller.primary_color || "#22c55e" }}
              >
                {reseller.company_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">
                {reseller.brand_name || reseller.company_name}
              </p>
            </div>
          </div>
          <button
            className="lg:hidden p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const hasChildren = "children" in item && Array.isArray((item as any).children);
            if (hasChildren) {
              const children = (item as any).children as { id: string; label: string; icon: any }[];
              const anyChildActive = children.some((c) => c.id === activeSection);
              const expanded = configOpen || anyChildActive;
              return (
                <div key={item.id} className="space-y-1">
                  <button
                    onClick={() => setConfigOpen((v) => !v)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                      anyChildActive
                        ? "text-foreground bg-muted/40"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
                    <ChevronDown
                      className={cn("size-4 ml-auto transition-transform", expanded && "rotate-180")}
                    />
                  </button>
                  {expanded && (
                    <div className="ml-3 pl-3 border-l border-border/40 space-y-1">
                      {children.map((c) => {
                        const CIcon = c.icon;
                        const isActive = activeSection === c.id;
                        return (
                          <button
                            key={c.id}
                            onClick={() => {
                              setActiveSection(c.id as typeof activeSection);
                              setSidebarOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                              isActive
                                ? "bg-gradient-to-r from-primary/90 to-primary/60 text-primary-foreground shadow-lg shadow-primary/25"
                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                          >
                            <CIcon className="size-3.5 shrink-0" />
                            <span>{c.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id as typeof activeSection);
                  setSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative",
                  isActive
                    ? "bg-gradient-to-r from-primary/90 to-primary/60 text-primary-foreground shadow-lg shadow-primary/25"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Icon className={cn("size-4 shrink-0", isActive && "drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]")} />
                <span>{item.label}</span>
                {isActive && <span className="ml-auto size-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 space-y-2">
          <button
            onClick={() => {
              setSidebarOpen(false);
              setSidebarCollapsed(true);
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            <ChevronLeft className="size-4" />
            <span>Recolher painel</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="relative z-10 flex-1 flex flex-col h-full overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-3 px-4 lg:px-8 h-16 bg-background/60 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-3">
            <button
              className={cn(
                "p-2 rounded-lg hover:bg-muted/50 text-muted-foreground",
                !sidebarCollapsed && "lg:hidden"
              )}
              onClick={() => {
                setSidebarOpen(true);
                setSidebarCollapsed(false);
              }}
              title="Abrir painel"
            >
              <Menu className="size-5" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            {/* Tickets */}
            <NavLink
              to="/tickets"
              className="relative flex items-center justify-center size-9 rounded-full bg-card border border-border/60 hover:border-primary/50 hover:bg-primary/10 transition-all group"
              title="Tickets"
            >
              <Ticket className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
              {unreadTickets > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold animate-pulse">
                  {unreadTickets > 9 ? "9+" : unreadTickets}
                </span>
              )}
            </NavLink>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Meta de faturamento */}
            <ResellerRevenueGoal resellerId={reseller.id} />

            {/* Saldo do revendedor */}
            {(() => {
              const resellerBalance = Number(reseller?.balance_credits ?? 0);
              const positive = resellerBalance > 0;
              return (
                <button
                  type="button"
                  onClick={() => navigate("/revenda?tab=financeiro")}
                  className={cn(
                    "hidden sm:flex items-center gap-2 border px-3.5 py-1.5 rounded-full backdrop-blur-sm transition-colors group",
                    positive
                      ? "bg-emerald-500/10 border-emerald-500/25 hover:bg-emerald-500/15"
                      : "bg-destructive/10 border-destructive/25 hover:bg-destructive/15"
                  )}
                >
                  <Wallet className={cn("size-4", positive ? "text-emerald-400" : "text-destructive")} />
                  <div className="flex flex-col leading-none text-left">
                    <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">
                      Saldo
                    </span>
                    <span className={cn("text-sm font-bold", positive ? "text-emerald-400" : "text-destructive")}>
                      R$ {resellerBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </button>
              );
            })()}

            {/* User */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-2.5 cursor-pointer pl-3 border-l border-border/50">
                  <span className="text-sm font-semibold text-foreground hidden lg:block">
                    {(profile?.full_name || reseller.company_name).split(" ")[0]}
                  </span>
                  <div className="relative size-9 rounded-full overflow-hidden border-2 border-primary/30 hover:ring-2 hover:ring-primary/40 transition-all">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                        {(profile?.full_name || reseller.company_name).charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <ChevronDown className="size-4 text-muted-foreground hidden sm:block" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card border-border">
                <DropdownMenuItem asChild>
                  <NavLink to="/wallet" className="flex items-center gap-2 text-foreground cursor-pointer">
                    <Wallet className="size-4" /> Minha Carteira
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <NavLink to="/tickets" className="flex items-center gap-2 text-foreground cursor-pointer">
                    <Ticket className="size-4" /> Meus Tickets
                  </NavLink>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="size-4 mr-2" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 lg:py-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {suspended && (
              <Card className="p-4 border-primary/40 bg-primary/5 backdrop-blur flex items-start gap-3">
                <AlertTriangle className="size-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-primary">Painel suspenso</p>
                  <p className="text-xs text-primary">
                    Seu painel está inativo. Regularize a recarga mínima ou entre em contato com o
                    suporte para reativação.
                  </p>
                </div>
              </Card>
            )}

            {activeSection === "dashboard" && (
              <ResellerDashboard
                resellerId={reseller.id}
                primaryColor={reseller.primary_color}
                totalGmv={Number(reseller.total_gmv || 0)}
                totalCommissionsEarned={Number(reseller.total_commissions_earned || 0)}
                totalReferrals={Number(reseller.total_referrals || 0)}
                balanceCredits={Number(reseller.balance_credits || 0)}
                pendingCommissions={stats.pending}
                creditedCommissions={stats.credited}
                brandName={reseller.brand_name || reseller.company_name}
                onNavigate={(s) => setActiveSection(s as any)}
              />
            )}

            {activeSection === "overview" && (
              <ResellerCatalogoPrecos
                resellerId={reseller.id}
                model={reseller.model}
                proxyUnitCost={Number(reseller.proxy_unit_cost || 0)}
                commissionRate={Number(reseller.commission_rate || 0)}
                proxyPriceMultiplier={reseller.proxy_price_multiplier ?? 1.5}
                proxyFixedPrice={reseller.proxy_fixed_price ?? null}
                proxyPriceMode={reseller.proxy_price_mode ?? "multiplier"}
              />
            )}

            {activeSection === "loja" && (
              <ResellerLoja
                resellerId={reseller.id}
                primaryColor={reseller.primary_color}
              />
            )}

            {activeSection === "central-proxy" && (
              <ResellerCentralProxy
                resellerId={reseller.id}
                model={reseller.model}
                proxyUnitCost={Number(reseller.proxy_unit_cost || 0)}
                commissionRate={Number(reseller.commission_rate || 0)}
              />
            )}

            {activeSection === "assinaturas" && (
              <ResellerAssinaturas resellerId={reseller.id} />
            )}

            {activeSection === "minha-loja" && (
              <ResellerStoreConfig resellerId={reseller.id} slug={reseller.slug} />
            )}

            {activeSection === "pagamentos" && (
              <ResellerPagamentos resellerId={reseller.id} />
            )}

            {activeSection === "gateway" && (
              <ResellerGatewayConfig resellerId={reseller.id} />
            )}

            {activeSection === "banners" && (
              <ResellerBannersManager resellerId={reseller.id} />
            )}

            {activeSection === "clientes" && <ResellerClientes />}

            {activeSection === "manutencao" && (
              <ResellerMaintenance
                resellerId={reseller.id}
                balance={Number(reseller.balance_credits || 0)}
                swapPrice={Number((reseller as any).maintenance_swap_price ?? 2)}
                dayPrice={Number((reseller as any).maintenance_day_price ?? 0.5)}
                onBalanceChange={(nb) =>
                  setReseller((prev) => (prev ? { ...prev, balance_credits: nb } : prev))
                }
              />
            )}

            {activeSection === "vendas" && (
              <div className="animate-fade-in">
                {reseller.model === "percentage" ? (
                  <Card className="bg-card/60 border-border/40 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/30 text-muted-foreground text-xs uppercase">
                          <tr>
                            <th className="text-left px-4 py-3">Data</th>
                            <th className="text-right px-4 py-3">Valor pedido</th>
                            <th className="text-right px-4 py-3">Comissão</th>
                            <th className="text-center px-4 py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {commissions.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="text-center py-10 text-muted-foreground">
                                Nenhuma comissão ainda.
                              </td>
                            </tr>
                          ) : (
                            commissions.map((c) => (
                              <tr key={c.id} className="border-t border-border/30">
                                <td className="px-4 py-3">
                                  {new Date(c.created_at).toLocaleDateString("pt-BR")}
                                </td>
                                <td className="text-right px-4 py-3">
                                  R$ {Number(c.order_total).toFixed(2)}
                                </td>
                                <td className="text-right px-4 py-3 font-bold text-primary">
                                  R$ {Number(c.commission_amount).toFixed(2)}
                                </td>
                                <td className="text-center px-4 py-3">
                                  <StatusBadge status={c.status} />
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                ) : (
                  <Card className="bg-card/60 border-border/40 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/30 text-muted-foreground text-xs uppercase">
                          <tr>
                            <th className="text-left px-4 py-3">Data</th>
                            <th className="text-left px-4 py-3">Tipo</th>
                            <th className="text-left px-4 py-3">Descrição</th>
                            <th className="text-right px-4 py-3">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ledger.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="text-center py-10 text-muted-foreground">
                                Sem movimentações ainda.
                              </td>
                            </tr>
                          ) : (
                            ledger.map((l) => {
                              const positive = ["recharge", "adjustment", "refund"].includes(l.type);
                              return (
                                <tr key={l.id} className="border-t border-border/30">
                                  <td className="px-4 py-3">
                                    {new Date(l.created_at).toLocaleString("pt-BR")}
                                  </td>
                                  <td className="px-4 py-3 capitalize">{l.type}</td>
                                  <td className="px-4 py-3 text-muted-foreground">
                                    {l.description || "—"}
                                  </td>
                                  <td
                                    className={`text-right px-4 py-3 font-bold ${
                                      positive ? "text-green-400" : "text-primary"
                                    }`}
                                  >
                                    {positive ? "+" : "-"} R$ {Math.abs(Number(l.amount)).toFixed(2)}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}
              </div>
            )}

            {activeSection === "identidade" && (
              <Card className="p-5 bg-card/60 border-border/40 space-y-4">
                <div className="flex items-center gap-2">
                  <Palette className="size-4 text-primary" />
                  <h3 className="font-bold">Identidade visual</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <Label>Nome de marca</Label>
                    <Input
                      value={brand.brand_name}
                      onChange={(e) => setBrand({ ...brand, brand_name: e.target.value })}
                      placeholder={reseller.company_name}
                    />
                  </div>
                  <div>
                    <SiteImageUpload
                      label="Logo"
                      value={brand.logo_url}
                      onChange={(url) => setBrand({ ...brand, logo_url: url })}
                      pathPrefix={`resellers/${reseller.id}/logo`}
                    />
                  </div>
                  <div>
                    <SiteImageUpload
                      label="Favicon"
                      value={brand.favicon_url}
                      onChange={(url) => setBrand({ ...brand, favicon_url: url })}
                      pathPrefix={`resellers/${reseller.id}/favicon`}
                    />
                  </div>
                  <div>
                    <Label>Cor primária</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="color"
                        value={brand.primary_color}
                        onChange={(e) => setBrand({ ...brand, primary_color: e.target.value })}
                        className="w-16 p-1 h-10"
                      />
                      <Input
                        value={brand.primary_color}
                        onChange={(e) => setBrand({ ...brand, primary_color: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Cor de destaque</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="color"
                        value={brand.accent_color}
                        onChange={(e) => setBrand({ ...brand, accent_color: e.target.value })}
                        className="w-16 p-1 h-10"
                      />
                      <Input
                        value={brand.accent_color}
                        onChange={(e) => setBrand({ ...brand, accent_color: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>E-mail de suporte</Label>
                    <Input
                      type="email"
                      value={brand.support_email}
                      onChange={(e) => setBrand({ ...brand, support_email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>WhatsApp de suporte</Label>
                    <Input
                      value={brand.support_whatsapp}
                      onChange={(e) => setBrand({ ...brand, support_whatsapp: e.target.value })}
                      placeholder="5511999999999"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={saveBranding} disabled={savingBrand} className="gap-2">
                    {savingBrand && <Loader2 className="size-4 animate-spin" />}
                    Salvar alterações
                  </Button>
                </div>
              </Card>
            )}

            {activeSection === "dominio" && (() => {
              // Extrai o subdomínio (parte antes do domínio raiz) — ex: "painel" em "painel.suamarca.com.br"
              const domain = (brand.custom_domain || reseller.custom_domain || "").trim().toLowerCase();
              const domainParts = domain.split(".").filter(Boolean);
              const subHost = domainParts.length >= 3 ? domainParts.slice(0, domainParts.length - 2).join(".") : "";
              const aHost = subHost || "painel";
              const txtHost = subHost ? `_lovable.${subHost}` : "_lovable.painel";
              const aValue = "185.158.133.1";
              const verifyToken = reseller.lovable_verify_token || "";
              const txtValue = verifyToken ? `lovable_verify=${verifyToken}` : "";
              const status = reseller.domain_status || "pending";
              const isVerified = status === "verified";
              const copy = (label: string, value: string) => {
                navigator.clipboard.writeText(value);
                setCopiedField(label);
                setTimeout(() => setCopiedField((c) => (c === label ? null : c)), 1600);
              };
              const statusStyle = isVerified
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : status === "failed"
                ? "bg-primary/10 border-primary/20 text-primary"
                : "bg-amber-500/10 border-amber-500/20 text-amber-400";
              const statusDot = isVerified ? "bg-emerald-500" : status === "failed" ? "bg-primary" : "bg-amber-500";
              const statusLabel = isVerified
                ? "Verificado"
                : status === "failed"
                ? "Falha na verificação"
                : "Verificação pendente";

              return (
                <div className="relative w-full max-w-3xl mx-auto rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl shadow-2xl overflow-hidden">
                  <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 blur-[100px] rounded-full pointer-events-none" />

                  {/* Header */}
                  <div className="p-6 md:p-8 pb-5 flex items-center justify-between border-b border-border/40 bg-card/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Globe className="w-5 h-5 text-primary" />
                      </div>
                      <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground font-display">
                        Domínio próprio
                      </h1>
                    </div>
                    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full border", statusStyle)}>
                      <span className="relative flex h-2 w-2">
                        {!isVerified && (
                          <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", statusDot)} />
                        )}
                        <span className={cn("relative inline-flex rounded-full h-2 w-2", statusDot)} />
                      </span>
                      <span className="text-[11px] uppercase tracking-wider font-bold">{statusLabel}</span>
                    </div>
                  </div>

                  <div className="p-6 md:p-8 space-y-8">
                    {/* Input */}
                    <div className="space-y-2.5">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
                        Seu subdomínio personalizado
                      </label>
                      <div className="relative group">
                        <Input
                          value={brand.custom_domain}
                          onChange={(e) => setBrand({ ...brand, custom_domain: e.target.value })}
                          placeholder="painel.suamarca.com.br"
                          className="w-full bg-background/40 border-border/40 rounded-xl px-5 py-6 text-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50 transition-all font-medium text-base"
                        />
                      </div>
                    </div>

                    {/* Aviso de segurança */}
                    <div className="flex gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                      <div className="shrink-0 mt-0.5">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-400 text-sm font-bold">i</span>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-sm font-semibold text-emerald-300">
                          Seu site principal não será afetado
                        </p>
                        <p className="text-xs leading-relaxed text-emerald-200/70">
                          Use sempre um <strong className="text-emerald-200">subdomínio</strong> (ex: <span className="font-mono">painel.suamarca.com.br</span>, <span className="font-mono">app.suamarca.com.br</span>). Os registros A e TXT abaixo são <strong className="text-emerald-200">novos e independentes</strong> — seu domínio raiz (<span className="font-mono">suamarca.com.br</span>) e o <span className="font-mono">www</span> continuam funcionando normalmente, sem qualquer interrupção.
                        </p>
                        <p className="text-xs leading-relaxed text-amber-300/80 pt-1">
                          ⚠️ <strong>Nunca</strong> aponte seu domínio raiz diretamente para o nosso painel — isso tiraria seu site atual do ar.
                        </p>
                      </div>
                    </div>

                    {/* DNS Records */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-foreground/80 flex items-center gap-2 font-display">
                          Configurações DNS
                          <span className="text-[10px] bg-muted/40 border border-border/40 px-2 py-0.5 rounded text-muted-foreground font-normal normal-case tracking-normal">
                            {isVerified ? "Propagado" : "Aguardando propagação"}
                          </span>
                        </h2>
                      </div>

                      <div className="grid gap-4">
                        {/* A RECORD */}
                        <div className="bg-card/30 border border-border/30 rounded-xl p-5 hover:border-border/50 transition-colors">
                          <div className="flex items-center justify-between mb-4">
                            <span className="px-2 py-1 rounded bg-primary/10 text-primary text-[10px] font-bold tracking-widest uppercase border border-primary/20">
                              A
                            </span>
                            <button
                              onClick={() =>
                                copy(
                                  "a-all",
                                  `Tipo: A\nHost: ${aHost}\nValor: ${aValue}\nTTL: 3600`
                                )
                              }
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                            >
                              {copiedField === "a-all" ? (
                                <>
                                  <Check className="w-3.5 h-3.5" /> Copiado
                                </>
                              ) : (
                                <>
                                  <span>Copiar tudo</span>
                                  <Copy className="w-3.5 h-3.5" />
                                </>
                              )}
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-1.5">
                              <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-tighter">
                                Host / Nome
                              </p>
                              <div className="flex items-center gap-2">
                                <p className="font-mono text-sm text-primary">{aHost}</p>
                                <button
                                  onClick={() => copy("a-host", aHost)}
                                  className="p-1 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  {copiedField === "a-host" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-tighter">
                                Valor / Destino
                              </p>
                              <div className="flex items-center gap-2">
                                <p className="font-mono text-sm text-foreground/90 truncate">{aValue}</p>
                                <button
                                  onClick={() => copy("a-value", aValue)}
                                  className="p-1 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                >
                                  {copiedField === "a-value" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* TXT */}
                        <div className="bg-card/30 border border-border/30 rounded-xl p-5 hover:border-border/50 transition-colors">
                          <div className="flex items-center justify-between mb-4">
                            <span className="px-2 py-1 rounded bg-sky-500/10 text-sky-400 text-[10px] font-bold tracking-widest uppercase border border-sky-500/20">
                              TXT
                            </span>
                            <button
                              onClick={() =>
                                copy(
                                  "txt-all",
                                  `Tipo: TXT\nHost: ${txtHost}\nValor: ${txtValue}\nTTL: 3600`
                                )
                              }
                              disabled={!txtValue}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                            >
                              {copiedField === "txt-all" ? (
                                <>
                                  <Check className="w-3.5 h-3.5" /> Copiado
                                </>
                              ) : (
                                <>
                                  <span>Copiar tudo</span>
                                  <Copy className="w-3.5 h-3.5" />
                                </>
                              )}
                            </button>
                          </div>
                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-tighter">
                                Host / Nome
                              </p>
                              <div className="flex items-center gap-2">
                                <p className="font-mono text-sm text-foreground/90">{txtHost}</p>
                                <button
                                  onClick={() => copy("txt-host", txtHost)}
                                  className="p-1 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  {copiedField === "txt-host" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <p className="text-[10px] uppercase text-muted-foreground font-bold tracking-tighter">
                                Valor
                              </p>
                              {txtValue ? (
                                <div className="flex items-center gap-2">
                                  <p className="font-mono text-xs text-foreground/90 truncate">{txtValue}</p>
                                  <button
                                    onClick={() => copy("txt-value", txtValue)}
                                    className="p-1 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                  >
                                    {copiedField === "txt-value" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              ) : (
                                <p className="text-xs text-amber-300/80 leading-relaxed">
                                  ⏳ Aguardando token de verificação da nossa equipe. Assim que você preencher o campo de domínio acima e salvar, o suporte FBFlix vai iniciar a conexão e liberar o valor deste TXT em até 24h.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Checklist */}
                    <div className="relative pt-2">
                      <div className="absolute left-4 top-8 bottom-0 w-px bg-border/40" />
                      <div className="space-y-6">
                        {[
                          "Acesse o painel do seu registrador (Cloudflare, GoDaddy, Registro.br, Hostgator) e crie os registros acima.",
                          "Aguarde a propagação DNS, que costuma levar entre 5 minutos e 24 horas.",
                          "Preencha o campo de domínio acima e salve as alterações para iniciar a validação.",
                          "Nossa equipe validará e emitirá o certificado SSL automaticamente após a propagação.",
                        ].map((text, i) => (
                          <div key={i} className="flex gap-6 relative">
                            <div className="w-8 h-8 rounded-full bg-card border border-border/50 flex items-center justify-center text-xs font-bold shrink-0 z-10 text-foreground/80">
                              {i + 1}
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed pt-1">{text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-6 md:px-8 py-6 bg-card/30 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-[11px] text-muted-foreground text-center sm:text-left">
                      Link temporário:{" "}
                      <a
                        href={`${window.location.origin}/revenda/${reseller.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-foreground/70 hover:text-foreground underline underline-offset-4 decoration-border transition-colors font-mono"
                      >
                        {window.location.host}/revenda/{reseller.slug}
                      </a>
                    </p>
                    <Button
                      onClick={saveBranding}
                      disabled={savingBrand}
                      className="px-8 py-3 font-bold rounded-xl shadow-lg shadow-primary/20 font-display gap-2"
                    >
                      {savingBrand && <Loader2 className="size-4 animate-spin" />}
                      Salvar alterações
                    </Button>
                    <Button
                      onClick={verifyDomain}
                      disabled={verifyingDomain || !reseller.custom_domain}
                      variant="outline"
                      className="px-6 py-3 font-bold rounded-xl gap-2"
                    >
                      {verifyingDomain ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                      Verificar DNS agora
                    </Button>
                  </div>
                </div>
              );
            })()}

            {activeSection === "link" && (
          <Card className="p-5 bg-card/60 border-border/40 space-y-3">
            <h3 className="font-bold flex items-center gap-2">
              <Users className="size-4 text-primary" /> Seu link de revenda
            </h3>
            <p className="text-sm text-muted-foreground">
              Compartilhe este link. Todo cliente que comprar por ele será vinculado a você.
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={`${window.location.origin}/revenda/${reseller.slug}`}
                className="font-mono"
              />
              <Button variant="outline" onClick={copyLink} className="gap-2 shrink-0">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
            {reseller.custom_domain && (
              <div className="text-xs text-muted-foreground">
                Domínio próprio:{" "}
                <span className="font-mono text-foreground">{reseller.custom_domain}</span>{" "}
                <Badge variant="outline" className="ml-1">
                  {reseller.domain_status || "pending"}
                </Badge>
              </div>
            )}
          </Card>
            )}

            {activeSection === "ajuda" && (
              <Card className="p-5 bg-card/60 border-border/40 space-y-3">
                <div className="flex items-center gap-2">
                  <LifeBuoy className="size-4 text-primary" />
                  <h3 className="font-bold">Como funciona o programa</h3>
                </div>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>
                    Seu modelo atual é{" "}
                    <strong className="text-foreground">
                      {reseller.model === "percentage" ? "Comissão por %" : "Créditos pré-pagos"}
                    </strong>
                    .
                  </p>
                  {reseller.model === "percentage" ? (
                    <>
                      <p>• Comissões ficam pendentes por 7 dias antes de creditar.</p>
                      <p>• Mantenha {reseller.min_proxies_per_month} proxies ativos/mês.</p>
                      <p>• Sem recarga, sem custo fixo.</p>
                    </>
                  ) : (
                    <>
                      <p>• Compre proxies por R$ {Number(reseller.proxy_unit_cost).toFixed(2)}.</p>
                      <p>• Recarga mínima: R$ {Number(reseller.min_monthly_recharge).toFixed(2)}/mês.</p>
                      <p>• Revenda pelo preço que quiser.</p>
                    </>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <Card className="p-4 bg-card/40 border-border/50 shadow-none backdrop-blur-sm">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        {icon} {label}
      </div>
      <p className={`text-lg font-bold mt-1 ${accent || ""}`}>{value}</p>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "border-yellow-500/40 text-yellow-400 bg-yellow-500/10",
    credited: "border-green-500/40 text-green-400 bg-green-500/10",
    cancelled: "border-primary/40 text-primary bg-primary/10",
    refunded: "border-primary/40 text-primary bg-primary/10",
  };
  return (
    <Badge variant="outline" className={map[status] || ""}>
      {status}
    </Badge>
  );
}