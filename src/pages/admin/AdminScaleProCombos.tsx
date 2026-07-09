import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Package, Plus, Trash2, Pencil, UserPlus, UserMinus, ShieldAlert } from "lucide-react";

type PoolType = "perfil" | "bm" | "pagina" | "ad_account";
const TYPE_LABELS: Record<PoolType, string> = {
  perfil: "Perfis",
  bm: "BMs",
  pagina: "Páginas",
  ad_account: "Ad Accounts",
};

type PoolItem = {
  id: string;
  plan_id: string | null;
  type: PoolType;
  identifier: string | null;
  metadata: Record<string, any>;
  status: "available" | "reserved" | "assigned" | "disabled";
  reserved_for_user_id: string | null;
  assigned_ct_client_id: string | null;
  notes: string | null;
  created_at: string;
};

type Plan = { id: string; name: string; profiles_qty: number | null; combo_config: Record<string, number> | null };

export default function AdminScaleProCombos() {
  const qc = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [tab, setTab] = useState<PoolType>("perfil");
  const [editing, setEditing] = useState<Partial<PoolItem> | null>(null);
  const [reserveFor, setReserveFor] = useState<{ item: PoolItem | null; open: boolean }>({ item: null, open: false });

  const { data: plans = [] } = useQuery({
    queryKey: ["ct-plans-combo"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ct_plans")
        .select("id, name, profiles_qty, combo_config")
        .order("price");
      return (data || []) as Plan[];
    },
  });

  useEffect(() => {
    if (!selectedPlan && plans.length) setSelectedPlan(plans[0].id);
  }, [plans, selectedPlan]);

  const currentPlan = plans.find((p) => p.id === selectedPlan);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["ct-pool-items", selectedPlan],
    enabled: !!selectedPlan,
    queryFn: async () => {
      const { data } = await supabase
        .from("ct_pool_items")
        .select("*")
        .eq("plan_id", selectedPlan)
        .order("created_at", { ascending: false });
      return (data || []) as PoolItem[];
    },
  });

  const byType = useMemo(() => {
    const g: Record<PoolType, PoolItem[]> = { perfil: [], bm: [], pagina: [], ad_account: [] };
    for (const it of items) if (g[it.type]) g[it.type].push(it);
    return g;
  }, [items]);

  const stats = (t: PoolType) => {
    const list = byType[t] || [];
    return {
      total: list.length,
      available: list.filter((i) => i.status === "available").length,
      reserved: list.filter((i) => i.status === "reserved").length,
      assigned: list.filter((i) => i.status === "assigned").length,
    };
  };

  const upsert = useMutation({
    mutationFn: async (payload: Partial<PoolItem>) => {
      if (payload.id) {
        const { error } = await supabase
          .from("ct_pool_items")
          .update({
            identifier: payload.identifier,
            metadata: payload.metadata || {},
            notes: payload.notes || null,
            type: payload.type,
          })
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ct_pool_items").insert({
          plan_id: selectedPlan,
          type: payload.type || "perfil",
          identifier: payload.identifier || null,
          metadata: payload.metadata || {},
          notes: payload.notes || null,
          status: "available",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Item salvo no pool");
      qc.invalidateQueries({ queryKey: ["ct-pool-items", selectedPlan] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ct_pool_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item removido");
      qc.invalidateQueries({ queryKey: ["ct-pool-items", selectedPlan] });
    },
  });

  const release = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ct_pool_items")
        .update({ status: "available", reserved_for_user_id: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reserva liberada");
      qc.invalidateQueries({ queryKey: ["ct-pool-items", selectedPlan] });
    },
  });

  const reserve = useMutation({
    mutationFn: async (args: { id: string; userId: string }) => {
      const { error } = await supabase
        .from("ct_pool_items")
        .update({ status: "reserved", reserved_for_user_id: args.userId })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item reservado");
      qc.invalidateQueries({ queryKey: ["ct-pool-items", selectedPlan] });
      setReserveFor({ item: null, open: false });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao reservar"),
  });

  const savePlanConfig = useMutation({
    mutationFn: async (config: Record<string, number>) => {
      const { error } = await supabase
        .from("ct_plans")
        .update({ combo_config: config })
        .eq("id", selectedPlan);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuração do combo salva");
      qc.invalidateQueries({ queryKey: ["ct-plans-combo"] });
    },
  });

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Package className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Combos Scale Pro</h1>
          <p className="text-sm text-muted-foreground">
            Pré-cadastre perfis, BMs, páginas e ad accounts para vinculação automática na ativação do plano
          </p>
        </div>
      </div>

      {/* Seletor de plano + configuração do combo */}
      <div className="rounded-xl border border-border/60 bg-card/40 p-5 space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-[240px]">
            <Label className="text-xs">Plano</Label>
            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
              <SelectTrigger><SelectValue placeholder="Escolha um plano" /></SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {currentPlan && (
            <ComboConfigEditor
              plan={currentPlan}
              onSave={(cfg) => savePlanConfig.mutate(cfg)}
              saving={savePlanConfig.isPending}
            />
          )}
        </div>
      </div>

      {/* Tabs por tipo */}
      {selectedPlan && (
        <Tabs value={tab} onValueChange={(v) => setTab(v as PoolType)}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <TabsList>
              {(Object.keys(TYPE_LABELS) as PoolType[]).map((t) => {
                const s = stats(t);
                return (
                  <TabsTrigger key={t} value={t}>
                    {TYPE_LABELS[t]}
                    <span className="ml-2 text-[10px] opacity-70">
                      {s.available}/{s.total}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <Button size="sm" onClick={() => setEditing({ type: tab, metadata: {} })}>
              <Plus className="size-4 mr-1" /> Adicionar {TYPE_LABELS[tab].toLowerCase()}
            </Button>
          </div>

          {(Object.keys(TYPE_LABELS) as PoolType[]).map((t) => (
            <TabsContent key={t} value={t} className="mt-4">
              <div className="rounded-xl border border-border/60 bg-card/40">
                <div className="grid grid-cols-12 gap-3 text-xs text-muted-foreground px-4 py-2 border-b border-border/40">
                  <div className="col-span-4">Identificador</div>
                  <div className="col-span-3">Metadata</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-3 text-right">Ações</div>
                </div>
                {isLoading && <div className="p-6 text-sm text-muted-foreground">Carregando…</div>}
                {!isLoading && byType[t].length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Nenhum item cadastrado. Clique em "Adicionar" para começar.
                  </div>
                )}
                {byType[t].map((it) => (
                  <div key={it.id} className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-border/30 items-center text-sm">
                    <div className="col-span-4 truncate font-mono text-xs">
                      {it.identifier || <span className="text-muted-foreground italic">sem identificador</span>}
                    </div>
                    <div className="col-span-3 text-xs text-muted-foreground truncate">
                      {Object.keys(it.metadata || {}).length
                        ? Object.keys(it.metadata).join(", ")
                        : <span className="italic">—</span>}
                    </div>
                    <div className="col-span-2">
                      <StatusBadge status={it.status} />
                      {it.reserved_for_user_id && (
                        <div className="text-[10px] text-muted-foreground mt-1 truncate">
                          para: {it.reserved_for_user_id.slice(0, 8)}…
                        </div>
                      )}
                    </div>
                    <div className="col-span-3 flex items-center justify-end gap-1">
                      {it.status === "available" && (
                        <Button size="sm" variant="ghost" onClick={() => setReserveFor({ item: it, open: true })} title="Reservar">
                          <UserPlus className="size-4" />
                        </Button>
                      )}
                      {it.status === "reserved" && (
                        <Button size="sm" variant="ghost" onClick={() => release.mutate(it.id)} title="Liberar reserva">
                          <UserMinus className="size-4" />
                        </Button>
                      )}
                      {it.status !== "assigned" && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(it)} title="Editar">
                            <Pencil className="size-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-400"
                            onClick={() => confirm("Remover este item do pool?") && remove.mutate(it.id)}
                            title="Remover">
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      )}
                      {it.status === "assigned" && (
                        <Badge variant="outline" className="text-[10px]">vinculado</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Modal criar/editar */}
      <ItemFormDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        initial={editing}
        onSave={(data) => upsert.mutate(data)}
        saving={upsert.isPending}
      />

      {/* Modal reservar */}
      <ReserveDialog
        open={reserveFor.open}
        onClose={() => setReserveFor({ item: null, open: false })}
        onConfirm={(userId) => reserveFor.item && reserve.mutate({ id: reserveFor.item.id, userId })}
        saving={reserve.isPending}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    available: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    reserved: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    assigned: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    disabled: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={`text-[10px] ${map[status] || ""}`}>
      {status}
    </Badge>
  );
}

function ComboConfigEditor({
  plan, onSave, saving,
}: { plan: Plan; onSave: (cfg: Record<string, number>) => void; saving: boolean }) {
  const [cfg, setCfg] = useState<Record<string, number>>({
    perfil: plan.combo_config?.perfil ?? plan.profiles_qty ?? 1,
    bm: plan.combo_config?.bm ?? 0,
    pagina: plan.combo_config?.pagina ?? 0,
    ad_account: plan.combo_config?.ad_account ?? 0,
  });
  useEffect(() => {
    setCfg({
      perfil: plan.combo_config?.perfil ?? plan.profiles_qty ?? 1,
      bm: plan.combo_config?.bm ?? 0,
      pagina: plan.combo_config?.pagina ?? 0,
      ad_account: plan.combo_config?.ad_account ?? 0,
    });
  }, [plan.id]);

  return (
    <div className="flex flex-wrap gap-3 items-end flex-1">
      {(Object.keys(TYPE_LABELS) as PoolType[]).map((t) => (
        <div key={t} className="w-24">
          <Label className="text-xs">{TYPE_LABELS[t]}</Label>
          <Input
            type="number"
            min={0}
            value={cfg[t] ?? 0}
            onChange={(e) => setCfg({ ...cfg, [t]: Math.max(0, Number(e.target.value) || 0) })}
          />
        </div>
      ))}
      <Button size="sm" onClick={() => onSave(cfg)} disabled={saving}>
        Salvar combo
      </Button>
    </div>
  );
}

function ItemFormDialog({
  open, onClose, initial, onSave, saving,
}: {
  open: boolean;
  onClose: () => void;
  initial: Partial<PoolItem> | null;
  onSave: (data: Partial<PoolItem>) => void;
  saving: boolean;
}) {
  const [type, setType] = useState<PoolType>((initial?.type as PoolType) || "perfil");
  const [identifier, setIdentifier] = useState(initial?.identifier || "");
  const [metadataText, setMetadataText] = useState(
    initial?.metadata ? JSON.stringify(initial.metadata, null, 2) : "{}",
  );
  const [notes, setNotes] = useState(initial?.notes || "");

  useEffect(() => {
    if (open) {
      setType((initial?.type as PoolType) || "perfil");
      setIdentifier(initial?.identifier || "");
      setMetadataText(initial?.metadata ? JSON.stringify(initial.metadata, null, 2) : "{}");
      setNotes(initial?.notes || "");
    }
  }, [open, initial]);

  const submit = () => {
    let meta: Record<string, any> = {};
    try { meta = metadataText.trim() ? JSON.parse(metadataText) : {}; }
    catch { toast.error("Metadata inválido (JSON)"); return; }
    onSave({
      id: initial?.id,
      type,
      identifier: identifier || null,
      metadata: meta,
      notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Editar item" : "Adicionar ao pool"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as PoolType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABELS) as PoolType[]).map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Identificador (id, link, nome)</Label>
            <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Ex: link da BM, id do perfil" />
          </div>
          <div>
            <Label className="text-xs">Metadata (JSON) — senhas, 2FA, dados extras</Label>
            <Textarea
              value={metadataText}
              onChange={(e) => setMetadataText(e.target.value)}
              rows={5}
              className="font-mono text-xs"
              placeholder='{"senha": "...", "2fa": "...", "email": "..."}'
            />
          </div>
          <div>
            <Label className="text-xs">Observações internas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReserveDialog({
  open, onClose, onConfirm, saving,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (userId: string) => void;
  saving: boolean;
}) {
  const [email, setEmail] = useState("");
  const [resolvedUser, setResolvedUser] = useState<{ user_id: string; full_name: string | null } | null>(null);
  const [searching, setSearching] = useState(false);

  const search = async () => {
    if (!email.trim()) return;
    setSearching(true);
    try {
      const { data: uid } = await supabase.rpc("get_user_id_by_email", { target_email: email.trim() });
      if (!uid) { toast.error("Usuário não encontrado"); setResolvedUser(null); return; }
      const { data: prof } = await supabase.from("profiles").select("user_id, full_name").eq("user_id", uid).maybeSingle();
      setResolvedUser({ user_id: uid as string, full_name: prof?.full_name || null });
    } finally { setSearching(false); }
  };

  useEffect(() => {
    if (!open) { setEmail(""); setResolvedUser(null); }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reservar para cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Email do cliente</Label>
            <div className="flex gap-2">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" />
              <Button size="sm" onClick={search} disabled={searching}>Buscar</Button>
            </div>
          </div>
          {resolvedUser && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
              <div className="font-medium">{resolvedUser.full_name || "Sem nome"}</div>
              <div className="text-xs text-muted-foreground font-mono">{resolvedUser.user_id}</div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            <ShieldAlert className="size-3 inline mr-1" />
            Este item ficará reservado e será vinculado assim que o cliente ativar um plano Scale Pro.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => resolvedUser && onConfirm(resolvedUser.user_id)}
            disabled={!resolvedUser || saving}
          >
            Reservar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}