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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { ResellerLoja } from "@/components/revenda/ResellerLoja";

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
  openpix_pix_key: string | null;
  openpix_pix_key_type: string | null;
  total_gmv: number;
  total_commissions_earned: number;
  total_referrals: number;
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
  const [activeSection, setActiveSection] = useState<
    "overview" | "loja" | "vendas" | "link" | "ajuda" | "dominio" | "identidade"
  >("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
        const [{ data: c }, { data: l }] = await Promise.all([
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
        ]);
        setCommissions((c as Commission[]) || []);
        setLedger((l as LedgerEntry[]) || []);
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
    { id: "overview", label: "Dashboard", icon: LayoutDashboard },
    { id: "loja", label: "Loja de Proxies", icon: Store },
    { id: "vendas", label: reseller.model === "percentage" ? "Comissões" : "Extrato", icon: Receipt },
    { id: "link", label: "Link de Revenda", icon: Globe },
    { id: "ajuda", label: "Como Funciona", icon: LifeBuoy },
    {
      id: "configuracoes",
      label: "Configurações",
      icon: Settings,
      children: [
        { id: "dominio", label: "Domínio Próprio", icon: Globe },
        { id: "identidade", label: "Identidade Visual", icon: Palette },
      ],
    },
  ] as const;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="fixed inset-0 flex w-full font-display overflow-hidden bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
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
          "fixed lg:relative z-50 lg:z-10 h-full w-64 shrink-0 flex flex-col bg-[hsl(var(--card))]/40 backdrop-blur-2xl transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
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
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Reseller Panel</p>
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
          <div className="px-3 py-2.5 rounded-xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Sparkles className="size-3 text-primary" />
              <p className="text-[10px] text-primary/80 uppercase tracking-widest font-bold">Seu modelo</p>
            </div>
            <p className="text-xs font-bold text-foreground">
              {reseller.model === "percentage"
                ? `${reseller.commission_rate}% comissão`
                : `R$ ${reseller.proxy_unit_cost}/proxy`}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            <LogOut className="size-4" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="relative z-10 flex-1 flex flex-col h-full overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-3 px-4 lg:px-8 h-16 bg-background/60 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-muted/50 text-muted-foreground"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="size-5" />
            </button>
            <div>
              <h1 className="text-base lg:text-lg font-bold text-foreground tracking-tight">
                {navItems.find((n) => n.id === activeSection)?.label}
              </h1>
              <p className="text-[11px] text-muted-foreground">Painel de Revenda White-Label</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                reseller.status === "active"
                  ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10 gap-1.5"
                  : reseller.status === "warning"
                  ? "border-yellow-500/40 text-yellow-400 bg-yellow-500/10 gap-1.5"
                  : "border-red-500/40 text-red-400 bg-red-500/10 gap-1.5"
              }
            >
              <span className={cn(
                "size-1.5 rounded-full animate-pulse",
                reseller.status === "active" && "bg-emerald-400",
                reseller.status === "warning" && "bg-yellow-400",
                reseller.status !== "active" && reseller.status !== "warning" && "bg-red-400"
              )} />
              {reseller.status === "active" ? "Ativo" : reseller.status === "warning" ? "Atenção" : reseller.status}
            </Badge>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 lg:py-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {suspended && (
              <Card className="p-4 border-red-500/40 bg-red-500/5 backdrop-blur flex items-start gap-3">
                <AlertTriangle className="size-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-300">Painel suspenso</p>
                  <p className="text-xs text-red-300/80">
                    Seu painel está inativo. Regularize a recarga mínima ou entre em contato com o
                    suporte para reativação.
                  </p>
                </div>
              </Card>
            )}

            {activeSection === "overview" && (
              <div className="space-y-8 animate-fade-in">
                {/* Banner acima */}
                <ResellerLoja
                  resellerId={reseller.id}
                  primaryColor={reseller.primary_color}
                  bannerOnly
                />

                {/* Greeting */}
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                    Bem-vindo, <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">{reseller.brand_name || reseller.company_name}</span>
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">Visão geral do seu painel de revenda</p>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<TrendingUp className="size-4" />}
          label="GMV Total"
          value={`R$ ${Number(reseller.total_gmv).toFixed(2)}`}
        />
        <StatCard
          icon={<ShoppingBag className="size-4" />}
          label="Vendas"
          value={String(reseller.total_referrals)}
        />
        {reseller.model === "percentage" ? (
          <>
            <StatCard
              icon={<Wallet className="size-4" />}
              label="A liberar (7d)"
              value={`R$ ${stats.pending.toFixed(2)}`}
              accent="text-yellow-400"
            />
            <StatCard
              icon={<Percent className="size-4" />}
              label="Comissões creditadas"
              value={`R$ ${Number(reseller.total_commissions_earned).toFixed(2)}`}
              accent="text-primary"
            />
          </>
        ) : (
          <>
            <StatCard
              icon={<Coins className="size-4" />}
              label="Saldo créditos"
              value={`R$ ${Number(reseller.balance_credits).toFixed(2)}`}
              accent="text-primary"
            />
            <StatCard
              icon={<Wallet className="size-4" />}
              label="Recarga mín/mês"
              value={`R$ ${Number(reseller.min_monthly_recharge).toFixed(0)}`}
            />
          </>
        )}
                </div>

                {/* Catálogo abaixo */}
                <ResellerLoja
                  resellerId={reseller.id}
                  primaryColor={reseller.primary_color}
                  catalogOnly
                />
              </div>
            )}

            {activeSection === "loja" && (
              <ResellerLoja
                resellerId={reseller.id}
                primaryColor={reseller.primary_color}
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
                                      positive ? "text-green-400" : "text-red-400"
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

            {activeSection === "branding" && (
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
                <Label>Logo (URL)</Label>
                <Input
                  value={brand.logo_url}
                  onChange={(e) => setBrand({ ...brand, logo_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label>Favicon (URL)</Label>
                <Input
                  value={brand.favicon_url}
                  onChange={(e) => setBrand({ ...brand, favicon_url: e.target.value })}
                  placeholder="https://..."
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
              <div className="md:col-span-2">
                <Label className="flex items-center gap-1">
                  <Globe className="size-3" /> Domínio próprio (CNAME)
                </Label>
                <Input
                  value={brand.custom_domain}
                  onChange={(e) => setBrand({ ...brand, custom_domain: e.target.value })}
                  placeholder="painel.suamarca.com.br"
                />
                <div className="mt-3 rounded-lg border border-border/50 bg-muted/30 p-3 space-y-2 text-[12px]">
                  <p className="font-semibold text-foreground flex items-center gap-1">
                    <Globe className="size-3" /> Como configurar seu domínio
                  </p>
                  <p className="text-muted-foreground">
                    Acesse o painel do seu registrador (Registro.br, GoDaddy, Cloudflare, Hostgator…)
                    e crie os registros DNS abaixo para o domínio informado acima:
                  </p>
                  <div className="rounded-md bg-background/60 border border-border/40 p-2 font-mono text-[11px] leading-relaxed">
                    <div><span className="text-muted-foreground">Tipo:</span> CNAME</div>
                    <div><span className="text-muted-foreground">Nome/Host:</span> painel <span className="text-muted-foreground">(ou o subdomínio que quiser)</span></div>
                    <div><span className="text-muted-foreground">Valor/Destino:</span> cname.fbflix.com.br</div>
                    <div><span className="text-muted-foreground">TTL:</span> 3600</div>
                  </div>
                  <div className="rounded-md bg-background/60 border border-border/40 p-2 font-mono text-[11px] leading-relaxed">
                    <div><span className="text-muted-foreground">Tipo:</span> TXT</div>
                    <div><span className="text-muted-foreground">Nome/Host:</span> _fbflix-verify</div>
                    <div><span className="text-muted-foreground">Valor:</span> fbflix-reseller={reseller.id.slice(0, 24)}</div>
                    <div><span className="text-muted-foreground">TTL:</span> 3600</div>
                  </div>
                  <ol className="list-decimal list-inside text-muted-foreground space-y-1 pl-1">
                    <li>Salve os registros no seu registrador.</li>
                    <li>Aguarde a propagação DNS (pode levar de 5 min a 24h).</li>
                    <li>Preencha o domínio no campo acima e clique em <strong>Salvar alterações</strong>.</li>
                    <li>Nossa equipe valida e emite o certificado SSL automaticamente. Você verá o status mudar para <Badge variant="outline" className="ml-0.5 py-0 px-1 text-[10px]">verified</Badge>.</li>
                  </ol>
                  <p className="text-muted-foreground">
                    Enquanto o domínio não é verificado, seu painel continua funcionando normalmente em{" "}
                    <code className="text-foreground">{window.location.origin}/revenda/{reseller.slug}</code>.
                  </p>
                  {reseller.custom_domain && (
                    <p className="pt-1 border-t border-border/40">
                      Status atual:{" "}
                      <Badge variant="outline" className="ml-1">
                        {reseller.domain_status || "pending"}
                      </Badge>
                    </p>
                  )}
                </div>
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
    <Card className="p-4 bg-white/[0.02] border-white/5 shadow-none backdrop-blur-sm">
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
    cancelled: "border-red-500/40 text-red-400 bg-red-500/10",
    refunded: "border-red-500/40 text-red-400 bg-red-500/10",
  };
  return (
    <Badge variant="outline" className={map[status] || ""}>
      {status}
    </Badge>
  );
}