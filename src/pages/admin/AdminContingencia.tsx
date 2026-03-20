import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import {
  Users, TrendingUp, AlertTriangle, Shield, RefreshCw, Plus, Download,
  Search, Eye, DollarSign, Ticket, BarChart3, Package, Zap, Trash2, Edit2, Save, X
} from "lucide-react";

// Types
interface Plan {
  id: string; name: string; tier: string; price: number;
  profiles_qty: number; proxies_qty: number; bms_qty: number;
  accounts_qty: number; replacements_qty: number; active: boolean;
}

interface Client {
  id: string; user_id: string; plan_id: string | null; telegram: string | null;
  status: string; start_date: string; next_billing: string | null;
  monthly_value: number; notes: string | null; created_at: string;
  plan?: Plan; profile?: { full_name: string | null; };
  items_count?: number;
}

interface Item {
  id: string; ct_client_id: string; type: string; identifier: string | null;
  status: string; metadata: any; created_at: string;
}

interface Replacement {
  id: string; ct_client_id: string; item_type: string; reason: string | null;
  old_item_id: string | null; new_item_id: string | null;
  performed_by: string | null; created_at: string;
  client?: Client;
}

interface CtTicket {
  id: string; ct_client_id: string; type: string; priority: string;
  status: string; message: string | null; resolved_at: string | null;
  created_at: string; client?: Client;
}

