import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientScaleProProxies } from "@/components/scale-pro/ClientScaleProProxies";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Shield, CheckCircle2, AlertTriangle, XCircle, Calendar, Wallet,
  Monitor, Globe, Megaphone, UserCircle, RotateCcw, Plus, MessageCircle,
  History, CreditCard, HelpCircle, ArrowUpRight, ChevronRight, TrendingUp,
  DollarSign, Activity, FileText, Sparkles, Zap, Crown, BarChart3, Users
} from "lucide-react";

function getOverdueDays(nextBilling: string | null | undefined): number {
  if (!nextBilling) return 0;
  const due = new Date(nextBilling).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = today.getTime() - due;
  return diff > 0 ? Math.floor(diff / 86400000) : 0;
}

function getDaysUntil(nextBilling: string | null | undefined): number {
  if (!nextBilling) return 0;
  const due = new Date(nextBilling).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = due - today.getTime();
  return diff > 0 ? Math.ceil(diff / 86400000) : 0;
}

const statusColors: Record<string, string> = {
  ativo: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  block: "bg-red-500/20 text-red-400 border-red-500/30",
  substituido: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  em_reposicao: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  suspenso: "bg-red-500/20 text-red-400 border-red-500/30",
};

const typeLabels: Record<string, string> = {
  perfil: "Perfil",
  perfil_matriz: "Perfil Matriz",
  proxy: "Proxy",
  bm: "BM",
  conta: "Conta de Anúncio",
  ad_account: "Conta de Anúncio",
  pagina: "Página",
};

const typeIcons: Record<string, React.ReactNode> = {
  perfil: <UserCircle className="h-5 w-5" />,
  perfil_matriz: <Shield className="h-5 w-5" />,
  proxy: <Globe className="h-5 w-5" />,
  bm: <Monitor className="h-5 w-5" />,
  conta: <Megaphone className="h-5 w-5" />,
  ad_account: <Megaphone className="h-5 w-5" />,
  pagina: <FileText className="h-5 w-5" />,
};

const LAUTH_SIGNUP_URL = "https://lauth.io/";

