import { useState, useEffect, useRef } from "react";
import { Loader2, Users, ArrowDownRight, Mail, Clock, AlertCircle, CheckCircle2, Plus, Upload, Trash2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface TrackingEntry {
  id: string;
  email: string;
  full_name: string | null;
  status: string;
  migrated_at: string | null;
  created_at: string;
}

const formatDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

export default function AdminMigrados() {
  const [entries, setEntries] = useState<TrackingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");
  const [search, setSearch] = useState("");

  // Add manual modal
  const [showAdd, setShowAdd] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addName, setAddName] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // Import modal
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importLoading, setImportLoading] = useState(false);

  // Mark as migrated loading
  const [markingId, setMarkingId] = useState<string | null>(null);

  useEffect(() => { fetchEntries(); }, []);

  async function fetchEntries() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("migration_tracking")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setEntries((data as any[]) || []);
    } catch (err: any) {
      toast.error("Erro ao carregar: " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  }

  const pending = entries.filter(e => e.status === "pending");
  const migrated = entries.filter(e => e.status === "migrated");

  const filtered = (tab === "pending" ? pending : migrated).filter(e => {
    if (!search) return true;
    const s = search.toLowerCase();
    return e.email.toLowerCase().includes(s) || (e.full_name || "").toLowerCase().includes(s);
  });

  async function handleAddManual() {
    if (!addEmail.trim()) { toast.error("Digite o email"); return; }
    setAddLoading(true);
    try {
      const { error } = await supabase.from("migration_tracking").insert({
        email: addEmail.trim().toLowerCase(),
        full_name: addName.trim() || null,
        status: "pending",
      });
      if (error) {
        if (error.code === "23505") toast.error("Email já existe na lista");
        else throw error;
      } else {
        toast.success("Adicionado!");
        setAddEmail(""); setAddName(""); setShowAdd(false);
        fetchEntries();
      }
    } catch (err: any) {
      toast.error(err.message || "Erro");
    } finally { setAddLoading(false); }
  }

  async function handleImport() {
    const lines = importText.split(/[\n,;]+/).map(l => l.trim().toLowerCase()).filter(l => l && l.includes("@"));
    if (!lines.length) { toast.error("Nenhum email válido encontrado"); return; }
    setImportLoading(true);
    try {
      const rows = lines.map(email => ({ email, status: "pending" }));
      const { error } = await supabase.from("migration_tracking").upsert(rows, { onConflict: "email", ignoreDuplicates: true });
      if (error) throw error;
      toast.success(`${lines.length} email(s) importados!`);
      setImportText(""); setShowImport(false);
      fetchEntries();
    } catch (err: any) {
      toast.error(err.message || "Erro na importação");
    } finally { setImportLoading(false); }
  }

  async function handleMarkMigrated(id: string) {
    setMarkingId(id);
    try {
      const { error } = await supabase.from("migration_tracking")
        .update({ status: "migrated", migrated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      toast.success("Marcado como migrado!");
      fetchEntries();
    } catch (err: any) {
      toast.error(err.message || "Erro");
    } finally { setMarkingId(null); }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase.from("migration_tracking").delete().eq("id", id);
      if (error) throw error;
      toast.success("Removido!");
      fetchEntries();
    } catch (err: any) {
      toast.error(err.message || "Erro");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 py-2">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-black tracking-tight text-foreground lg:text-5xl">
            Migração de Clientes
          </h1>
          <p className="text-base font-light text-muted-foreground">
            Controle de clientes da plataforma antiga.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
            <Clock className="size-4 text-amber-400" />
            <span className="font-bold text-amber-400">{pending.length}</span>
            <span className="text-muted-foreground">pendentes</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
            <CheckCircle2 className="size-4 text-emerald-400" />
            <span className="font-bold text-emerald-400">{migrated.length}</span>
            <span className="text-muted-foreground">migrados</span>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="pending">Pendentes ({pending.length})</TabsTrigger>
            <TabsTrigger value="migrated">Migrados ({migrated.length})</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 w-56"
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
              <Plus className="size-4 mr-1" /> Adicionar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
              <Upload className="size-4 mr-1" /> Importar
            </Button>
          </div>
        </div>

        <TabsContent value="pending" className="mt-4">
          <RenderTable
            items={filtered}
            showMigrate
            onMigrate={handleMarkMigrated}
            onDelete={handleDelete}
            markingId={markingId}
          />
        </TabsContent>
        <TabsContent value="migrated" className="mt-4">
          <RenderTable items={filtered} onDelete={handleDelete} markingId={null} />
        </TabsContent>
      </Tabs>

      {/* Add manual dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Adicionar Cliente</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <Input placeholder="Email" value={addEmail} onChange={e => setAddEmail(e.target.value)} />
            <Input placeholder="Nome (opcional)" value={addName} onChange={e => setAddName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={handleAddManual} disabled={addLoading}>
              {addLoading ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Importar Emails</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Cole os emails abaixo (um por linha, ou separados por vírgula):</p>
          <Textarea
            rows={8}
            placeholder={"email1@exemplo.com\nemail2@exemplo.com\nemail3@exemplo.com"}
            value={importText}
            onChange={e => setImportText(e.target.value)}
          />
          <DialogFooter>
            <Button onClick={handleImport} disabled={importLoading}>
              {importLoading ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              Importar ({importText.split(/[\n,;]+/).filter(l => l.trim().includes("@")).length} emails)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RenderTable({ items, showMigrate, onMigrate, onDelete, markingId }: {
  items: TrackingEntry[];
  showMigrate?: boolean;
  onMigrate?: (id: string) => void;
  onDelete: (id: string) => void;
  markingId: string | null;
}) {
  if (!items.length) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center">
        <AlertCircle className="mx-auto size-12 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground text-lg">Nenhum registro encontrado.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel overflow-hidden rounded-2xl">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border bg-muted/50 hover:bg-muted/50">
              <TableHead className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <div className="flex items-center gap-2"><Mail className="size-3.5" /> Email</div>
              </TableHead>
              <TableHead className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <div className="flex items-center gap-2"><Users className="size-3.5" /> Nome</div>
              </TableHead>
              <TableHead className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {showMigrate ? "Adicionado em" : "Migrado em"}
              </TableHead>
              <TableHead className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border text-sm">
            {items.map(e => (
              <TableRow key={e.id} className="transition-colors hover:bg-muted/30">
                <TableCell className="px-6 py-4 font-mono text-sm text-foreground">{e.email}</TableCell>
                <TableCell className="px-6 py-4 font-medium text-foreground">{e.full_name || "—"}</TableCell>
                <TableCell className="whitespace-nowrap px-6 py-4 text-muted-foreground">
                  {formatDate(showMigrate ? e.created_at : e.migrated_at)}
                </TableCell>
                <TableCell className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {showMigrate && onMigrate && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                        disabled={markingId === e.id}
                        onClick={() => onMigrate(e.id)}
                      >
                        {markingId === e.id ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                        <span className="ml-1">Migrado</span>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => onDelete(e.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
