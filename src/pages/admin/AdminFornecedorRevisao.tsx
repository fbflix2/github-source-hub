import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, CheckCircle2, XCircle, Search, RefreshCw, PackageCheck, Clock, DollarSign } from "lucide-react";

interface Submission {
  id: string;
  supplier_id: string;
  type: string;
  name: string;
  identification: string | null;
  identification_link: string | null;
  data: any;
  payout_amount: number;
  status: string;
  reject_reason: string | null;
  stock_item_id: string | null;
  sold_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export default function AdminFornecedorRevisao() {
  const [rows, setRows] = useState<Submission[]>([]);
  const [suppliers, setSuppliers] = useState<Record<string, string>>({});
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const [detail, setDetail] = useState<Submission | null>(null);
  const [folder, setFolder] = useState<string>("");
  const [rejectReason, setRejectReason] = useState("");

  const load = async () => {
    setLoading(true);
    const [subs, sups, flds] = await Promise.all([
      supabase.from("supplier_submissions").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("suppliers").select("id, name"),
      supabase.from("stock_folders").select("id, name").is("deleted_at", null).order("name"),
    ]);
    setRows((subs.data as any) ?? []);
    setSuppliers(Object.fromEntries((sups.data ?? []).map((s: any) => [s.id, s.name])));
    setFolders((flds.data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!search) return true;
      const t = search.toLowerCase();
      return (
        r.name.toLowerCase().includes(t) ||
        (r.identification || "").toLowerCase().includes(t) ||
        (suppliers[r.supplier_id] || "").toLowerCase().includes(t)
      );
    });
  }, [rows, statusFilter, search, suppliers]);

  const approve = async (s: Submission) => {
    if (!folder) { toast.error("Selecione a pasta de destino"); return; }
    setBusy(s.id);
    const { data: created, error } = await supabase
      .from("stock_items")
      .insert({
        type: s.type,
        name: s.name,
        identification: s.identification,
        identification_link: s.identification_link,
        status: "aguardando",
        folder,
        data: { ...(s.data || {}), supplier_id: s.supplier_id, supplier_submission_id: s.id },
      })
      .select("id")
      .single();

    if (error || !created) {
      setBusy(null);
      toast.error("Erro ao criar item: " + (error?.message || ""));
      return;
    }

    const { error: upErr } = await supabase
      .from("supplier_submissions")
      .update({
        status: "approved",
        stock_item_id: created.id,
        reviewed_at: new Date().toISOString(),
        reject_reason: null,
      })
      .eq("id", s.id);
    setBusy(null);
    if (upErr) { toast.error(upErr.message); return; }
    toast.success("Item aprovado e enviado ao estoque!");
    setDetail(null);
    load();
  };

  const reject = async (s: Submission) => {
    if (!rejectReason.trim()) { toast.error("Informe o motivo da recusa"); return; }
    setBusy(s.id);
    const { error } = await supabase
      .from("supplier_submissions")
      .update({ status: "rejected", reject_reason: rejectReason.trim(), reviewed_at: new Date().toISOString() })
      .eq("id", s.id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Item recusado.");
    setRejectReason("");
    setDetail(null);
    load();
  };

  const togglePaid = async (s: Submission) => {
    const { error } = await supabase
      .from("supplier_submissions")
      .update({ paid_at: s.paid_at ? null : new Date().toISOString() })
      .eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success(s.paid_at ? "Marcado como não pago" : "Marcado como pago");
    load();
  };

  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const dueTotal = rows.filter((r) => r.status === "approved" && !r.paid_at)
    .reduce((sum, r) => sum + Number(r.payout_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Revisão de Fornecedores</h1>
        <p className="text-sm text-muted-foreground">Itens enviados pelos fornecedores parceiros aguardando aprovação para o estoque.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2"><Clock className="size-4 text-yellow-400" />
            <span className="text-sm text-muted-foreground">Aguardando revisão</span></div>
          <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
        </div>
        <div className="glass-panel rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2"><PackageCheck className="size-4 text-emerald-400" />
            <span className="text-sm text-muted-foreground">Aprovados</span></div>
          <p className="text-2xl font-bold text-foreground">{rows.filter(r => r.status === "approved").length}</p>
        </div>
        <div className="glass-panel rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2"><DollarSign className="size-4 text-primary" />
            <span className="text-sm text-muted-foreground">A pagar aos fornecedores</span></div>
          <p className="text-2xl font-bold text-foreground">R$ {dueTotal.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por item, ID ou fornecedor" className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Aguardando</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="rejected">Recusados</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={load} className="gap-2"><RefreshCw className="size-4" /> Atualizar</Button>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">Nenhum item nesta visão.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <div key={s.id} className="glass-panel rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-foreground truncate">{s.name}</p>
                  <Badge variant="outline" className="text-[10px] uppercase">{s.type}</Badge>
                  <Badge variant="outline" className="text-[10px]">{suppliers[s.supplier_id] || "Fornecedor"}</Badge>
                  {s.paid_at && <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">Pago</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {new Date(s.created_at).toLocaleString("pt-BR")}
                  {s.identification ? ` • ID ${s.identification}` : ""}
                  {s.reject_reason ? ` • Recusado: ${s.reject_reason}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-bold text-foreground">R$ {Number(s.payout_amount || 0).toFixed(2)}</span>
                {s.status === "approved" && (
                  <Button size="sm" variant="outline" onClick={() => togglePaid(s)}>
                    {s.paid_at ? "Desfazer pago" : "Marcar pago"}
                  </Button>
                )}
                <Button size="sm" onClick={() => { setDetail(s); setFolder(""); setRejectReason(""); }}>
                  Revisar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.name}</DialogTitle>
            <DialogDescription>
              Enviado por {detail ? suppliers[detail.supplier_id] : ""} • {detail?.type}
            </DialogDescription>
          </DialogHeader>

          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {Object.entries(detail.data || {})
                  .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
                  .map(([k, v]) => (
                    <div key={k} className="rounded-lg border border-border p-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</p>
                      <p className="text-foreground break-all">{String(v)}</p>
                    </div>
                  ))}
                {detail.identification_link && (
                  <div className="rounded-lg border border-border p-2 col-span-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Link</p>
                    <a href={detail.identification_link} target="_blank" rel="noreferrer" className="text-primary break-all">
                      {detail.identification_link}
                    </a>
                  </div>
                )}
              </div>

              {detail.status === "pending" && (
                <>
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Pasta de destino</p>
                    <Select value={folder} onValueChange={setFolder}>
                      <SelectTrigger><SelectValue placeholder="Selecione a pasta" /></SelectTrigger>
                      <SelectContent>
                        {folders.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Motivo, caso vá recusar o item" className="min-h-[70px]" />

                  <div className="flex justify-end gap-2">
                    <Button variant="destructive" disabled={busy === detail.id} onClick={() => reject(detail)} className="gap-2">
                      <XCircle className="size-4" /> Recusar
                    </Button>
                    <Button disabled={busy === detail.id} onClick={() => approve(detail)} className="gap-2">
                      {busy === detail.id ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                      Aprovar e enviar ao estoque
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}