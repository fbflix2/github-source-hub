import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProxyBRSubscriptions, useExchangeProxy, useRenewSubscription, useToggleAutoRenew, getExchangeHistory } from "@/hooks/useProxyBR";
import { useWebshareSubscriptions, useExchangeWebshareProxy, getWebshareExchangeHistory } from "@/hooks/useWebshare";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { differenceInDays, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ProxySubscription } from "@/pages/Subscriptions";

function getStatusInfo(sub: ProxySubscription) {
  if (!sub.end_date) return { status: "active" as const, label: "Ativo", color: "green" };
  const now = new Date();
  const endDate = parseISO(sub.end_date);
  const daysLeft = differenceInDays(endDate, now);
  if (sub.status === "cancelled") return { status: "cancelled" as const, label: "Cancelado", color: "gray" };
  if (daysLeft < 0) return { status: "expired" as const, label: "Expirado", color: "gray" };
  if (daysLeft <= 3) return { status: "expiring" as const, label: "Vencendo", color: "red" };
  return { status: "active" as const, label: "Ativo", color: "green" };
}

export default function SubscriptionManage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { data: subscriptions, isLoading } = useProxyBRSubscriptions();
  const { data: webshareRaw, isLoading: wsLoading } = useWebshareSubscriptions();
  const exchangeMutation = useExchangeProxy();
  const wsExchangeMutation = useExchangeWebshareProxy();
  const renewMutation = useRenewSubscription();
  const autoRenewMutation = useToggleAutoRenew();
  const queryClient = useQueryClient();
  const [showExchangeHistory, setShowExchangeHistory] = useState(false);

  // Extract the real subscription name (strip __proxy_XXX suffix for multi-proxy codes)
  const realSubName = code?.includes("__proxy_") ? code.split("__proxy_")[0] : code;

  // Search in both ProxyBR and Webshare subscriptions
  const proxyBRSub = (subscriptions as ProxySubscription[] | undefined)?.find((s) => s.code === code);
  const webshareSub = (Array.isArray(webshareRaw) ? webshareRaw : [])?.find((s: any) => s.code === code);
  const sub = (proxyBRSub || webshareSub) as ProxySubscription | undefined;
  const isWebshare = !!webshareSub && !proxyBRSub;
  const combinedLoading = isLoading || wsLoading;

  // Fetch the price: first try order_items, then fallback to product catalog price
  const { data: customerPrice } = useQuery({
    queryKey: ["subscription-customer-price", code, sub?.totalProxies, sub?.product_name],
    queryFn: async () => {
      if (!realSubName) return null;

      // For Webshare subs, use the price from the join
      if ((sub as any)?.customer_price != null) {
        return Number((sub as any).customer_price);
      }

      const totalProxies = sub?.totalProxies ?? 1;

      // Try order_items first
      const { data: orderItem } = await supabase
        .from("order_items")
        .select("price")
        .contains("delivery_data", { subscription_code: realSubName })
        .limit(1)
        .maybeSingle();
      if (orderItem?.price != null) {
        return Number(orderItem.price);
      }

      // Fallback: find product by external_id (API product id) or name match
      const raw = (sub?.raw_data || {}) as Record<string, any>;
      const apiProductId = raw?.product?.id;
      if (apiProductId) {
        const { data: product } = await supabase
          .from("products")
          .select("price")
          .eq("external_id", String(apiProductId))
          .maybeSingle();
        if (product?.price != null) return Number(product.price);
      }

      return null;
    },
    enabled: !!code && !combinedLoading && !!sub,
  });

  const [profileName, setProfileName] = useState("");
  const [savedProfile, setSavedProfile] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Load profile_tag from subscription data
  useEffect(() => {
    if (sub && !profileLoaded) {
      setSavedProfile(sub.profile_tag || null);
      setProfileLoaded(true);
    }
  }, [sub, profileLoaded]);

  if (combinedLoading) {
    return (
      <div className="space-y-6 animate-fade-in py-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full rounded-2xl" />
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
        <span className="material-symbols-outlined text-[48px] text-text-secondary mb-4">search_off</span>
        <p className="text-foreground font-bold text-lg">Assinatura não encontrada</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/subscriptions")}>
          Voltar
        </Button>
      </div>
    );
  }

  const { status, label, color } = getStatusInfo(sub);
  const endDate = sub.end_date ? parseISO(sub.end_date) : new Date();
  const startDate = sub.start_date ? parseISO(sub.start_date) : new Date();
  const daysLeft = Math.max(0, differenceInDays(endDate, new Date()));
  const totalDays = differenceInDays(endDate, startDate);
  const elapsed = totalDays - daysLeft;
  const progress = totalDays > 0 ? Math.min(100, Math.max(0, (elapsed / totalDays) * 100)) : 0;


  // Determine the tag key: for multi-proxy subs use per-proxy key, otherwise use profile_tag
  const proxyIdFromCode = code?.includes("__proxy_") ? code.split("__proxy_")[1] : null;
  const tagKey = proxyIdFromCode ? `profile_tag_${proxyIdFromCode}` : "profile_tag";

  const handleSaveProfile = async () => {
    const trimmed = profileName.trim();
    setSavedProfile(trimmed || null);
    setIsEditingProfile(false);

    // Persist to DB in raw_data
    if (code) {
      const subType = isWebshare ? "webshare" : "proxybr";
      const { data: subRow } = await supabase
        .from("subscriptions")
        .select("id, raw_data")
        .eq("name", realSubName!)
        .eq("type", subType)
        .maybeSingle();

      if (subRow) {
        const updatedRaw = { ...((subRow.raw_data as Record<string, unknown>) || {}), [tagKey]: trimmed || null };
        await supabase.from("subscriptions").update({ raw_data: updatedRaw }).eq("id", subRow.id);
        queryClient.invalidateQueries({ queryKey: isWebshare ? ["webshare-subscriptions"] : ["proxybr-subscriptions"] });
      }
    }

    toast.success(trimmed ? "Perfil salvo!" : "Perfil removido!");
  };

  const handleRemoveProfile = async () => {
    setSavedProfile(null);
    setProfileName("");

    if (code) {
      const subType = isWebshare ? "webshare" : "proxybr";
      const { data: subRow } = await supabase
        .from("subscriptions")
        .select("id, raw_data")
        .eq("name", realSubName!)
        .eq("type", subType)
        .maybeSingle();

      if (subRow) {
        const updatedRaw = { ...((subRow.raw_data as Record<string, unknown>) || {}), [tagKey]: null };
        await supabase.from("subscriptions").update({ raw_data: updatedRaw }).eq("id", subRow.id);
        queryClient.invalidateQueries({ queryKey: isWebshare ? ["webshare-subscriptions"] : ["proxybr-subscriptions"] });
      }
    }

    toast.success("Perfil removido!");
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copiado!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const statusBadge = {
    active: "bg-green-500/10 text-green-500 border-green-500/20",
    expiring: "bg-danger/10 text-danger border-danger/20",
    expired: "bg-muted text-text-secondary border-border",
    cancelled: "bg-muted text-text-secondary border-border",
  }[status];

  return (
    <div className="space-y-3 animate-fade-in pb-4">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/subscriptions")}
          className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center text-text-secondary hover:text-foreground hover:border-foreground transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        </button>
        <div className="flex-1 flex items-center gap-3 flex-wrap">
          <h1 className="text-lg font-black text-foreground tracking-tight">{sub.name || sub.code}</h1>
          {sub.proxyLabel && (
            <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-md border bg-primary/10 text-primary border-primary/20">
              {sub.proxyLabel}
            </span>
          )}
          <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-md border ${statusBadge}`}>
            {label}
          </span>
          {sub.product_name && (
            <span className="text-text-secondary text-xs flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">dns</span>
              {sub.product_name}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-3">
          {/* Period */}
          <div className="glass-card rounded-xl p-4 space-y-3">
            <h2 className="text-foreground font-bold text-sm flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-base">schedule</span>
              Período da Assinatura
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Início", value: format(startDate, "dd MMM yyyy", { locale: ptBR }) },
                { label: "Vencimento", value: format(endDate, "dd MMM yyyy", { locale: ptBR }) },
                { label: "Dias Restantes", value: String(daysLeft), highlight: true },
                { label: "Valor Pago", value: customerPrice != null ? `R$ ${Number(customerPrice).toFixed(2).replace('.', ',')}` : "—" },
              ].map((item) => (
                <div key={item.label} className="bg-muted/50 rounded-lg p-2.5 border border-border">
                  <p className="text-text-secondary text-[10px] uppercase tracking-wider font-semibold">{item.label}</p>
                  <p className={`font-bold text-sm mt-0.5 ${item.highlight ? (status === "expiring" ? "text-danger" : "text-green-500") : "text-foreground"}`}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${status === "expiring" ? "bg-danger" : "bg-green-500"}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            {!isWebshare && (status === "expiring" || status === "expired") && (
              <Button size="sm" onClick={() => renewMutation.mutate(sub.name)} disabled={renewMutation.isPending} className="bg-primary hover:bg-primary/80 text-primary-foreground font-bold text-xs">
                <span className="material-symbols-outlined mr-1 text-sm">replay</span>
                {renewMutation.isPending ? "Renovando..." : "Renovar"}
              </Button>
            )}
          </div>

          {/* Proxy Details */}
          {sub.proxy && (
            <div className="glass-card rounded-xl p-4 space-y-3">
              <h2 className="text-foreground font-bold text-sm flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-base">vpn_key</span>
                Dados do Proxy
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { label: "Endereço IP", value: sub.proxy.ip, key: "ip" },
                  { label: "Porta", value: String(sub.proxy.port), key: "port" },
                  { label: "Usuário", value: sub.proxy.username || "—", key: "user" },
                  { label: "Senha", value: sub.proxy.password || "—", key: "pass" },
                  { label: "Protocolo", value: sub.proxy.protocol || "SOCKS5", key: "proto" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border group">
                    <div className="min-w-0">
                      <p className="text-text-secondary text-[9px] uppercase tracking-wider font-semibold">{item.label}</p>
                      <p className="text-foreground font-mono font-medium text-xs mt-0.5 truncate">{item.value}</p>
                    </div>
                    {item.value !== "—" && (
                      <button onClick={() => copyToClipboard(item.value, item.key)} className="opacity-0 group-hover:opacity-100 transition-opacity text-text-secondary hover:text-foreground ml-1 shrink-0">
                        <span className="material-symbols-outlined text-sm">{copiedField === item.key ? "check" : "content_copy"}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Perfil Vinculado */}
          <div className="glass-card rounded-xl p-4 space-y-3">
            <h2 className="text-foreground font-bold text-sm flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-base">person_pin</span>
              Perfil Vinculado
            </h2>
            {savedProfile ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/10 backdrop-blur-sm border border-foreground/20 text-foreground text-xs font-semibold">
                  <span className="material-symbols-outlined text-sm text-primary">verified</span>
                  {savedProfile}
                  <button
                    onClick={handleRemoveProfile}
                    className="ml-0.5 text-text-secondary hover:text-foreground transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </span>
                <button
                  onClick={() => { setProfileName(savedProfile); setIsEditingProfile(true); }}
                  className="text-text-secondary hover:text-foreground transition-colors"
                  title="Editar"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
              <Input
                  placeholder="Ex: Perfil 01 ou BM-1234"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveProfile()}
                  className="bg-muted border-border text-foreground h-7 text-xs max-w-[200px]"
                  autoFocus={isEditingProfile}
                />
                <Button size="sm" onClick={handleSaveProfile} disabled={!profileName.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shrink-0 text-xs h-7 px-3">
                  Adicionar
                </Button>
              </div>
            )}
            {!savedProfile && !isEditingProfile && (
              <p className="text-text-secondary text-[10px]">Opcional — informe em qual perfil este proxy está sendo usado.</p>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-3">
          {/* Info */}
          <div className="glass-card rounded-xl p-4 space-y-2">
            <h2 className="text-foreground font-bold text-sm flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-base">info</span>
              Informações
            </h2>
            <div className="space-y-1.5">
              {[
                { label: "Código", value: sub.code, mono: true },
                { label: "Status", value: label, className: status === "active" ? "text-green-500 font-bold" : status === "expiring" ? "text-danger font-bold" : "text-text-secondary" },
                ...(sub.product_name ? [{ label: "Produto", value: sub.product_name }] : []),
                ...(sub.proxy?.protocol ? [{ label: "Protocolo", value: sub.proxy.protocol }] : []),
              ].map((item) => (
                <div key={item.label} className="flex justify-between text-xs">
                  <span className="text-text-secondary">{item.label}</span>
                  <span className={`${'mono' in item && item.mono ? 'font-mono' : ''} ${'className' in item ? item.className : 'text-foreground font-medium'} text-right max-w-[160px]`}>{item.value}</span>
                </div>
              ))}
            </div>
            {!isWebshare && (
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-sm">autorenew</span>
                  <span className="text-xs text-text-secondary">Renovação automática</span>
                </div>
                <Switch
                  checked={!!sub.auto_renew}
                  disabled={autoRenewMutation.isPending}
                  onCheckedChange={(checked) =>
                    autoRenewMutation.mutate({ subscriptionCode: sub.name, auto_renew: checked })
                  }
                />
              </div>
            )}
          </div>

          {/* Exchange */}
          <div className="glass-card rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-foreground font-bold text-sm flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-base">swap_horiz</span>
                Trocar Proxy
              </h2>
              {(() => {
                const history = isWebshare
                  ? getWebshareExchangeHistory((sub as any).id || sub.code)
                  : getExchangeHistory(sub.name);
                if (history.length === 0) return null;
                return (
                  <button
                    onClick={() => setShowExchangeHistory(true)}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    title="Histórico de trocas"
                  >
                    <span className="material-symbols-outlined text-sm">history</span>
                    {history.length}
                  </button>
                );
              })()}
            </div>
            {(() => {
              const raw = (sub.raw_data || {}) as Record<string, any>;
              // Support both flat and nested (subscription.) structures
              const freeExchanges = raw.exchange_quota_free ?? raw.subscription?.exchange_quota_free ?? 0;
              const paidExchanges = raw.exchange_quota_pay ?? raw.subscription?.exchange_quota_pay ?? 0;
              const activeMutation = isWebshare ? wsExchangeMutation : exchangeMutation;
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">Trocas grátis</span>
                    <span className={`font-bold ${freeExchanges > 0 ? 'text-green-500' : 'text-text-secondary'}`}>{freeExchanges}</span>
                  </div>
                  {freeExchanges > 0 && (
                    <Button
                      size="sm"
                      onClick={() => {
                        const oldProxyString = sub.proxy ? `${sub.proxy.ip}:${sub.proxy.port}:${sub.proxy.username || ""}:${sub.proxy.password || ""}` : undefined;
                        if (isWebshare) {
                          // Get the subscription DB id from raw_data or find by name
                          const subId = (sub as any).id || sub.code;
                          wsExchangeMutation.mutate({ subscriptionId: subId, oldProxyString });
                        } else {
                          exchangeMutation.mutate({
                            subscriptionCode: sub.name,
                            proxy_id: sub.proxy?.id,
                            oldProxyString,
                          });
                        }
                      }}
                      disabled={activeMutation.isPending}
                      className="w-full bg-primary hover:bg-primary/80 text-primary-foreground font-bold text-xs h-8"
                    >
                      <span className="material-symbols-outlined text-sm mr-1">swap_horiz</span>
                      {activeMutation.isPending ? "Trocando..." : "Trocar Proxy (Grátis)"}
                    </Button>
                  )}
                  {freeExchanges === 0 && (
                    <p className="text-text-secondary text-[10px]">Nenhuma troca grátis disponível.</p>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Quick Actions */}
          <div className="glass-card rounded-xl p-4 space-y-1.5">
            <h2 className="text-foreground font-bold text-sm flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-base">bolt</span>
              Ações Rápidas
            </h2>
            {sub.proxy && (
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs h-8" onClick={() => copyToClipboard(`${sub.proxy!.ip}:${sub.proxy!.port}:${sub.proxy!.username || ""}:${sub.proxy!.password || ""}`, "quick-conn")}>
                <span className="material-symbols-outlined text-sm">content_copy</span>Copiar String de Conexão
              </Button>
            )}
            <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs h-8" onClick={() => navigate("/suporte")}>
              <span className="material-symbols-outlined text-sm">support_agent</span>Abrir Suporte
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs h-8" onClick={() => navigate("/loja?filter=Proxy")}>
              <span className="material-symbols-outlined text-sm">shopping_cart</span>Contratar Mais Proxies
            </Button>
          </div>
        </div>
      </div>

      {/* Exchange History Dialog */}
      <Dialog open={showExchangeHistory} onOpenChange={setShowExchangeHistory}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <span className="material-symbols-outlined text-primary">history</span>
              Histórico de Trocas — {sub.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {(() => {
              const history = isWebshare
                ? getWebshareExchangeHistory((sub as any).id || sub.code)
                : getExchangeHistory(sub.name);
              return history.length === 0 ? (
                <p className="text-muted-foreground text-xs text-center py-4">Nenhuma troca registrada.</p>
              ) : (
                history.map((record, i) => (
                  <div key={i} className="glass-card rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        {format(parseISO(record.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full">Troca #{history.length - i}</span>
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <div className="bg-destructive/10 rounded p-2">
                        <p className="text-[9px] text-muted-foreground mb-0.5">ANTIGO</p>
                        <p className="text-[10px] text-foreground font-mono break-all">{record.oldProxy}</p>
                      </div>
                      <span className="material-symbols-outlined text-primary text-lg">arrow_forward</span>
                      <div className="bg-green-500/10 rounded p-2">
                        <p className="text-[9px] text-muted-foreground mb-0.5">NOVO</p>
                        <p className="text-[10px] text-foreground font-mono break-all">{record.newProxy}</p>
                      </div>
                    </div>
                  </div>
                ))
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
