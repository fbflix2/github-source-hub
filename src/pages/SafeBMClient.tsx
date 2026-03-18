import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Shield, ShieldCheck, ShieldAlert, Download, RefreshCw,
  Search, FileDown, AlertTriangle, CheckCircle, ArrowRight,
  Loader2, Lock
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Navigate } from "react-router-dom";

interface SafeBmVault {
  id: string;
  user_id: string;
  client_name: string | null;
  bm_name: string;
  bm_link: string;
  perfil_backup: string | null;
  purchase_date: string | null;
  protection_start: string;
  link_regenerations: number;
  status: string;
  subscription_price: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function SafeBMClient() {
  const [vaults, setVaults] = useState<SafeBmVault[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      const { data, error } = await supabase
        .from("safe_bm_vaults" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) toast.error("Erro ao carregar cofre: " + error.message);
      setVaults((data as any[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return vaults;
    const q = search.toLowerCase();
    return vaults.filter(v =>
      v.bm_name.toLowerCase().includes(q) ||
      (v.perfil_backup || "").toLowerCase().includes(q)
    );
  }, [vaults, search]);

  const activeVaults = vaults.filter(v => v.status === "active");
  const expiringVaults = vaults.filter(v => {
    if (v.status !== "active") return false;
    // Consider "expiring" if protection started > 25 days ago (simulating monthly cycle)
    const daysSinceProtection = differenceInDays(new Date(), new Date(v.protection_start));
    return daysSinceProtection > 25;
  });

  const exportCSV = () => {
    const rows = [["Nome BM", "Status", "Data Proteção", "Regenerações"]];
    vaults.forEach(v => {
      rows.push([
        v.bm_name,
        v.status === "active" ? "Protegido" : "Inativo",
        format(new Date(v.protection_start), "dd/MM/yyyy"),
        String(v.link_regenerations)
      ]);
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "minhas-bms-protegidas.csv"; a.click();
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-64 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    );
  }

  // If user has no Safe BM vaults, redirect to subscriptions
  if (!loading && vaults.length === 0) {
    return <Navigate to="/subscriptions" replace />;
  }

  return (
    <div className="space-y-8 animate-fade-in">

      {/* ───── HERO SECTION ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Hero Card */}
        <Card className="lg:col-span-2 bg-[hsl(var(--card))] border-border overflow-hidden">
          <CardContent className="p-8">
            <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] uppercase tracking-wider font-semibold mb-4">
              <span className="inline-block w-2 h-2 rounded-full bg-primary mr-1.5 animate-pulse" />
              Cofre Ativo
            </Badge>

            <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight mb-8">
              Segurança Total em{" "}
              <span className="text-primary">Tempo Real</span>
            </h1>

            <div className="flex items-center gap-8 mt-auto">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                  Ativos Protegidos
                </p>
                <p className="text-2xl font-bold text-foreground">{activeVaults.length}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                  Alertas Hoje
                </p>
                <p className="text-2xl font-bold text-primary">{String(expiringVaults.length).padStart(2, '0')}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                  Uptime Vault
                </p>
                <p className="text-2xl font-bold text-emerald-400">99.9%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alerts Card */}
        <Card className="bg-[hsl(var(--card))] border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">Alertas Críticos</h3>
              <ShieldAlert className="size-5 text-muted-foreground" />
            </div>

            <div className="space-y-3">
              {expiringVaults.length > 0 ? (
                expiringVaults.slice(0, 2).map(v => (
                  <div key={v.id} className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-0.5">
                      Renovação Próxima
                    </p>
                    <p className="text-sm text-foreground">
                      Sua BM "{v.bm_name}" precisa de atenção.
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {format(new Date(v.updated_at), "dd/MM, HH:mm")}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold mb-0.5">
                    Tudo em Ordem
                  </p>
                  <p className="text-sm text-foreground">
                    Todas as suas BMs estão protegidas e seguras.
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Agora
                  </p>
                </div>
              )}

              {vaults.some(v => v.link_regenerations > 0) && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold mb-0.5">
                    Backup Concluído
                  </p>
                  <p className="text-sm text-foreground">
                    Snapshot do cofre gerado com sucesso.
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {format(new Date(vaults.find(v => v.link_regenerations > 0)!.updated_at), "dd/MM, HH:mm")}
                  </p>
                </div>
              )}
            </div>

            <button className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors mt-4 py-1">
              Ver todo o histórico
            </button>
          </CardContent>
        </Card>
      </div>

      {/* ───── BMs PROTEGIDAS ───── */}
      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-xl font-bold text-foreground">BMs Protegidas</h2>
            <p className="text-xs text-muted-foreground">Gerencie suas Business Managers blindadas</p>
          </div>
          <div className="flex items-center gap-2">
            {vaults.length > 3 && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filtrar..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-9 w-40 text-sm"
                />
              </div>
            )}
            <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5" onClick={exportCSV}>
              <FileDown className="size-3.5" /> Exportar CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(v => {
            const isActive = v.status === "active";
            const daysSinceProtection = differenceInDays(new Date(), new Date(v.protection_start));
            const isExpiringSoon = isActive && daysSinceProtection > 25;
            const progressPercent = Math.min(100, (daysSinceProtection / 30) * 100);

            // Extract BM ID from link if possible
            const bmIdMatch = v.bm_link.match(/(\d{10,})/);
            const bmId = bmIdMatch ? bmIdMatch[1] : v.id.slice(0, 12);

            return (
              <Card key={v.id} className="bg-[hsl(var(--card))] border-border overflow-hidden">
                <CardContent className="p-5 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isExpiringSoon ? "bg-primary/10" :
                      isActive ? "bg-emerald-500/10" : "bg-muted-foreground/10"
                    }`}>
                      {isExpiringSoon ? (
                        <AlertTriangle className="size-5 text-primary" />
                      ) : isActive ? (
                        <ShieldCheck className="size-5 text-emerald-500" />
                      ) : (
                        <Shield className="size-5 text-muted-foreground" />
                      )}
                    </div>
                    <Badge className={`text-[10px] uppercase tracking-wider font-semibold ${
                      isExpiringSoon
                        ? "bg-primary/20 text-primary border-primary/30"
                        : isActive
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : "bg-red-500/20 text-red-400 border-red-500/30"
                    }`}>
                      {isExpiringSoon ? "Expiração Crítica" : isActive ? "Protegido" : "Inativo"}
                    </Badge>
                  </div>

                  {/* BM Info */}
                  <div>
                    <h3 className="text-base font-semibold text-foreground">{v.bm_name}</h3>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      ID: {bmId}
                    </p>
                  </div>

                  {/* Expiration Progress */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-muted-foreground">
                        {isExpiringSoon ? (
                          <span className="text-primary font-medium">
                            Expira em {Math.max(0, 30 - daysSinceProtection)}d
                          </span>
                        ) : (
                          "Data de Expiração"
                        )}
                      </span>
                      <span className="text-xs text-foreground font-medium">
                        {format(new Date(v.protection_start), "dd MMM yyyy", { locale: ptBR })}
                      </span>
                    </div>
                    <Progress
                      value={progressPercent}
                      className={`h-1.5 ${isExpiringSoon ? '[&>div]:bg-primary' : isActive ? '[&>div]:bg-blue-500' : '[&>div]:bg-muted-foreground'}`}
                    />
                  </div>

                  {/* Action Button */}
                  {isExpiringSoon ? (
                    <Button className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground h-10 text-sm font-semibold">
                      <RefreshCw className="size-3.5" /> Renovar Agora
                    </Button>
                  ) : isActive ? (
                    <Button
                      variant="outline"
                      className="w-full gap-2 h-10 text-sm border-border hover:bg-muted/10"
                      onClick={() => {
                        if (v.bm_link) window.open(v.bm_link, "_blank");
                      }}
                    >
                      <Download className="size-3.5" /> Generate Backup
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full gap-2 h-10 text-sm opacity-50 cursor-not-allowed" disabled>
                      <Shield className="size-3.5" /> Inativa
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ───── BOTTOM CTAs ───── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Upgrade CTA */}
        <Card className="bg-[hsl(var(--card))] border-border">
          <CardContent className="p-6 flex items-center gap-5">
            <div className="flex-1">
              <h3 className="text-base font-bold text-foreground mb-2">Precisa de mais proteção?</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                Aumente seus limites de vault para proteger até 50 BMs simultaneamente com nosso plano Enterprise.
              </p>
              <a href="/suporte" className="text-primary text-sm font-medium inline-flex items-center gap-1 hover:gap-2 transition-all">
                Ver planos e preços <ArrowRight className="size-3.5" />
              </a>
            </div>
            <div className="w-16 h-16 rounded-xl bg-muted-foreground/10 flex items-center justify-center">
              <Shield className="size-8 text-muted-foreground/40" />
            </div>
          </CardContent>
        </Card>

        {/* Sync Status */}
        <Card className="bg-[hsl(var(--card))] border-border bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="size-5 text-primary" />
              <h3 className="text-base font-bold text-foreground">Sincronização Ativa</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Suas chaves de acesso estão seguras e criptografadas via hardware.
              <br />Última sincronização: agora.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 h-9 text-xs">
                Ver Logs
              </Button>
              <Button size="sm" className="flex-1 h-9 text-xs bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30">
                Sincronizar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
