import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Wrench, RefreshCw, CalendarPlus, Loader2, Search, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface Subscription {
  id: string;
  user_id: string | null;
  name: string | null;
  type: string;
  status: string;
  end_date: string | null;
  raw_data: any;
}

interface LedgerRow {
  id: string;
  type: string;
  amount: number;
  balance_after: number | null;
  description: string | null;
  created_at: string;
}

interface ClientLite {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

interface Props {
  resellerId: string;
  balance: number;
  swapPrice: number;
  dayPrice: number;
  onBalanceChange: (newBalance: number) => void;
}

const DAY_PRESETS = [7, 15, 30];

export default function ResellerMaintenance({
  resellerId,
  balance,
  swapPrice,
  dayPrice,
  onBalanceChange,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [clients, setClients] = useState<Record<string, ClientLite>>({});
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [swapModal, setSwapModal] = useState<Subscription | null>(null);
  const [extendModal, setExtendModal] = useState<Subscription | null>(null);
  const [extendDays, setExtendDays] = useState<number>(15);

  const refresh = async () => {
    setLoading(true);
    const [{ data: s }, { data: l }] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("id,user_id,name,type,status,end_date,raw_data")
        .eq("reseller_id", resellerId)
        .in("type", ["proxyfbflix", "webshare", "proxybr", "proxyfbflix_rotating", "webshare_rotating"])
        .in("status", ["active", "expiring", "grace"])
        .order("end_date", { ascending: true })
        .limit(500),
      supabase
        .from("reseller_credit_ledger")
        .select("id,type,amount,balance_after,description,created_at")
        .eq("reseller_id", resellerId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    const subsData = (s as Subscription[]) || [];
    setSubs(subsData);
    setLedger((l as LedgerRow[]) || []);

    // Load profiles for these client user_ids
    const uids = Array.from(new Set(subsData.map((x) => x.user_id).filter(Boolean))) as string[];
    if (uids.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id,full_name,email")
        .in("user_id", uids);
      const map: Record<string, ClientLite> = {};
      for (const p of (profiles as any[]) || []) {
        map[p.user_id] = { user_id: p.user_id, full_name: p.full_name, email: p.email };
      }
      setClients(map);
    } else {
      setClients({});
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resellerId]);

  const filteredSubs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subs;
    return subs.filter((s) => {
      const c = s.user_id ? clients[s.user_id] : null;
      return (
        (s.name || "").toLowerCase().includes(q) ||
        (c?.full_name || "").toLowerCase().includes(q) ||
        (c?.email || "").toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      );
    });
  }, [subs, search, clients]);

  const callFn = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("reseller-maintenance", { body: payload });
    if (error) {
      let msg = error.message;
      try {
        // @ts-ignore
        const ctx = (error as any).context;
        if (ctx?.text) msg = await ctx.text();
      } catch {}
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const doSwap = async (sub: Subscription) => {
    if (balance < swapPrice) {
      toast.error("Saldo insuficiente. Recarregue seu saldo.");
      return;
    }
    setBusyId(sub.id);
    try {
      const data = await callFn({ action: "swap-ip", subscription_id: sub.id });
      toast.success(`IP trocado. Debitado R$ ${Number(data.charged).toFixed(2)}`);
      onBalanceChange(Number(data.new_balance));
      setSwapModal(null);
      refresh();
    } catch (e: any) {
      toast.error("Erro ao trocar IP: " + (e?.message || e));
    } finally {
      setBusyId(null);
    }
  };

  const doExtend = async (sub: Subscription, days: number) => {
    const cost = dayPrice * days;
    if (balance < cost) {
      toast.error(`Saldo insuficiente. Necessário R$ ${cost.toFixed(2)}`);
      return;
    }
    setBusyId(sub.id);
    try {
      const data = await callFn({ action: "extend-days", subscription_id: sub.id, days });
      toast.success(`+${days} dias adicionados. Debitado R$ ${Number(data.charged).toFixed(2)}`);
      onBalanceChange(Number(data.new_balance));
      setExtendModal(null);
      refresh();
    } catch (e: any) {
      toast.error("Erro ao estender validade: " + (e?.message || e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
            <Wrench className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Manutenção</h2>
            <p className="text-xs text-muted-foreground">
              Troque o IP de proxies dos seus clientes ou adicione dias extras — as ações são debitadas do seu saldo.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-card/60 border border-border/40 px-4 py-2">
          <Wallet className="size-4 text-primary" />
          <div className="text-sm">
            <span className="text-muted-foreground">Saldo:</span>{" "}
            <span className="font-bold text-foreground">R$ {Number(balance).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Preços vigentes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="p-4 bg-card/60 border-border/40">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <RefreshCw className="size-3.5" /> Troca de IP
          </div>
          <div className="mt-1 text-2xl font-bold">R$ {swapPrice.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">Por cada IP trocado (mesmo país/plano)</p>
        </Card>
        <Card className="p-4 bg-card/60 border-border/40">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <CalendarPlus className="size-3.5" /> Dia extra
          </div>
          <div className="mt-1 text-2xl font-bold">R$ {dayPrice.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">Por dia adicionado à validade</p>
        </Card>
      </div>

      <Tabs defaultValue="acoes">
        <TabsList className="bg-card/60 border border-border/40">
          <TabsTrigger value="acoes">Ações</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="acoes" className="mt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, nome do proxy ou ID..."
              className="pl-9 bg-background/40 border-border/40"
            />
          </div>

          <Card className="bg-card/60 border-border/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-muted-foreground text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-3">Cliente</th>
                    <th className="text-left px-4 py-3">Proxy</th>
                    <th className="text-left px-4 py-3">Validade</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10">
                        <Loader2 className="size-5 animate-spin text-primary mx-auto" />
                      </td>
                    </tr>
                  ) : filteredSubs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-muted-foreground">
                        Nenhum proxy ativo dos seus clientes ainda.
                      </td>
                    </tr>
                  ) : (
                    filteredSubs.map((s) => {
                      const c = s.user_id ? clients[s.user_id] : null;
                      const isBusy = busyId === s.id;
                      const endDate = s.end_date ? new Date(s.end_date) : null;
                      const daysLeft = endDate
                        ? Math.ceil((endDate.getTime() - Date.now()) / 86400000)
                        : null;
                      return (
                        <tr key={s.id} className="border-t border-border/30">
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">
                              {c?.full_name || "—"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {c?.email || "sem e-mail"}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{s.name || s.type}</div>
                            <div className="text-xs text-muted-foreground font-mono">
                              #{s.id.slice(0, 8)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {endDate ? (
                              <>
                                <div>{endDate.toLocaleDateString("pt-BR")}</div>
                                <div className={cn(
                                  "text-xs",
                                  daysLeft !== null && daysLeft <= 3 ? "text-red-400" :
                                  daysLeft !== null && daysLeft <= 7 ? "text-yellow-400" :
                                  "text-muted-foreground"
                                )}>
                                  {daysLeft !== null ? (daysLeft >= 0 ? `${daysLeft}d restantes` : `expirado há ${-daysLeft}d`) : "—"}
                                </div>
                              </>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={s.status === "active" ? "default" : "secondary"} className="text-[10px]">
                              {s.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isBusy}
                                onClick={() => setSwapModal(s)}
                                className="border-border/40"
                              >
                                <RefreshCw className="size-3.5 mr-1" /> Trocar IP
                              </Button>
                              <Button
                                size="sm"
                                disabled={isBusy}
                                onClick={() => { setExtendDays(15); setExtendModal(s); }}
                              >
                                <CalendarPlus className="size-3.5 mr-1" /> + Dias
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <Card className="bg-card/60 border-border/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-muted-foreground text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-3">Data</th>
                    <th className="text-left px-4 py-3">Tipo</th>
                    <th className="text-left px-4 py-3">Descrição</th>
                    <th className="text-right px-4 py-3">Valor</th>
                    <th className="text-right px-4 py-3">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-muted-foreground">
                        Sem movimentações ainda.
                      </td>
                    </tr>
                  ) : (
                    ledger.map((l) => {
                      const positive = ["recharge", "adjustment", "refund", "credit"].includes(l.type);
                      return (
                        <tr key={l.id} className="border-t border-border/30">
                          <td className="px-4 py-3 whitespace-nowrap">
                            {new Date(l.created_at).toLocaleString("pt-BR")}
                          </td>
                          <td className="px-4 py-3 capitalize">{l.type}</td>
                          <td className="px-4 py-3 text-muted-foreground">{l.description || "—"}</td>
                          <td className={`text-right px-4 py-3 font-bold ${positive ? "text-green-400" : "text-red-400"}`}>
                            {positive ? "+" : "-"} R$ {Math.abs(Number(l.amount)).toFixed(2)}
                          </td>
                          <td className="text-right px-4 py-3 text-muted-foreground">
                            {l.balance_after != null ? `R$ ${Number(l.balance_after).toFixed(2)}` : "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Swap confirmation */}
      <Dialog open={!!swapModal} onOpenChange={(o) => !o && setSwapModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trocar IP do proxy</DialogTitle>
            <DialogDescription>
              Vamos solicitar um novo IP para <strong>{swapModal?.name || "este proxy"}</strong> mantendo país e plano.
              Um valor de <strong>R$ {swapPrice.toFixed(2)}</strong> será debitado do seu saldo.
            </DialogDescription>
          </DialogHeader>
          <div className="text-xs text-muted-foreground">
            Saldo atual: <strong>R$ {balance.toFixed(2)}</strong> → Após: <strong>R$ {(balance - swapPrice).toFixed(2)}</strong>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSwapModal(null)} disabled={busyId === swapModal?.id}>
              Cancelar
            </Button>
            <Button onClick={() => swapModal && doSwap(swapModal)} disabled={busyId === swapModal?.id || balance < swapPrice}>
              {busyId === swapModal?.id ? <Loader2 className="size-4 animate-spin" /> : "Confirmar troca"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend days */}
      <Dialog open={!!extendModal} onOpenChange={(o) => !o && setExtendModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar dias de validade</DialogTitle>
            <DialogDescription>
              Escolha quantos dias adicionar à validade de <strong>{extendModal?.name || "este proxy"}</strong>.
              Valor por dia: <strong>R$ {dayPrice.toFixed(2)}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {DAY_PRESETS.map((d) => (
                <Button
                  key={d}
                  variant={extendDays === d ? "default" : "outline"}
                  size="sm"
                  onClick={() => setExtendDays(d)}
                >
                  +{d} dias
                </Button>
              ))}
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-muted-foreground">Customizado:</span>
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={extendDays}
                  onChange={(e) => setExtendDays(Math.max(1, Math.min(90, Number(e.target.value) || 1)))}
                  className="w-20 h-8"
                />
              </div>
            </div>

            <div className="rounded-lg bg-muted/30 border border-border/40 p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Dias:</span><strong>+{extendDays}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Custo total:</span><strong>R$ {(dayPrice * extendDays).toFixed(2)}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Saldo após:</span><strong>R$ {(balance - dayPrice * extendDays).toFixed(2)}</strong></div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendModal(null)} disabled={busyId === extendModal?.id}>
              Cancelar
            </Button>
            <Button
              onClick={() => extendModal && doExtend(extendModal, extendDays)}
              disabled={busyId === extendModal?.id || balance < dayPrice * extendDays}
            >
              {busyId === extendModal?.id ? <Loader2 className="size-4 animate-spin" /> : `Adicionar +${extendDays} dias`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}