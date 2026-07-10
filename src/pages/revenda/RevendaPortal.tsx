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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

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
    "overview" | "vendas" | "branding" | "link" | "ajuda"
  >("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    { id: "vendas", label: reseller.model === "percentage" ? "Comissões" : "Extrato", icon: Receipt },
    { id: "branding", label: "Identidade Visual", icon: Palette },
    { id: "link", label: "Link de Revenda", icon: Globe },
    { id: "ajuda", label: "Como Funciona", icon: LifeBuoy },
  ] as const;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="flex h-screen w-full relative font-display overflow-hidden bg-[#0a0505] text-white selection:bg-primary selection:text-white">
      {/* Background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-900/10 rounded-full blur-[100px]" />
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
          "fixed lg:relative z-50 lg:z-10 h-full w-64 shrink-0 flex flex-col bg-black/40 backdrop-blur-xl border-r border-white/5 transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            {reseller.logo_url ? (
              <img
                src={reseller.logo_url}
                alt={reseller.company_name}
                className="size-9 rounded-lg object-cover"
              />
            ) : (
              <div
                className="size-9 rounded-lg flex items-center justify-center font-bold text-white text-sm"
                style={{ background: reseller.primary_color || "#22c55e" }}
              >
                {reseller.company_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {reseller.brand_name || reseller.company_name}
              </p>
              <p className="text-[10px] text-white/50 uppercase tracking-wider">Revenda</p>
            </div>
          </div>
          <button
            className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 text-white/60"
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
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  isActive
                    ? "bg-gradient-to-r from-primary to-red-900 text-white shadow-lg shadow-primary/20"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-white/5 space-y-2">
          <div className="px-3 py-2 rounded-lg bg-white/5">
            <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Modelo</p>
            <p className="text-xs font-bold text-white">
              {reseller.model === "percentage"
                ? `${reseller.commission_rate}% comissão`
                : `R$ ${reseller.proxy_unit_cost}/proxy`}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/5 hover:text-white transition-colors"
          >
            <LogOut className="size-4" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="relative z-10 flex-1 flex flex-col h-full overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-3 px-4 lg:px-8 h-16 border-b border-white/5 bg-black/20 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-white/10 text-white/60"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="size-5" />
            </button>
            <div>
              <h1 className="text-base lg:text-lg font-bold text-white">
                {navItems.find((n) => n.id === activeSection)?.label}
              </h1>
              <p className="text-[11px] text-white/50">Painel de Revenda White-Label</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                reseller.status === "active"
                  ? "border-green-500/40 text-green-400 bg-green-500/10"
                  : reseller.status === "warning"
                  ? "border-yellow-500/40 text-yellow-400 bg-yellow-500/10"
                  : "border-red-500/40 text-red-400 bg-red-500/10"
              }
            >
              {reseller.status}
            </Badge>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {suspended && (
              <Card className="p-4 border-red-500/40 bg-red-500/10 flex items-start gap-3">
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
              <div className="space-y-6">
        <div className="flex items-center gap-3">
          {reseller.logo_url ? (
            <img
              src={reseller.logo_url}
              alt={reseller.company_name}
              className="size-12 rounded-xl object-cover border border-border/40"
            />
          ) : (
            <div
              className="size-12 rounded-xl flex items-center justify-center font-bold text-white"
              style={{ background: reseller.primary_color || "#22c55e" }}
            >
              {reseller.company_name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold">{reseller.brand_name || reseller.company_name}</h1>
            <p className="text-xs text-muted-foreground">Painel de Revenda White-Label</p>
          </div>
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

          <Card className="p-5 bg-card/60 border-border/40 space-y-3">
            <h3 className="font-bold">Como funciona</h3>
            {reseller.model === "percentage" ? (
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Você recebe <strong className="text-foreground">{reseller.commission_rate}% líquidos</strong>{" "}
                  de cada venda gerada pelo seu link, sem custos e sem recarga de painel.
                </p>
                <p>
                  Comissões ficam <strong>pendentes por 7 dias</strong> (garantia) e depois são
                  creditadas automaticamente.
                </p>
                <p>
                  Para manter o painel ativo, mantenha pelo menos{" "}
                  <strong className="text-foreground">
                    {reseller.min_proxies_per_month} proxies ativos por mês
                  </strong>
                  .
                </p>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Você compra proxies por{" "}
                  <strong className="text-foreground">
                    R$ {Number(reseller.proxy_unit_cost).toFixed(2)}
                  </strong>{" "}
                  cada, independente do modelo, e revende pelo preço que quiser.
                </p>
                <p>
                  Recarga mínima mensal:{" "}
                  <strong className="text-foreground">
                    R$ {Number(reseller.min_monthly_recharge).toFixed(2)}
                  </strong>
                  . Funciona como créditos: você recarrega conforme a demanda.
                </p>
              </div>
            )}
          </Card>
              </div>
            )}

            {activeSection === "vendas" && (
              <>
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
              </>
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
                <p className="text-[11px] text-muted-foreground mt-1">
                  Configure um CNAME apontando para <code>fbflix.com.br</code>. Após validação pelo
                  admin, seu painel ficará disponível no seu domínio.
                </p>
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
    <Card className="p-4 bg-card/60 border-border/40">
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