const statusColors: Record<string, string> = {
  ativo: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  em_reposicao: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  suspenso: "bg-red-500/20 text-red-400 border-red-500/30",
  cancelado: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

const priorityColors: Record<string, string> = {
  alta: "bg-red-500/20 text-red-400",
  media: "bg-amber-500/20 text-amber-400",
  baixa: "bg-blue-500/20 text-blue-400",
};

const tierColors: Record<string, string> = {
  white: "bg-white/10 text-white border-white/20",
  black: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

export default function AdminContingencia() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [replacements, setReplacements] = useState<Replacement[]>([]);
  const [tickets, setTickets] = useState<CtTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTier, setFilterTier] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Modals
  const [showNewClient, setShowNewClient] = useState(false);
  const [showStructure, setShowStructure] = useState<Client | null>(null);
  const [showNewReplacement, setShowNewReplacement] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  // Structure modal state
  const [clientItems, setClientItems] = useState<Item[]>([]);
  const [clientReplacements, setClientReplacements] = useState<Replacement[]>([]);

  // New client form
  const [newClient, setNewClient] = useState({
    email: "", telegram: "", plan_id: "", notes: ""
  });

  // New replacement form
  const [newRep, setNewRep] = useState({
    ct_client_id: "", item_type: "perfil", reason: ""
  });

  // New ticket form
  const [newTicketForm, setNewTicketForm] = useState({
    ct_client_id: "", type: "block", priority: "media", message: ""
  });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadPlans(), loadClients(), loadReplacements(), loadTickets()]);
    setLoading(false);
  };

  const loadPlans = async () => {
    const { data } = await supabase.from("ct_plans").select("*").order("tier").order("price");
    if (data) setPlans(data as any);
  };

  const loadClients = async () => {
    const { data } = await supabase.from("ct_clients").select("*").order("created_at", { ascending: false });
    if (!data) return;
    
    // Fetch plans and profiles
    const planIds = [...new Set(data.map(c => c.plan_id).filter(Boolean))];
    const userIds = [...new Set(data.map(c => c.user_id))];
    
    const [plansRes, profilesRes, itemsRes] = await Promise.all([
      planIds.length ? supabase.from("ct_plans").select("*").in("id", planIds) : { data: [] },
      userIds.length ? supabase.from("profiles").select("user_id, full_name").in("user_id", userIds) : { data: [] },
      supabase.from("ct_items").select("ct_client_id"),
    ]);

    const plansMap = new Map((plansRes.data || []).map((p: any) => [p.id, p]));
    const profilesMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p]));
    const itemsCounts = new Map<string, number>();
    (itemsRes.data || []).forEach((i: any) => {
      itemsCounts.set(i.ct_client_id, (itemsCounts.get(i.ct_client_id) || 0) + 1);
    });

    setClients(data.map((c: any) => ({
      ...c,
      plan: plansMap.get(c.plan_id),
      profile: profilesMap.get(c.user_id),
      items_count: itemsCounts.get(c.id) || 0,
    })));
  };

  const loadReplacements = async () => {
    const { data } = await supabase.from("ct_replacements").select("*").order("created_at", { ascending: false }).limit(100);
    if (data) setReplacements(data as any);
  };

  const loadTickets = async () => {
    const { data } = await supabase.from("ct_tickets").select("*").order("created_at", { ascending: false }).limit(100);
    if (data) setTickets(data as any);
  };

  const loadClientStructure = async (client: Client) => {
    setShowStructure(client);
    const [itemsRes, repsRes] = await Promise.all([
      supabase.from("ct_items").select("*").eq("ct_client_id", client.id).order("type"),
      supabase.from("ct_replacements").select("*").eq("ct_client_id", client.id).order("created_at", { ascending: false }),
    ]);
    setClientItems((itemsRes.data || []) as any);
    setClientReplacements((repsRes.data || []) as any);
  };

  // Computed
  const activeClients = useMemo(() => clients.filter(c => c.status === "ativo"), [clients]);
  const whiteClients = useMemo(() => activeClients.filter(c => c.plan?.tier === "white"), [activeClients]);
  const blackClients = useMemo(() => activeClients.filter(c => c.plan?.tier === "black"), [activeClients]);
  const mrr = useMemo(() => activeClients.reduce((sum, c) => sum + c.monthly_value, 0), [activeClients]);
  const monthReplacements = useMemo(() => {
    const now = new Date();
    return replacements.filter(r => {
      const d = new Date(r.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [replacements]);

  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const name = c.profile?.full_name || c.telegram || "";
      if (search && !name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterTier !== "all" && c.plan?.tier !== filterTier) return false;
      if (filterStatus !== "all" && c.status !== filterStatus) return false;
      return true;
    });
  }, [clients, search, filterTier, filterStatus]);

  const openTickets = useMemo(() => tickets.filter(t => t.status === "aberto"), [tickets]);
  const blockedItems = useMemo(() => {
    // We'd need all items but for now use client status
    return clients.filter(c => c.status === "em_reposicao").length;
  }, [clients]);

  // Actions
  const handleAddClient = async () => {
    if (!newClient.email || !newClient.plan_id) {
      toast({ title: "Preencha email e plano", variant: "destructive" });
      return;
    }
    const { data: userId } = await supabase.rpc("get_user_id_by_email", { target_email: newClient.email });
    if (!userId) {
      toast({ title: "Usuário não encontrado", variant: "destructive" });
      return;
    }
    const plan = plans.find(p => p.id === newClient.plan_id);
    if (!plan) return;

    const nextBilling = new Date();
    nextBilling.setMonth(nextBilling.getMonth() + 1);

    const { error } = await supabase.from("ct_clients").insert({
      user_id: userId,
      plan_id: plan.id,
      telegram: newClient.telegram || null,
      monthly_value: plan.price,
      next_billing: nextBilling.toISOString().split("T")[0],
      notes: newClient.notes || null,
    } as any);

    if (error) {
      toast({ title: "Erro ao adicionar cliente", description: error.message, variant: "destructive" });
      return;
    }

    // Auto-create items based on plan
    const { data: newClients } = await supabase.from("ct_clients").select("id").eq("user_id", userId).order("created_at", { ascending: false }).limit(1);
    if (newClients?.[0]) {
      const items: any[] = [];
      for (let i = 0; i < plan.profiles_qty; i++) items.push({ ct_client_id: newClients[0].id, type: "perfil" });
      for (let i = 0; i < plan.proxies_qty; i++) items.push({ ct_client_id: newClients[0].id, type: "proxy" });
      for (let i = 0; i < plan.bms_qty; i++) items.push({ ct_client_id: newClients[0].id, type: "bm" });
      for (let i = 0; i < plan.accounts_qty; i++) items.push({ ct_client_id: newClients[0].id, type: "conta" });
      if (items.length) await supabase.from("ct_items").insert(items);
    }

    toast({ title: "Cliente adicionado com sucesso!" });
    setShowNewClient(false);
    setNewClient({ email: "", telegram: "", plan_id: "", notes: "" });
    loadClients();
  };

  const handleAddReplacement = async () => {
    if (!newRep.ct_client_id || !newRep.item_type) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("ct_replacements").insert({
      ct_client_id: newRep.ct_client_id,
      item_type: newRep.item_type,
      reason: newRep.reason || null,
      performed_by: user?.id || null,
    } as any);
    toast({ title: "Reposição registrada!" });
    setShowNewReplacement(false);
    setNewRep({ ct_client_id: "", item_type: "perfil", reason: "" });
    loadReplacements();
  };

  const handleAddTicket = async () => {
    if (!newTicketForm.ct_client_id) return;
    await supabase.from("ct_tickets").insert({
      ct_client_id: newTicketForm.ct_client_id,
      type: newTicketForm.type,
      priority: newTicketForm.priority,
      message: newTicketForm.message || null,
    } as any);
    toast({ title: "Ticket criado!" });
    setShowNewTicket(false);
    setNewTicketForm({ ct_client_id: "", type: "block", priority: "media", message: "" });
    loadTickets();
  };

  const handleResolveTicket = async (id: string) => {
    await supabase.from("ct_tickets").update({ status: "resolvido", resolved_at: new Date().toISOString() } as any).eq("id", id);
    toast({ title: "Ticket resolvido!" });
    loadTickets();
  };

  const handleSavePlan = async (plan: Plan) => {
    const { error } = await supabase.from("ct_plans").update({
      name: plan.name, price: plan.price,
      profiles_qty: plan.profiles_qty, proxies_qty: plan.proxies_qty,
      bms_qty: plan.bms_qty, accounts_qty: plan.accounts_qty,
      replacements_qty: plan.replacements_qty,
    } as any).eq("id", plan.id);
    if (!error) {
      toast({ title: "Plano atualizado!" });
      setEditingPlan(null);
      loadPlans();
    }
  };

  const handleExportCSV = () => {
    const data = filteredClients.map(c => ({
      Nome: c.profile?.full_name || "",
      Telegram: c.telegram || "",
      Plano: c.plan?.name || "",
      Status: c.status,
      "Data Início": c.start_date,
      "Próx. Cobrança": c.next_billing || "",
      "Valor Mensal": c.monthly_value,
      "Total Itens": c.items_count || 0,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(wb, "contingencia_clientes.xlsx");
  };

  const getClientName = (clientId: string) => {
    const c = clients.find(cl => cl.id === clientId);
    return c?.profile?.full_name || c?.telegram || "—";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-white/60">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="size-6 text-blue-400" />
            Contingência Total FBFlix
          </h1>
          <p className="text-sm text-white/50 mt-1">Gerenciamento de assinaturas de estrutura</p>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white/60">Dashboard</TabsTrigger>
          <TabsTrigger value="clientes" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white/60">Clientes</TabsTrigger>
          <TabsTrigger value="planos" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white/60">Planos</TabsTrigger>
          <TabsTrigger value="reposicoes" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white/60">Reposições</TabsTrigger>
          <TabsTrigger value="suporte" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white/60">Suporte</TabsTrigger>
          <TabsTrigger value="financeiro" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-white/60">Financeiro</TabsTrigger>
        </TabsList>

        {/* ========== DASHBOARD ========== */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Assinaturas Ativas", value: activeClients.length, icon: Users, color: "text-emerald-400" },
              { label: "Clientes White", value: whiteClients.length, icon: Package, color: "text-white" },
              { label: "Clientes Black", value: blackClients.length, icon: Zap, color: "text-purple-400" },
              { label: "Reposições (mês)", value: monthReplacements, icon: RefreshCw, color: "text-amber-400" },
              { label: "MRR", value: `R$ ${mrr.toLocaleString("pt-BR")}`, icon: TrendingUp, color: "text-blue-400" },
            ].map((card, i) => (
              <Card key={i} className="bg-white/5 border-white/10">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <card.icon className={`size-5 ${card.color}`} />
                  </div>
                  <div className="text-2xl font-bold text-white">{card.value}</div>
                  <div className="text-xs text-white/50 mt-1">{card.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="bg-amber-500/5 border-amber-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="size-4" /> Alertas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/70">Clientes em reposição</span>
                  <Badge className="bg-amber-500/20 text-amber-400">{blockedItems}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/70">Tickets abertos</span>
                  <Badge className="bg-red-500/20 text-red-400">{openTickets.length}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-blue-500/5 border-blue-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-blue-400 flex items-center gap-2">
                  <BarChart3 className="size-4" /> Distribuição por Plano
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {plans.map(p => {
                  const count = activeClients.filter(c => c.plan_id === p.id).length;
                  return (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <span className="text-white/70">{p.name}</span>
                      <span className="text-white font-medium">{count}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ========== CLIENTES ========== */}
        <TabsContent value="clientes" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/40" />
              <Input
                placeholder="Buscar por nome ou telegram..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
            <Select value={filterTier} onValueChange={setFilterTier}>
              <SelectTrigger className="w-[140px] bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="white">White</SelectItem>
                <SelectItem value="black">Black</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px] bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="em_reposicao">Em Reposição</SelectItem>
                <SelectItem value="suspenso">Suspenso</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setShowNewClient(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="size-4 mr-1" /> Novo Cliente
            </Button>
            <Button onClick={handleExportCSV} variant="outline" className="border-white/10 text-white/70 hover:text-white">
              <Download className="size-4 mr-1" /> Exportar
            </Button>
          </div>

          <Card className="bg-white/5 border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/50">
                    <th className="text-left p-3">Nome / Telegram</th>
                    <th className="text-left p-3">Plano</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Início</th>
                    <th className="text-left p-3">Próx. Cobrança</th>
                    <th className="text-right p-3">Valor</th>
                    <th className="text-center p-3">Itens</th>
                    <th className="text-center p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map(client => (
                    <tr key={client.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-3">
                        <div className="text-white font-medium">{client.profile?.full_name || "—"}</div>
                        {client.telegram && <div className="text-white/40 text-xs">@{client.telegram}</div>}
                      </td>
                      <td className="p-3">
                        {client.plan && (
                          <Badge className={`${tierColors[client.plan.tier]} border text-xs`}>
                            {client.plan.name}
                          </Badge>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge className={`${statusColors[client.status] || statusColors.ativo} border text-xs`}>
                          {client.status === "em_reposicao" ? "Em Reposição" : client.status.charAt(0).toUpperCase() + client.status.slice(1)}
                        </Badge>
                      </td>
                      <td className="p-3 text-white/60">{format(new Date(client.start_date), "dd/MM/yyyy")}</td>
                      <td className="p-3 text-white/60">{client.next_billing ? format(new Date(client.next_billing), "dd/MM/yyyy") : "—"}</td>
                      <td className="p-3 text-right text-emerald-400 font-medium">R$ {client.monthly_value.toFixed(2)}</td>
                      <td className="p-3 text-center text-white/60">{client.items_count}</td>
                      <td className="p-3 text-center">
                        <Button size="sm" variant="ghost" className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10" onClick={() => loadClientStructure(client)}>
                          <Eye className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filteredClients.length === 0 && (
                    <tr><td colSpan={8} className="p-8 text-center text-white/40">Nenhum cliente encontrado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ========== PLANOS ========== */}
        <TabsContent value="planos" className="space-y-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map(plan => {
              const isEditing = editingPlan?.id === plan.id;
              const p = isEditing ? editingPlan! : plan;
              return (
                <Card key={plan.id} className={`border ${plan.tier === "black" ? "bg-purple-500/5 border-purple-500/20" : "bg-white/5 border-white/10"}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base text-white">{isEditing ? (
                        <Input value={p.name} onChange={e => setEditingPlan({ ...p, name: e.target.value })} className="bg-white/10 border-white/20 text-white h-8" />
                      ) : plan.name}</CardTitle>
                      <Badge className={`${tierColors[plan.tier]} border text-xs`}>{plan.tier.toUpperCase()}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {isEditing ? (
                      <>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {(["price", "profiles_qty", "proxies_qty", "bms_qty", "accounts_qty", "replacements_qty"] as const).map(field => (
                            <div key={field}>
                              <Label className="text-white/50 text-xs">{field === "price" ? "Preço (R$)" : field.replace("_qty", "s").replace("_", " ")}</Label>
                              <Input
                                type="number" value={p[field]}
                                onChange={e => setEditingPlan({ ...p, [field]: Number(e.target.value) })}
                                className="bg-white/10 border-white/20 text-white h-8 mt-1"
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 flex-1" onClick={() => handleSavePlan(p)}>
                            <Save className="size-3 mr-1" /> Salvar
                          </Button>
                          <Button size="sm" variant="ghost" className="text-white/50" onClick={() => setEditingPlan(null)}>
                            <X className="size-3" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-emerald-400">R$ {plan.price.toFixed(0)}<span className="text-sm text-white/40">/mês</span></div>
                        <div className="space-y-1 text-xs text-white/60">
                          <div className="flex justify-between"><span>Perfis</span><span className="text-white">{plan.profiles_qty}</span></div>
                          <div className="flex justify-between"><span>Proxies</span><span className="text-white">{plan.proxies_qty}</span></div>
                          <div className="flex justify-between"><span>BMs</span><span className="text-white">{plan.bms_qty}</span></div>
                          <div className="flex justify-between"><span>Contas</span><span className="text-white">{plan.accounts_qty}</span></div>
                          <div className="flex justify-between"><span>Reposições/mês</span><span className="text-white">{plan.replacements_qty}</span></div>
                        </div>
                        <Button size="sm" variant="ghost" className="w-full text-blue-400 hover:text-blue-300 hover:bg-blue-500/10" onClick={() => setEditingPlan({ ...plan })}>
                          <Edit2 className="size-3 mr-1" /> Editar
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ========== REPOSIÇÕES ========== */}
        <TabsContent value="reposicoes" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">Histórico de Reposições</h2>
            <Button onClick={() => setShowNewReplacement(true)} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="size-4 mr-1" /> Nova Reposição
            </Button>
          </div>
          <Card className="bg-white/5 border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/50">
                    <th className="text-left p-3">Cliente</th>
                    <th className="text-left p-3">Data</th>
                    <th className="text-left p-3">Tipo</th>
                    <th className="text-left p-3">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {replacements.map(r => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-3 text-white">{getClientName(r.ct_client_id)}</td>
                      <td className="p-3 text-white/60">{format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}</td>
                      <td className="p-3"><Badge className="bg-blue-500/20 text-blue-400 text-xs">{r.item_type}</Badge></td>
                      <td className="p-3 text-white/60">{r.reason || "—"}</td>
                    </tr>
                  ))}
                  {replacements.length === 0 && (
                    <tr><td colSpan={4} className="p-8 text-center text-white/40">Nenhuma reposição registrada</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ========== SUPORTE ========== */}
        <TabsContent value="suporte" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">Tickets de Suporte</h2>
            <Button onClick={() => setShowNewTicket(true)} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="size-4 mr-1" /> Novo Ticket
            </Button>
          </div>
          <Card className="bg-white/5 border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/50">
                    <th className="text-left p-3">Cliente</th>
                    <th className="text-left p-3">Tipo</th>
                    <th className="text-left p-3">Prioridade</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Mensagem</th>
                    <th className="text-left p-3">Data</th>
                    <th className="text-center p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(t => (
                    <tr key={t.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-3 text-white">{getClientName(t.ct_client_id)}</td>
                      <td className="p-3"><Badge className="bg-white/10 text-white/70 text-xs">{t.type}</Badge></td>
                      <td className="p-3"><Badge className={`${priorityColors[t.priority]} text-xs`}>{t.priority}</Badge></td>
                      <td className="p-3"><Badge className={t.status === "aberto" ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"}>{t.status}</Badge></td>
                      <td className="p-3 text-white/60 max-w-[200px] truncate">{t.message || "—"}</td>
                      <td className="p-3 text-white/60">{format(new Date(t.created_at), "dd/MM/yyyy")}</td>
                      <td className="p-3 text-center">
                        {t.status === "aberto" && (
                          <Button size="sm" variant="ghost" className="text-emerald-400 hover:bg-emerald-500/10" onClick={() => handleResolveTicket(t.id)}>
                            Resolver
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {tickets.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-white/40">Nenhum ticket</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ========== FINANCEIRO ========== */}
        <TabsContent value="financeiro" className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <DollarSign className="size-5 text-emerald-400 mb-2" />
                <div className="text-3xl font-bold text-white">R$ {mrr.toLocaleString("pt-BR")}</div>
                <div className="text-sm text-white/50 mt-1">MRR Total</div>
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <Users className="size-5 text-blue-400 mb-2" />
                <div className="text-3xl font-bold text-white">{activeClients.length}</div>
                <div className="text-sm text-white/50 mt-1">Clientes Ativos</div>
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <AlertTriangle className="size-5 text-red-400 mb-2" />
                <div className="text-3xl font-bold text-white">{clients.filter(c => c.status === "cancelado").length}</div>
                <div className="text-sm text-white/50 mt-1">Churn (cancelados)</div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-sm text-white/70">Receita por Plano</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {plans.map(plan => {
                const count = activeClients.filter(c => c.plan_id === plan.id).length;
                const revenue = count * plan.price;
                const pct = mrr > 0 ? (revenue / mrr) * 100 : 0;
                return (
                  <div key={plan.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-white/70">{plan.name} ({count})</span>
                      <span className="text-emerald-400 font-medium">R$ {revenue.toLocaleString("pt-BR")}</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ========== MODALS ========== */}

      {/* New Client Modal */}
      <Dialog open={showNewClient} onOpenChange={setShowNewClient}>
        <DialogContent className="bg-[#1a1010] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Novo Cliente - Contingência Total</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-white/70">Email do cliente</Label>
              <Input value={newClient.email} onChange={e => setNewClient({ ...newClient, email: e.target.value })} placeholder="email@exemplo.com" className="bg-white/5 border-white/10 text-white mt-1" />
            </div>
            <div>
              <Label className="text-white/70">Telegram</Label>
              <Input value={newClient.telegram} onChange={e => setNewClient({ ...newClient, telegram: e.target.value })} placeholder="@usuario" className="bg-white/5 border-white/10 text-white mt-1" />
            </div>
            <div>
              <Label className="text-white/70">Plano</Label>
              <Select value={newClient.plan_id} onValueChange={v => setNewClient({ ...newClient, plan_id: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — R$ {p.price}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/70">Observações</Label>
              <Textarea value={newClient.notes} onChange={e => setNewClient({ ...newClient, notes: e.target.value })} className="bg-white/5 border-white/10 text-white mt-1" />
            </div>
            <Button onClick={handleAddClient} className="w-full bg-emerald-600 hover:bg-emerald-700">
              <Plus className="size-4 mr-1" /> Adicionar Cliente
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Client Structure Modal */}
      <Dialog open={!!showStructure} onOpenChange={() => setShowStructure(null)}>
        <DialogContent className="bg-[#1a1010] border-white/10 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="size-5 text-blue-400" />
              Estrutura — {showStructure?.profile?.full_name || showStructure?.telegram || "Cliente"}
            </DialogTitle>
          </DialogHeader>
          {showStructure && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`${tierColors[showStructure.plan?.tier || "white"]} border`}>{showStructure.plan?.name}</Badge>
                <Badge className={`${statusColors[showStructure.status]} border`}>{showStructure.status}</Badge>
                <span className="text-white/50 text-sm">R$ {showStructure.monthly_value}/mês</span>
              </div>

              {/* Replacement counter */}
              {showStructure.plan && (
                <div className="bg-white/5 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-sm text-white/70">Reposições este mês</span>
                  <span className="text-white font-bold">
                    {clientReplacements.filter(r => {
                      const d = new Date(r.created_at);
                      const now = new Date();
                      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                    }).length} / {showStructure.plan.replacements_qty}
                  </span>
                </div>
              )}

              {/* Items by type */}
              {(["perfil", "proxy", "bm", "conta"] as const).map(type => {
                const items = clientItems.filter(i => i.type === type);
                if (!items.length) return null;
                return (
                  <div key={type}>
                    <h4 className="text-sm font-semibold text-white/80 mb-2 uppercase">{type === "bm" ? "BMs" : type + "s"} ({items.length})</h4>
                    <div className="space-y-1">
                      {items.map(item => (
                        <div key={item.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 text-sm">
                          <span className="text-white/70">{item.identifier || "Sem identificação"}</span>
                          <Badge className={`${item.status === "ativo" ? "bg-emerald-500/20 text-emerald-400" : item.status === "block" ? "bg-red-500/20 text-red-400" : "bg-zinc-500/20 text-zinc-400"} text-xs`}>
                            {item.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {clientItems.length === 0 && (
                <div className="text-center text-white/40 py-4">Nenhum item cadastrado</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Replacement Modal */}
      <Dialog open={showNewReplacement} onOpenChange={setShowNewReplacement}>
        <DialogContent className="bg-[#1a1010] border-white/10 text-white">
          <DialogHeader><DialogTitle>Registrar Reposição</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-white/70">Cliente</Label>
              <Select value={newRep.ct_client_id} onValueChange={v => setNewRep({ ...newRep, ct_client_id: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {clients.filter(c => c.status === "ativo").map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.profile?.full_name || c.telegram || c.id.slice(0, 8)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/70">Tipo do item</Label>
              <Select value={newRep.item_type} onValueChange={v => setNewRep({ ...newRep, item_type: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="perfil">Perfil</SelectItem>
                  <SelectItem value="proxy">Proxy</SelectItem>
                  <SelectItem value="bm">BM</SelectItem>
                  <SelectItem value="conta">Conta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/70">Motivo</Label>
              <Textarea value={newRep.reason} onChange={e => setNewRep({ ...newRep, reason: e.target.value })} className="bg-white/5 border-white/10 text-white mt-1" />
            </div>
            <Button onClick={handleAddReplacement} className="w-full bg-emerald-600 hover:bg-emerald-700">Registrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Ticket Modal */}
      <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
        <DialogContent className="bg-[#1a1010] border-white/10 text-white">
          <DialogHeader><DialogTitle>Novo Ticket</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-white/70">Cliente</Label>
              <Select value={newTicketForm.ct_client_id} onValueChange={v => setNewTicketForm({ ...newTicketForm, ct_client_id: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.profile?.full_name || c.telegram || c.id.slice(0, 8)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/70">Tipo</Label>
              <Select value={newTicketForm.type} onValueChange={v => setNewTicketForm({ ...newTicketForm, type: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="block">Block</SelectItem>
                  <SelectItem value="proxy">Proxy</SelectItem>
                  <SelectItem value="analise_meta">Análise Meta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/70">Prioridade</Label>
              <Select value={newTicketForm.priority} onValueChange={v => setNewTicketForm({ ...newTicketForm, priority: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/70">Mensagem</Label>
              <Textarea value={newTicketForm.message} onChange={e => setNewTicketForm({ ...newTicketForm, message: e.target.value })} className="bg-white/5 border-white/10 text-white mt-1" />
            </div>
            <Button onClick={handleAddTicket} className="w-full bg-emerald-600 hover:bg-emerald-700">Criar Ticket</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