function LauthActivation({ ctClient }: { ctClient: { id: string; lauth_email?: string | null; lauth_status?: string | null } }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const alreadySaved = !!ctClient.lauth_email;
  const status = ctClient.lauth_status || "pending";
  const activated = status === "active" || status === "ativado" || status === "activated";

  const [hasAccount, setHasAccount] = useState<null | boolean>(alreadySaved ? true : null);
  const [email, setEmail] = useState<string>(ctClient.lauth_email || "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const clean = email.trim().toLowerCase();
    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      toast({ title: "E-mail inválido", description: "Informe o e-mail que você usou no cadastro do Lauth.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("ct-set-lauth-email", {
      body: {
        ct_client_id: ctClient.id,
        lauth_email: clean,
        has_account: hasAccount === true,
      },
    });
    setSaving(false);
    if (error || (data as any)?.error) {
      toast({
        title: "Erro ao enviar",
        description: (data as any)?.error || error?.message || "Tente novamente.",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "E-mail enviado!", description: "Nossa equipe já foi notificada e vai ativar sua estrutura no Lauth." });
    queryClient.invalidateQueries({ queryKey: ["ct-client-self"] });
  };

  // Se já ativado, mostra badge de sucesso compacto
  if (alreadySaved && activated) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] p-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-emerald-300">Estrutura ativada no Lauth</p>
          <p className="text-xs text-muted-foreground truncate">Vinculada a <span className="text-foreground">{ctClient.lauth_email}</span></p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.05] via-transparent to-transparent p-5">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Ative sua estrutura no Lauth</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sua estrutura Scale Pro é entregue dentro do <span className="font-medium text-foreground">Lauth</span> (anti-detect). Precisamos apenas do e-mail que você usou no cadastro para vincular tudo à sua conta.
          </p>
        </div>
      </div>

      {alreadySaved && !activated && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/[0.05] p-3 flex items-start gap-2">
          <Activity className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="text-xs">
            <p className="font-medium text-amber-300">Aguardando ativação da equipe</p>
            <p className="text-muted-foreground">Recebemos seu e-mail <span className="text-foreground">{ctClient.lauth_email}</span>. Vamos vincular sua estrutura em até algumas horas.</p>
          </div>
        </div>
      )}

      {!alreadySaved && (
        <>
          <div className="mt-4">
            <p className="text-xs font-medium mb-2">Você já tem conta no Lauth?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setHasAccount(true)}
                className={`rounded-lg border p-3 text-left transition-all ${
                  hasAccount === true
                    ? "border-emerald-500/40 bg-emerald-500/[0.08]"
                    : "border-border/60 bg-card/30 hover:border-emerald-500/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`h-4 w-4 ${hasAccount === true ? "text-emerald-400" : "text-muted-foreground"}`} />
                  <span className="text-sm font-medium">Sim, já tenho</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Informe o e-mail cadastrado no Lauth.</p>
              </button>
              <button
                onClick={() => setHasAccount(false)}
                className={`rounded-lg border p-3 text-left transition-all ${
                  hasAccount === false
                    ? "border-emerald-500/40 bg-emerald-500/[0.08]"
                    : "border-border/60 bg-card/30 hover:border-emerald-500/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Plus className={`h-4 w-4 ${hasAccount === false ? "text-emerald-400" : "text-muted-foreground"}`} />
                  <span className="text-sm font-medium">Não tenho ainda</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Vamos te mostrar como criar em 2 min.</p>
              </button>
            </div>
          </div>

          {hasAccount === false && (
            <div className="mt-4 rounded-lg border border-border/60 bg-card/30 p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-start gap-3">
                <span className="h-6 w-6 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center shrink-0">1</span>
                <div className="text-xs">
                  <p className="font-medium">Crie sua conta gratuita no Lauth</p>
                  <a href={LAUTH_SIGNUP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1 text-emerald-400 hover:text-emerald-300 underline underline-offset-2">
                    Abrir cadastro no Lauth <ArrowUpRight className="h-3 w-3" />
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="h-6 w-6 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center shrink-0">2</span>
                <div className="text-xs">
                  <p className="font-medium">Baixe e instale o Lauth</p>
                  <p className="text-muted-foreground">Após criar a conta, baixe o app no próprio site e faça o login.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="h-6 w-6 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center shrink-0">3</span>
                <div className="text-xs">
                  <p className="font-medium">Volte aqui e informe o e-mail que você usou no cadastro</p>
                  <p className="text-muted-foreground">Assim conseguimos vincular sua estrutura à sua conta.</p>
                </div>
              </div>
            </div>
          )}

          {hasAccount !== null && (
            <div className="mt-4 flex flex-col sm:flex-row gap-2 animate-in fade-in duration-200">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu-email@usado-no-lauth.com"
                className="flex-1 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-emerald-500/50"
              />
              <Button
                onClick={submit}
                disabled={saving || !email.trim()}
                className="bg-emerald-500 hover:bg-emerald-500/90 text-emerald-950"
              >
                {saving ? "Enviando..." : "Ativar estrutura"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ClientContingencia() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [replacementOpen, setReplacementOpen] = useState(false);
  const [replacementType, setReplacementType] = useState("");
  const [replacementReason, setReplacementReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [profilePhotos, setProfilePhotos] = useState<Record<string, string | null>>({});

  // Fetch client subscription
  const { data: ctClient, isLoading } = useQuery({
    queryKey: ["ct-client-self"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("ct_clients")
        .select("*, ct_plans(*)")
        .eq("user_id", user.id)
        .eq("status", "ativo")
        .maybeSingle();
      return data;
    },
  });

  // Fetch items
  const { data: items = [] } = useQuery({
    queryKey: ["ct-items-self", ctClient?.id],
    enabled: !!ctClient?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("ct_items")
        .select("*")
        .eq("ct_client_id", ctClient!.id);
      return data || [];
    },
  });

  // Fetch replacements
  const { data: replacements = [] } = useQuery({
    queryKey: ["ct-replacements-self", ctClient?.id],
    enabled: !!ctClient?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("ct_replacements")
        .select("*")
        .eq("ct_client_id", ctClient!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Fetch tickets
  const { data: tickets = [] } = useQuery({
    queryKey: ["ct-tickets-self", ctClient?.id],
    enabled: !!ctClient?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("ct_tickets")
        .select("*")
        .eq("ct_client_id", ctClient!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Fetch extra charges
  const { data: extraCharges = [] } = useQuery({
    queryKey: ["ct-extra-charges-self", ctClient?.id],
    enabled: !!ctClient?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("ct_extra_charges")
        .select("*")
        .eq("ct_client_id", ctClient!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Fetch all plans for comparison
  const { data: allPlans = [] } = useQuery({
    queryKey: ["ct-plans-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ct_plans")
        .select("*")
        .eq("active", true)
        .order("price", { ascending: true });
      return data || [];
    },
  });

  // Fetch wallet balance
  const { data: profile } = useQuery({
    queryKey: ["profile-balance-self"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
  });

  // Replacement request mutation
  const requestReplacement = useMutation({
    mutationFn: async () => {
      if (!ctClient) throw new Error("Sem assinatura");
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("ct_replacements").insert({
        ct_client_id: ctClient.id,
        item_type: replacementType,
        reason: replacementReason,
        performed_by: user?.id,
      });
      await supabase.from("ct_tickets").insert({
        ct_client_id: ctClient.id,
        type: "block",
        priority: "alta",
        message: `Reposição solicitada: ${typeLabels[replacementType] || replacementType} - ${replacementReason}`,
      });
    },
    onSuccess: () => {
      toast({ title: "Reposição solicitada!", description: "Nossa equipe já foi notificada." });
      setReplacementOpen(false);
      setReplacementType("");
      setReplacementReason("");
      queryClient.invalidateQueries({ queryKey: ["ct-replacements-self"] });
      queryClient.invalidateQueries({ queryKey: ["ct-tickets-self"] });
    },
    onError: () => toast({ title: "Erro ao solicitar", variant: "destructive" }),
  });

  // Derived data
  const plan = ctClient?.ct_plans as any;
  const monthReplacements = useMemo(() => {
    const now = new Date();
    return replacements.filter((r: any) => {
      const d = new Date(r.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [replacements]);

  const maxReplacements = plan?.replacements_qty || 0;
  const replacementPercent = maxReplacements > 0 ? (monthReplacements / maxReplacements) * 100 : 0;
  const blockedItems = items.filter((i: any) => i.status === "block");
  const activeItems = items.filter((i: any) => i.status === "ativo");
  const hasBlocks = blockedItems.length > 0;
  const groupedItems = useMemo(() => {
    const groups: Record<string, any[]> = { perfil: [], perfil_matriz: [], proxy: [], bm: [], conta: [], ad_account: [], pagina: [] };
    items.forEach((item: any) => {
      if (groups[item.type]) groups[item.type].push(item);
    });
    return groups;
  }, [items]);

  // Fetch FB profile photos for perfil / perfil_matriz items
  useEffect(() => {
    const profileItems = items.filter(
      (i: any) =>
        (i.type === "perfil" || i.type === "perfil_matriz") &&
        i.identifier &&
        /facebook\.com/i.test(i.identifier) &&
        profilePhotos[i.id] === undefined,
    );
    if (!profileItems.length) return;
    let cancelled = false;
    (async () => {
      const FN_BASE = "https://mxnlerkeygfvdnznoxld.supabase.co/functions/v1";
      const results = await Promise.all(
        profileItems.map(async (it: any) => {
          try {
            const r = await fetch(`${FN_BASE}/fb-photo?url=${encodeURIComponent(it.identifier)}`);
            const j = await r.json();
            return [it.id, j?.ok ? (j.photoUrl as string) : null] as const;
          } catch {
            return [it.id, null] as const;
          }
        }),
      );
      if (cancelled) return;
      setProfilePhotos((prev) => {
        const n = { ...prev };
        for (const [id, url] of results) n[id] = url;
        return n;
      });
    })();
    return () => { cancelled = true; };
  }, [items, profilePhotos]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!ctClient) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-6">
        <Shield className="h-16 w-16 mx-auto text-muted-foreground/40" />
        <h1 className="text-2xl font-bold">Scale Pro FBFlix</h1>
        <p className="text-muted-foreground">
          Você ainda não possui uma assinatura de Scale Pro.
          Entre em contato com o suporte para contratar.
        </p>
        <Button asChild variant="outline">
          <a href="https://wa.me/5500000000000" target="_blank" rel="noopener noreferrer">
            <MessageCircle className="mr-2 h-4 w-4" /> Falar com Suporte
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-8 animate-in fade-in duration-300">
      {/* ============ HERO ============ */}
      <header className="flex items-center gap-5">
        <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
          <Shield className="h-8 w-8 text-emerald-400" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Minha Contingência</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie sua estrutura e assinatura
          </p>
        </div>
      </header>

      <Tabs defaultValue="visao-geral" className="space-y-8">
        {/* Premium tab bar */}
        <TabsList className="w-full h-auto bg-transparent p-0 border-b border-border/60 rounded-none grid grid-cols-5 gap-0">
          {[
            { value: "visao-geral", label: "Visão Geral", icon: BarChart3 },
            { value: "estrutura", label: "Minha Estrutura", icon: Users },
            { value: "historico", label: "Histórico", icon: History },
            { value: "assinatura", label: "Assinatura", icon: CreditCard },
            { value: "ajuda", label: "Ajuda", icon: HelpCircle },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="relative rounded-none border-0 bg-transparent px-4 py-3.5 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none after:absolute after:left-0 after:right-0 after:-bottom-px after:h-[2px] after:bg-transparent data-[state=active]:after:bg-emerald-400 transition-colors gap-2"
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                {t.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* ===== VISÃO GERAL ===== */}
        <TabsContent value="visao-geral" className="space-y-6 mt-0 animate-in fade-in slide-in-from-bottom-1 duration-200">
          {/* Overdue billing alert */}
          {(() => {
            const overdueDays = getOverdueDays(ctClient.next_billing);
            if (overdueDays <= 0) return null;
            return (
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-5 py-4 flex items-center gap-4">
                <div className="h-9 w-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-300">
                    Assinatura atrasada há {overdueDays} dia{overdueDays > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    Renove agora para evitar a suspensão da sua estrutura.
                  </p>
                </div>
                <Button
                  size="sm"
                  className="bg-red-500 hover:bg-red-600 text-white shrink-0"
                  onClick={() => {
                    const trigger = document.querySelector<HTMLButtonElement>('[data-state][value="assinatura"]');
                    trigger?.click();
                  }}
                >
                  Renovar agora
                </Button>
              </div>
            );
          })()}

          {/* Status banner */}
          <div className={`rounded-xl border px-5 py-4 flex items-center gap-4 ${hasBlocks ? "border-amber-500/30 bg-amber-500/5" : "border-emerald-500/20 bg-emerald-500/[0.03]"}`}>
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${hasBlocks ? "bg-amber-500/10 border border-amber-500/20" : "bg-emerald-500/10 border border-emerald-500/20"}`}>
              {hasBlocks ? <AlertTriangle className="h-4 w-4 text-amber-400" /> : <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {hasBlocks ? `Atenção: ${blockedItems.length} item(ns) com block reportado` : "Sua estrutura está 100% ativa"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {hasBlocks ? "Nossa equipe já está analisando. Solicite reposição se necessário." : "Todos os seus ativos estão funcionando normalmente."}
              </p>
            </div>
            {hasBlocks && (
              <Button size="sm" variant="outline" className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10 shrink-0">
                Ver detalhes <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>

          {/* Ativação Lauth */}
          <LauthActivation ctClient={ctClient as any} />

          {/* KPI cards */}
          {(() => {
            const daysUntil = getDaysUntil(ctClient.next_billing);
            const totalCapacity = (plan?.profiles_qty || 0) + (plan?.bms_qty || 0) + (plan?.accounts_qty || 0) + (plan?.proxies_qty || 0);
            const activePercent = totalCapacity > 0 ? Math.round((activeItems.length / totalCapacity) * 100) : 0;
            const circumference = 2 * Math.PI * 22;
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Plano Atual */}
                <div className="group rounded-xl border border-border/60 bg-card/40 p-5 flex flex-col justify-between min-h-[140px] hover:border-border transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Plano Atual</span>
                    <Crown className="h-4 w-4 text-muted-foreground/70" strokeWidth={1.75} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xl font-semibold tracking-tight">{plan?.name || "—"}</p>
                    {plan?.tier && (
                      <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted/60 border border-border/60 text-muted-foreground capitalize">
                        {plan.tier}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => document.querySelector<HTMLButtonElement>('[data-state][value="assinatura"]')?.click()}
                    className="text-xs text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 self-start transition-colors"
                  >
                    Ver detalhes do plano <ChevronRight className="h-3 w-3" />
                  </button>
                </div>

                {/* Valor Mensal */}
                <div className="group rounded-xl border border-border/60 bg-card/40 p-5 flex flex-col justify-between min-h-[140px] hover:border-border transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Valor Mensal</span>
                    <DollarSign className="h-4 w-4 text-muted-foreground/70" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold tracking-tight tabular-nums text-emerald-400">
                      R$ {Number(ctClient.monthly_value || 0).toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                    <DollarSign className="h-3 w-3" />
                    Próxima cobrança em {ctClient.next_billing ? format(new Date(ctClient.next_billing), "dd/MM/yyyy") : "—"}
                  </div>
                </div>

                {/* Próxima Cobrança */}
                <div className="group rounded-xl border border-border/60 bg-card/40 p-5 flex flex-col justify-between min-h-[140px] hover:border-border transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Próxima Cobrança</span>
                    <Calendar className="h-4 w-4 text-muted-foreground/70" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-xl font-semibold tracking-tight tabular-nums">
                      {ctClient.next_billing ? format(new Date(ctClient.next_billing), "dd/MM/yyyy") : "—"}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    {daysUntil > 0 ? `Em ${daysUntil} dia${daysUntil > 1 ? "s" : ""}` : "Hoje"}
                  </div>
                </div>

                {/* Ativos com donut */}
                <div className="group rounded-xl border border-border/60 bg-card/40 p-5 flex flex-col justify-between min-h-[140px] hover:border-border transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Ativos Funcionando</span>
                    <Shield className="h-4 w-4 text-muted-foreground/70" strokeWidth={1.75} />
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-2xl font-semibold tracking-tight tabular-nums">
                        {activeItems.length}<span className="text-sm text-muted-foreground font-normal">/{totalCapacity || items.length}</span>
                      </p>
                    </div>
                    <div className="relative shrink-0">
                      <svg width="56" height="56" viewBox="0 0 52 52" className="-rotate-90">
                        <circle cx="26" cy="26" r="22" strokeWidth="4" className="stroke-border/60" fill="none" />
                        <circle
                          cx="26" cy="26" r="22" strokeWidth="4" fill="none"
                          className="stroke-emerald-400 transition-all duration-500"
                          strokeLinecap="round"
                          strokeDasharray={circumference}
                          strokeDashoffset={circumference - (circumference * activePercent) / 100}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-emerald-400 tabular-nums">
                        {activePercent}%
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => document.querySelector<HTMLButtonElement>('[data-state][value="estrutura"]')?.click()}
                    className="text-xs text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 self-start transition-colors"
                  >
                    Ver estrutura <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Two-column: Seus Ativos + Atividade Recente */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Seus Ativos */}
            <div className="rounded-xl border border-border/60 bg-card/40 p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Seus Ativos</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Acompanhe o status da sua estrutura</p>
                </div>
                <FileText className="h-4 w-4 text-muted-foreground/70" strokeWidth={1.75} />
              </div>
              <div className="space-y-3">
                {[
                  { key: "bm", label: "Business Managers", icon: Monitor, active: groupedItems.bm.filter((i:any)=>i.status==="ativo").length, max: plan?.bms_qty || 0 },
                  { key: "perfil", label: "Perfis", icon: UserCircle, active: [...groupedItems.perfil, ...groupedItems.perfil_matriz].filter((i:any)=>i.status==="ativo").length, max: (plan?.profiles_qty || 0) + (plan?.matrix_profiles_qty || 0) },
                  { key: "pagina", label: "Páginas", icon: FileText, active: (groupedItems as any).pagina?.filter?.((i:any)=>i.status==="ativo").length || 0, max: (plan as any)?.pages_qty || 0 },
                  { key: "conta", label: "Contas de Anúncio", icon: Megaphone, active: groupedItems.conta.filter((i:any)=>i.status==="ativo").length, max: plan?.accounts_qty || 0 },
                ].map((row) => {
                  const pct = row.max > 0 ? Math.min(100, (row.active / row.max) * 100) : 0;
                  const Icon = row.icon;
                  return (
                    <button
                      key={row.key}
                      onClick={() => document.querySelector<HTMLButtonElement>('[data-state][value="estrutura"]')?.click()}
                      className="w-full group flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0 hover:bg-white/[0.02] transition-colors rounded-md px-2 -mx-2"
                    >
                      <div className="h-8 w-8 rounded-lg bg-muted/40 border border-border/50 flex items-center justify-center shrink-0">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm">{row.label}</span>
                          <span className="text-[10px] font-medium tabular-nums px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            {row.active}/{row.max || row.active} ativos
                          </span>
                        </div>
                        <div className="h-1 rounded-full bg-border/40 overflow-hidden">
                          <div className="h-full bg-emerald-400/80 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors" />
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => document.querySelector<HTMLButtonElement>('[data-state][value="estrutura"]')?.click()}
                className="w-full text-xs text-muted-foreground hover:text-foreground border-t border-border/40 pt-3 inline-flex items-center justify-center gap-1 transition-colors"
              >
                Ver estrutura completa <ChevronRight className="h-3 w-3" />
              </button>
            </div>

            {/* Atividade Recente */}
            <div className="rounded-xl border border-border/60 bg-card/40 p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Atividade Recente</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Últimas atualizações da sua conta</p>
                </div>
                <Activity className="h-4 w-4 text-muted-foreground/70" strokeWidth={1.75} />
              </div>
              <div className="space-y-4">
                {(() => {
                  const events: { icon: any; color: string; title: string; desc: string; date: Date }[] = [];
                  if (ctClient.start_date) {
                    events.push({
                      icon: CheckCircle2, color: "emerald",
                      title: "Cobrança realizada com sucesso",
                      desc: `Plano ${plan?.name || ""} • R$ ${Number(ctClient.monthly_value || 0).toFixed(0)}`,
                      date: new Date(ctClient.start_date),
                    });
                  }
                  items.slice(0, 2).forEach((i: any) => {
                    events.push({
                      icon: Shield, color: "sky",
                      title: "Novo ativo adicionado",
                      desc: `${typeLabels[i.type] || i.type} adicionado à estrutura`,
                      date: new Date(i.created_at || ctClient.start_date),
                    });
                  });
                  replacements.slice(0, 1).forEach((r: any) => {
                    events.push({
                      icon: RotateCcw, color: "amber",
                      title: "Reposição solicitada",
                      desc: `${typeLabels[r.item_type] || r.item_type} • ${r.reason?.slice(0, 40) || "Sem descrição"}`,
                      date: new Date(r.created_at),
                    });
                  });
                  blockedItems.slice(0, 1).forEach((i: any) => {
                    events.push({
                      icon: AlertTriangle, color: "amber",
                      title: "Block reportado",
                      desc: `${typeLabels[i.type] || i.type} necessita verificação da equipe`,
                      date: new Date(i.updated_at || i.created_at),
                    });
                  });
                  const sorted = events.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 4);
                  if (sorted.length === 0) {
                    return <p className="text-xs text-muted-foreground text-center py-8">Sem atividades recentes</p>;
                  }
                  const colorMap: Record<string, string> = {
                    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
                    sky: "bg-sky-500/10 border-sky-500/20 text-sky-400",
                    amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
                  };
                  return sorted.map((e, idx) => {
                    const Icon = e.icon;
                    const diffDays = Math.floor((Date.now() - e.date.getTime()) / 86400000);
                    const rel = diffDays === 0 ? "hoje" : diffDays === 1 ? "1d atrás" : diffDays < 7 ? `${diffDays}d atrás` : `${Math.floor(diffDays/7)}sem atrás`;
                    return (
                      <div key={idx} className="flex items-start gap-3">
                        <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${colorMap[e.color]}`}>
                          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </div>
                        <div className="flex-1 min-w-0 pb-0.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium leading-tight">{e.title}</p>
                            <span className="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">{rel}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{e.desc}</p>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
              <button
                onClick={() => document.querySelector<HTMLButtonElement>('[data-state][value="historico"]')?.click()}
                className="w-full text-xs text-muted-foreground hover:text-foreground border-t border-border/40 pt-3 inline-flex items-center justify-center gap-1 transition-colors"
              >
                Ver histórico completo <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Replacements */}
          <div className="rounded-xl border border-border/60 bg-card/40 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-muted-foreground/70" strokeWidth={1.75} />
                <h3 className="text-sm font-medium">Reposições este mês</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  <span className="text-foreground font-medium tabular-nums">{monthReplacements}</span> utilizadas · <span className="text-foreground font-medium tabular-nums">{Math.max(0, maxReplacements - monthReplacements)}</span> restantes
                </span>
                <span className="text-xs font-medium tabular-nums text-emerald-400">{Math.round(replacementPercent)}%</span>
              </div>
            </div>
            <div className="h-1 rounded-full bg-border/40 overflow-hidden">
              <div className="h-full bg-emerald-400/80 rounded-full transition-all duration-500" style={{ width: `${Math.min(replacementPercent, 100)}%` }} />
            </div>
            {monthReplacements >= maxReplacements && maxReplacements > 0 && (
              <p className="text-xs text-amber-400 mt-2">Limite de reposições atingido este mês</p>
            )}
          </div>

          {/* Proxies inclusos no plano */}
          <ClientScaleProProxies ctClientId={ctClient.id} />
        </TabsContent>

        {/* ===== MINHA ESTRUTURA ===== */}
        <TabsContent value="estrutura" className="space-y-4">
          {(["perfil", "perfil_matriz", "bm", "pagina", "ad_account", "conta", "proxy"] as const).map((type) => {
            const typeItems = groupedItems[type] || [];
            if (typeItems.length === 0) return null;
            return (
              <Card key={type}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {typeIcons[type]}
                    {typeLabels[type]}{(type === "perfil_matriz" || type === "ad_account" || type === "conta") ? (typeItems.length > 1 ? "s" : "") : "s"}
                    <Badge variant="secondary" className="ml-auto">{typeItems.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                    {typeItems.map((item: any, idx: number) => {
                      const statusColor =
                        item.status === "block" ? "hsl(0 84% 60%)" :
                        item.status === "substituido" ? "hsl(45 93% 47%)" : "hsl(160 84% 39%)";
                      const isProfile = type === "perfil" || type === "perfil_matriz";
                      const displayName = item.identifier
                        ? item.identifier
                        : type === "proxy"
                          ? `Proxy BR Dedicado ${idx + 1}`
                          : type === "bm"
                            ? `BM ${(item.metadata as any)?.label || (idx === 0 ? "Matriz" : "Reserva")}`
                            : `${typeLabels[type]} ${idx + 1}`;
                      const isUrl = typeof displayName === "string" && /^https?:\/\//i.test(displayName);
                      return (
                        <div
                          key={item.id}
                          className="group relative flex flex-col rounded-lg border border-border/60 bg-card/40 p-2.5 hover:border-emerald-500/30 hover:bg-card/60 transition-all overflow-hidden"
                        >
                          <div className="absolute top-0 left-0 h-full w-[2px]" style={{ backgroundColor: statusColor }} />
                          <div className="flex items-center justify-between gap-1.5 mb-2">
                            <div className="h-8 w-8 rounded-md overflow-hidden bg-muted/40 border border-border/60 flex items-center justify-center shrink-0">
                              {isProfile && profilePhotos[item.id] ? (
                                <img
                                  src={profilePhotos[item.id] as string}
                                  alt="Perfil"
                                  className="h-full w-full object-cover"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                />
                              ) : (
                                <span className="text-muted-foreground [&_svg]:h-3.5 [&_svg]:w-3.5">{typeIcons[type]}</span>
                              )}
                            </div>
                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 shrink-0 ${statusColors[item.status] || ""}`}>
                              <span className="inline-block h-1 w-1 rounded-full mr-1" style={{ backgroundColor: statusColor }} />
                              {item.status === "ativo" ? "Ativo" :
                                item.status === "block" ? "Block" :
                                item.status === "substituido" ? "Substituído" : item.status}
                            </Badge>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[9px] uppercase tracking-wide text-muted-foreground mb-0.5">{typeLabels[type]}</p>
                            {isUrl ? (
                              <a
                                href={displayName}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-medium text-foreground hover:text-emerald-400 break-all line-clamp-2 leading-tight"
                                title={displayName}
                              >
                                {displayName}
                              </a>
                            ) : (
                              <p className="text-xs font-medium text-foreground break-all line-clamp-2 leading-tight" title={displayName}>
                                {displayName}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {type === "proxy" && (
                    <p className="text-xs text-muted-foreground mt-3">
                      Trocas de proxy são realizadas pela equipe mediante solicitação.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Action buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              onClick={() => setReplacementOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-12"
              disabled={monthReplacements >= maxReplacements}
            >
              <RotateCcw className="mr-2 h-4 w-4" /> Pedir Reposição
            </Button>
            <Button variant="outline" className="h-12" asChild>
              <a href="https://wa.me/5500000000000" target="_blank" rel="noopener noreferrer">
                <Plus className="mr-2 h-4 w-4" /> Adicionar Conta Extra (+R$25)
              </a>
            </Button>
          </div>
        </TabsContent>

        {/* ===== HISTÓRICO ===== */}
        <TabsContent value="historico" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-5 w-5" /> Reposições
              </CardTitle>
            </CardHeader>
            <CardContent>
              {replacements.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma reposição registrada.</p>
              ) : (
                <div className="space-y-2">
                  {replacements.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{typeLabels[r.item_type] || r.item_type}</p>
                        <p className="text-xs text-muted-foreground">{r.reason || "Sem motivo informado"}</p>
                      </div>
                      <div className="text-right space-y-0.5">
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(r.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {r.new_item_id ? "Concluído" : "Em andamento"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="h-5 w-5" /> Tickets de Suporte
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum ticket registrado.</p>
              ) : (
                <div className="space-y-2">
                  {tickets.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium capitalize">{t.type.replace("_", " ")}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{t.message}</p>
                      </div>
                      <div className="text-right space-y-0.5">
                        <Badge variant="outline" className={`text-xs ${t.status === "aberto" ? "text-amber-400 border-amber-500/30" : "text-emerald-400 border-emerald-500/30"}`}>
                          {t.status === "aberto" ? "Aberto" : "Resolvido"}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(t.created_at), "dd/MM", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== ASSINATURA ===== */}
        <TabsContent value="assinatura" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card>
              <CardContent className="pt-4 pb-4 space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="h-3 w-3" /> Saldo na Carteira</p>
                <p className="font-bold text-xl text-emerald-400">
                  R$ {Number(profile?.balance || 0).toFixed(2).replace(".", ",")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><CreditCard className="h-3 w-3" /> Plano</p>
                <p className="font-bold text-sm">{plan?.name}</p>
                <p className="text-xs text-muted-foreground">
                  Desde {format(new Date(ctClient.start_date), "dd/MM/yyyy")}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Extra charges */}
          {extraCharges.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Cobranças Extras</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {extraCharges.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-2">
                    <span className="text-sm">{c.description}</span>
                    <span className="text-sm font-medium">R$ {Number(c.amount).toFixed(2).replace(".", ",")}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Plan comparison */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Comparar Planos</CardTitle>
              <CardDescription>Faça upgrade para ter mais ativos e reposições</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {allPlans.map((p: any) => {
                  const isCurrent = p.id === ctClient.plan_id;
                  return (
                    <div
                      key={p.id}
                      className={`rounded-lg border p-4 space-y-2 ${isCurrent ? "border-emerald-500/50 bg-emerald-500/5" : "border-border/50"}`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm">{p.name}</p>
                        {isCurrent && <Badge className="bg-emerald-600 text-xs">Atual</Badge>}
                      </div>
                      <p className="text-lg font-bold">R$ {Number(p.price).toFixed(0)}<span className="text-xs text-muted-foreground">/mês</span></p>
                      <Separator />
                      <div className="text-xs space-y-1 text-muted-foreground">
                        <p>{p.profiles_qty} Perfil(is)</p>
                        <p>{p.proxies_qty} Proxy(ies)</p>
                        <p>{p.bms_qty} BM(s)</p>
                        <p>{p.accounts_qty} Conta(s)</p>
                        <p>{p.replacements_qty} Reposição(ões)/mês</p>
                      </div>
                      {!isCurrent && Number(p.price) > Number(ctClient.monthly_value) && (
                        <Button size="sm" variant="outline" className="w-full text-xs" asChild>
                          <a href="https://wa.me/5500000000000" target="_blank" rel="noopener noreferrer">
                            Fazer Upgrade <ArrowUpRight className="ml-1 h-3 w-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Button
            variant="ghost"
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 w-full"
            onClick={() => setCancelOpen(true)}
          >
            Cancelar Assinatura
          </Button>
        </TabsContent>

        {/* ===== AJUDA ===== */}
        <TabsContent value="ajuda" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <HelpCircle className="h-5 w-5" /> Perguntas Frequentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="1">
                  <AccordionTrigger className="text-sm">Como solicitar uma reposição?</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    Acesse a aba "Minha Estrutura" e clique em "Pedir Reposição". Selecione o tipo de item e descreva o motivo.
                    Nossa equipe será notificada e fará a substituição o mais rápido possível.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="2">
                  <AccordionTrigger className="text-sm">O que acontece se minha BM cair?</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    Se sua BM sofrer block, solicite reposição imediatamente. Temos BMs reserva prontas para ativação.
                    O prazo médio de substituição é de 2-4 horas.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="3">
                  <AccordionTrigger className="text-sm">Posso adicionar contas extras?</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    Sim! Cada conta extra custa R$ 25/mês. Entre em contato com o suporte para adicionar.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="4">
                  <AccordionTrigger className="text-sm">Como funciona a cobrança?</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    A cobrança é mensal e debitada da sua carteira FBFlix na data de renovação.
                    Mantenha saldo suficiente para evitar suspensão.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="5">
                  <AccordionTrigger className="text-sm">Posso cancelar a qualquer momento?</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    Sim, mas o acesso à estrutura será mantido até o fim do período já pago.
                    Após o cancelamento, os ativos são desvinculados.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Button className="w-full h-12 bg-emerald-600 hover:bg-emerald-700" asChild>
            <a href="https://wa.me/5500000000000" target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-2 h-4 w-4" /> Falar com Suporte VIP
            </a>
          </Button>
        </TabsContent>
      </Tabs>

      {/* Replacement Request Modal */}
      <Dialog open={replacementOpen} onOpenChange={setReplacementOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Reposição</DialogTitle>
            <DialogDescription>Descreva o que precisa ser substituído</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Tipo do item</label>
              <Select value={replacementType} onValueChange={setReplacementType}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="perfil">Perfil</SelectItem>
                  <SelectItem value="proxy">Proxy</SelectItem>
                  <SelectItem value="bm">BM</SelectItem>
                  <SelectItem value="conta">Conta de Anúncio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Motivo</label>
              <Textarea
                placeholder="Descreva o que aconteceu..."
                value={replacementReason}
                onChange={(e) => setReplacementReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplacementOpen(false)}>Cancelar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!replacementType || !replacementReason || requestReplacement.isPending}
              onClick={() => requestReplacement.mutate()}
            >
              {requestReplacement.isPending ? "Enviando..." : "Solicitar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-400">Cancelar Assinatura</DialogTitle>
            <DialogDescription>
              Tem certeza? Ao cancelar, você perderá acesso a toda sua estrutura ao final do período atual.
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Manter Assinatura</Button>
            <Button variant="destructive" asChild>
              <a href="https://wa.me/5500000000000" target="_blank" rel="noopener noreferrer">
                Confirmar Cancelamento
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
