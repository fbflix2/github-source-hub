import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  History, CreditCard, HelpCircle, ArrowUpRight, ChevronRight
} from "lucide-react";

const statusColors: Record<string, string> = {
  ativo: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  block: "bg-red-500/20 text-red-400 border-red-500/30",
  substituido: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  em_reposicao: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  suspenso: "bg-red-500/20 text-red-400 border-red-500/30",
};

const typeLabels: Record<string, string> = {
  perfil: "Perfil",
  proxy: "Proxy",
  bm: "BM",
  conta: "Conta de Anúncio",
};

const typeIcons: Record<string, React.ReactNode> = {
  perfil: <UserCircle className="h-5 w-5" />,
  proxy: <Globe className="h-5 w-5" />,
  bm: <Monitor className="h-5 w-5" />,
  conta: <Megaphone className="h-5 w-5" />,
};

export default function ClientContingencia() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [replacementOpen, setReplacementOpen] = useState(false);
  const [replacementType, setReplacementType] = useState("");
  const [replacementReason, setReplacementReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);

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
    const groups: Record<string, any[]> = { perfil: [], proxy: [], bm: [], conta: [] };
    items.forEach((item: any) => {
      if (groups[item.type]) groups[item.type].push(item);
    });
    return groups;
  }, [items]);

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
        <h1 className="text-2xl font-bold">Contingência Total FBFlix</h1>
        <p className="text-muted-foreground">
          Você ainda não possui uma assinatura de Contingência Total.
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
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-emerald-400" />
        <div>
          <h1 className="text-xl font-bold">Minha Contingência</h1>
          <p className="text-sm text-muted-foreground">Gerencie sua estrutura e assinatura</p>
        </div>
      </div>

      <Tabs defaultValue="visao-geral" className="space-y-6">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="visao-geral" className="flex-1 min-w-[100px] text-xs">Visão Geral</TabsTrigger>
          <TabsTrigger value="estrutura" className="flex-1 min-w-[100px] text-xs">Minha Estrutura</TabsTrigger>
          <TabsTrigger value="historico" className="flex-1 min-w-[100px] text-xs">Histórico</TabsTrigger>
          <TabsTrigger value="assinatura" className="flex-1 min-w-[100px] text-xs">Assinatura</TabsTrigger>
          <TabsTrigger value="ajuda" className="flex-1 min-w-[100px] text-xs">Ajuda</TabsTrigger>
        </TabsList>

        {/* ===== VISÃO GERAL ===== */}
        <TabsContent value="visao-geral" className="space-y-4">
          {/* Status hero */}
          <Card className={`border ${hasBlocks ? "border-amber-500/40 bg-amber-500/5" : "border-emerald-500/40 bg-emerald-500/5"}`}>
            <CardContent className="flex items-center gap-4 py-6">
              {hasBlocks ? (
                <AlertTriangle className="h-10 w-10 text-amber-400 shrink-0" />
              ) : (
                <CheckCircle2 className="h-10 w-10 text-emerald-400 shrink-0" />
              )}
              <div>
                <p className="font-semibold text-lg">
                  {hasBlocks
                    ? `Atenção: ${blockedItems.length} item(ns) com block reportado`
                    : "Sua estrutura está 100% ativa"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {hasBlocks
                    ? "Nossa equipe já está analisando. Solicite reposição se necessário."
                    : "Todos os seus ativos estão funcionando normalmente."}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-4 space-y-1">
                <p className="text-xs text-muted-foreground">Plano Atual</p>
                <p className="font-bold text-sm">{plan?.name || "—"}</p>
                <Badge variant="outline" className="text-xs capitalize">{plan?.tier}</Badge>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 space-y-1">
                <p className="text-xs text-muted-foreground">Valor Mensal</p>
                <p className="font-bold text-lg text-emerald-400">
                  R$ {Number(ctClient.monthly_value || 0).toFixed(2).replace(".", ",")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 space-y-1">
                <p className="text-xs text-muted-foreground">Próxima Cobrança</p>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <p className="font-semibold text-sm">
                    {ctClient.next_billing
                      ? format(new Date(ctClient.next_billing), "dd/MM/yyyy")
                      : "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 space-y-1">
                <p className="text-xs text-muted-foreground">Ativos Funcionando</p>
                <p className="font-bold text-lg">{activeItems.length}/{items.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Replacements progress */}
          <Card>
            <CardContent className="pt-4 pb-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Reposições este mês</p>
                <span className="text-sm text-muted-foreground">{monthReplacements}/{maxReplacements}</span>
              </div>
              <Progress value={Math.min(replacementPercent, 100)} className="h-2" />
              {monthReplacements >= maxReplacements && (
                <p className="text-xs text-amber-400">Limite de reposições atingido este mês</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== MINHA ESTRUTURA ===== */}
        <TabsContent value="estrutura" className="space-y-4">
          {(["perfil", "proxy", "bm", "conta"] as const).map((type) => {
            const typeItems = groupedItems[type] || [];
            if (typeItems.length === 0) return null;
            return (
              <Card key={type}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {typeIcons[type]}
                    {typeLabels[type]}s
                    <Badge variant="secondary" className="ml-auto">{typeItems.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {typeItems.map((item: any, idx: number) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-emerald-400" style={{
                          backgroundColor: item.status === "block" ? "hsl(0 84% 60%)" :
                            item.status === "substituido" ? "hsl(45 93% 47%)" : "hsl(160 84% 39%)"
                        }} />
                        <span className="text-sm font-medium">
                          {type === "proxy" ? `Proxy BR Dedicado ${idx + 1}` :
                            type === "bm" ? `BM ${(item.metadata as any)?.label || (idx === 0 ? "Matriz" : "Reserva")}` :
                              `${typeLabels[type]} ${idx + 1}`}
                        </span>
                      </div>
                      <Badge variant="outline" className={`text-xs ${statusColors[item.status] || ""}`}>
                        {item.status === "ativo" ? "Ativo" :
                          item.status === "block" ? "Block" :
                            item.status === "substituido" ? "Substituído" : item.status}
                      </Badge>
                    </div>
                  ))}
                  {type === "proxy" && (
                    <p className="text-xs text-muted-foreground mt-1">
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
