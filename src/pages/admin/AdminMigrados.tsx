import { useState, useEffect, useMemo } from "react";
import {
  Loader2, Plus, Upload, Search, RefreshCw, Clock, CheckCircle2,
  UserCheck, UserPlus, Trash2, Key, Link2, Mail, Users, AlertCircle,
  Phone, Copy, MessageCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import MigrationStatsCards from "@/components/admin/migration/MigrationStatsCards";

interface EnrichedUser {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  migrated_at: string | null;
  has_account: boolean;
  never_logged_in: boolean;
  profile_complete: boolean;
  profile_data: {
    full_name: string | null;
    cpf: string | null;
    phone: string | null;
    birth_date: string | null;
  } | null;
  last_sign_in: string | null;
  in_tracking: boolean;
  migration_method: string | null;
  contacted: boolean;
  tracking_id: string | null;
}

interface MigrationStats {
  total_users: number;
  pending: number;
  migrated: number;
  direct_registrations: number;
  complete_profiles: number;
}

interface MigrationData {
  pending_users: EnrichedUser[];
  migrated_users: EnrichedUser[];
  direct_users: EnrichedUser[];
  all_users: EnrichedUser[];
  stats: MigrationStats;
}

const formatDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

const MIGRATION_LINK = "https://fbflix.com.br/migrar";
const PLATFORM_URL = "https://fbflix.com.br/auth";

function buildMigrationMessage(email: string, fullName: string | null) {
  const firstName = fullName ? fullName.split(" ")[0] : "";
  return `Olá${firstName ? ` ${firstName}` : ""}! 🎉\n\nAtualizamos nossa plataforma\nSua conta na nova Fbflix está pronta.\n\n🔗 Acesse: ${PLATFORM_URL}\n📧 Email: ${email}\n🔑 Senha: mudar@123\n\n⚠️ Essa é uma senha de acesso único. Após o login, você será solicitado a criar uma nova senha.\n\nQualquer dúvida, estamos à disposição!`;
}

export default function AdminMigrados() {
  const [data, setData] = useState<MigrationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");
  const [search, setSearch] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addName, setAddName] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importLoading, setImportLoading] = useState(false);

  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("migration-login", {
        body: { action: "migration-stats" },
      });
      console.log("migration-stats response:", { result, error });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      // Ensure expected structure
      setData({
        pending_users: result?.pending_users || [],
        migrated_users: result?.migrated_users || [],
        direct_users: result?.direct_users || [],
        all_users: result?.all_users || [],
        stats: result?.stats || { total_users: 0, pending: 0, migrated: 0, direct_registrations: 0, complete_profiles: 0 },
      });
    } catch (err: any) {
      console.error("migration-stats error:", err);
      toast.error("Erro ao carregar dados: " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (!data) return [];
    let items: EnrichedUser[] = [];
    switch (tab) {
      case "pending":
        items = data.pending_users || [];
        break;
      case "migrated":
        items = data.migrated_users || [];
        break;
      case "complete":
        items = (data.all_users || []).filter((u) => u.profile_complete);
        break;
      case "direct":
        items = data.direct_users || [];
        break;
    }
    if (search) {
      const s = search.toLowerCase();
      items = items.filter(
        (i) => i.email?.toLowerCase().includes(s) || (i.full_name || "").toLowerCase().includes(s)
      );
    }
    return items;
  }, [data, tab, search]);

  const counts = useMemo(() => {
    if (!data) return { pending: 0, migrated: 0, complete: 0, direct: 0 };
    return {
      pending: data.stats.pending,
      migrated: data.stats.migrated,
      complete: data.stats.complete_profiles,
      direct: data.stats.direct_registrations,
    };
  }, [data]);

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
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.message || "Erro");
    } finally { setAddLoading(false); }
  }

  async function handleImport() {
    const lines = importText.split(/[\n,;]+/).map((l) => l.trim().toLowerCase()).filter((l) => l && l.includes("@"));
    if (!lines.length) { toast.error("Nenhum email válido encontrado"); return; }
    setImportLoading(true);
    try {
      const rows = lines.map((email) => ({ email, status: "pending" }));
      const { error } = await supabase.from("migration_tracking").upsert(rows, { onConflict: "email", ignoreDuplicates: true });
      if (error) throw error;
      toast.success(`${lines.length} email(s) importados!`);
      setImportText(""); setShowImport(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erro na importação");
    } finally { setImportLoading(false); }
  }

   async function handleGenerateCredentials(email: string, id: string, fullName: string | null) {
    setActionId(id);
    try {
      const { data: result, error } = await supabase.functions.invoke("migration-login", {
        body: { action: "generate-credentials", email },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      
      const msg = buildMigrationMessage(email, fullName);
      await navigator.clipboard.writeText(msg);
      
      const actionLabel = result.action === "created" ? "Conta criada" : "Senha resetada";
      toast.success(`${actionLabel}! Mensagem copiada para área de transferência 📋`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar credenciais");
    } finally { setActionId(null); }
  }

  async function handleToggleContacted(trackingId: string | null, email: string, current: boolean) {
    if (!trackingId) {
      toast.error("Este usuário não está na lista de migração");
      return;
    }
    try {
      const { error } = await supabase
        .from("migration_tracking")
        .update({ contacted: !current })
        .eq("id", trackingId);
      if (error) throw error;
      setData((prev) => {
        if (!prev) return prev;
        const update = (list: EnrichedUser[]) =>
          list.map((u) => (u.tracking_id === trackingId ? { ...u, contacted: !current } : u));
        return {
          ...prev,
          pending_users: update(prev.pending_users),
          migrated_users: update(prev.migrated_users),
          direct_users: update(prev.direct_users),
          all_users: update(prev.all_users),
        };
      });
      toast.success(!current ? "Marcado como contatado ✅" : "Desmarcado");
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar");
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(MIGRATION_LINK);
    toast.success("Link de migração copiado!");
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="size-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Carregando dados de migração...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-2">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-black tracking-tight text-foreground lg:text-5xl">
            Migração de Clientes
          </h1>
          <p className="text-base font-light text-muted-foreground">
            Controle completo de migração da plataforma antiga.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`size-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats */}
      {data && <MigrationStatsCards stats={data.stats} />}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="pending" className="gap-1">
              <Clock className="size-3.5" /> Pendentes ({counts.pending})
            </TabsTrigger>
            <TabsTrigger value="migrated" className="gap-1">
              <CheckCircle2 className="size-3.5" /> Migrados ({counts.migrated})
            </TabsTrigger>
            <TabsTrigger value="complete" className="gap-1">
              <UserCheck className="size-3.5" /> Perfil Completo ({counts.complete})
            </TabsTrigger>
            <TabsTrigger value="direct" className="gap-1">
              <UserPlus className="size-3.5" /> Cadastros Diretos ({counts.direct})
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar email ou nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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

        {/* PENDING TAB - users who never logged in */}
        <TabsContent value="pending" className="mt-4">
          <EmptyOrTable items={filtered} emptyMessage="Nenhum cliente pendente de migração.">
            <TableHeader>
               <TableRow className="border-b border-border bg-muted/50 hover:bg-muted/50">
                 <TH icon={MessageCircle}>Contato</TH>
                 <TH icon={Mail}>Email</TH>
                 <TH icon={Users}>Nome</TH>
                 <TH icon={Phone}>WhatsApp</TH>
                 <TH>Cadastrado</TH>
                 <TH>Conta</TH>
                 <TH className="text-right">Ações</TH>
               </TableRow>
             </TableHeader>
             <TableBody className="divide-y divide-border text-sm">
               {filtered.map((e) => {
                 const phone = e.profile_data?.phone || null;
                 const whatsappUrl = phone ? `https://wa.me/${phone.replace(/\D/g, "")}` : null;
                 return (
                 <TableRow key={e.id} className="transition-colors hover:bg-muted/30">
                   <TableCell className="px-3 py-3 font-mono text-xs text-foreground max-w-[200px] truncate">{e.email}</TableCell>
                   <TableCell className="px-3 py-3 font-medium text-foreground text-sm max-w-[150px] truncate">{e.full_name || "—"}</TableCell>
                   <TableCell className="px-3 py-3">
                     {phone ? (
                       <div className="flex items-center gap-1">
                         <a
                           href={whatsappUrl!}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="font-mono text-xs text-emerald-400 hover:underline"
                         >
                           {phone}
                         </a>
                         <button
                           onClick={() => {
                             navigator.clipboard.writeText(phone);
                             toast.success("Telefone copiado!");
                           }}
                           className="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                           title="Copiar número"
                         >
                           <Copy className="size-3" />
                         </button>
                       </div>
                     ) : (
                       <span className="text-muted-foreground text-xs">—</span>
                     )}
                   </TableCell>
                   <TableCell className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">{formatDate(e.created_at)}</TableCell>
                   <TableCell className="px-3 py-3">
                     {e.has_account ? (
                       <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Criada</Badge>
                     ) : (
                       <Badge variant="outline" className="text-muted-foreground text-xs">Sem conta</Badge>
                     )}
                   </TableCell>
                   <TableCell className="px-3 py-3 text-right">
                     <div className="flex items-center justify-end gap-1">
                       <Button
                         size="sm"
                         variant="outline"
                         className="text-blue-400 border-blue-500/30 hover:bg-blue-500/10 h-7 px-2 text-xs"
                         disabled={actionId === e.id}
                         onClick={() => handleGenerateCredentials(e.email, e.id, e.full_name)}
                       >
                         {actionId === e.id ? <Loader2 className="size-3 animate-spin" /> : <Key className="size-3" />}
                         <span className="ml-1">Credenciais</span>
                       </Button>
                       <Button
                         size="sm"
                         variant="outline"
                         className="text-purple-400 border-purple-500/30 hover:bg-purple-500/10 h-7 px-2 text-xs"
                         onClick={copyLink}
                       >
                         <Link2 className="size-3" />
                         <span className="ml-1">Link</span>
                       </Button>
                     </div>
                   </TableCell>
                 </TableRow>
                 );
               })}
             </TableBody>
          </EmptyOrTable>
        </TabsContent>

        {/* MIGRATED TAB - users who logged in AND came from migration */}
        <TabsContent value="migrated" className="mt-4">
          <EmptyOrTable items={filtered} emptyMessage="Nenhum cliente migrado ainda.">
            <TableHeader>
              <TableRow className="border-b border-border bg-muted/50 hover:bg-muted/50">
                <TH icon={Mail}>Email</TH>
                <TH icon={Users}>Nome</TH>
                <TH>Último Login</TH>
                <TH>Método</TH>
                <TH>Perfil</TH>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border text-sm">
              {filtered.map((e) => (
                <TableRow key={e.id} className="transition-colors hover:bg-muted/30">
                  <TableCell className="px-6 py-4 font-mono text-sm text-foreground">{e.email}</TableCell>
                  <TableCell className="px-6 py-4 font-medium text-foreground">{e.full_name || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap px-6 py-4 text-muted-foreground">{formatDate(e.last_sign_in)}</TableCell>
                  <TableCell className="px-6 py-4">
                    {e.migration_method === "link" ? (
                      <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Via Link</Badge>
                    ) : e.migration_method === "excel" ? (
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Via Planilha</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Rastreado</Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    {e.profile_complete ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Completo</Badge>
                    ) : (
                      <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Parcial</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </EmptyOrTable>
        </TabsContent>

        {/* COMPLETE PROFILE TAB */}
        <TabsContent value="complete" className="mt-4">
          <EmptyOrTable items={filtered} emptyMessage="Nenhum cliente com perfil completo encontrado.">
            <TableHeader>
              <TableRow className="border-b border-border bg-muted/50 hover:bg-muted/50">
                <TH icon={Mail}>Email</TH>
                <TH>Nome</TH>
                <TH>CPF</TH>
                <TH>Telefone</TH>
                <TH>Nascimento</TH>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border text-sm">
              {filtered.map((e) => (
                <TableRow key={e.id} className="transition-colors hover:bg-muted/30">
                  <TableCell className="px-6 py-4 font-mono text-sm text-foreground">{e.email}</TableCell>
                  <TableCell className="px-6 py-4 font-medium text-foreground">{e.profile_data?.full_name || e.full_name || "—"}</TableCell>
                  <TableCell className="px-6 py-4 text-muted-foreground">{e.profile_data?.cpf || "—"}</TableCell>
                  <TableCell className="px-6 py-4 text-muted-foreground">{e.profile_data?.phone || "—"}</TableCell>
                  <TableCell className="px-6 py-4 text-muted-foreground">{e.profile_data?.birth_date || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </EmptyOrTable>
        </TabsContent>

        {/* DIRECT REGISTRATIONS TAB */}
        <TabsContent value="direct" className="mt-4">
          <EmptyOrTable items={filtered} emptyMessage="Nenhum cadastro direto encontrado.">
            <TableHeader>
              <TableRow className="border-b border-border bg-muted/50 hover:bg-muted/50">
                <TH icon={Mail}>Email</TH>
                <TH icon={Users}>Nome</TH>
                <TH>Cadastrado em</TH>
                <TH>Último Login</TH>
                <TH>Perfil</TH>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border text-sm">
              {filtered.map((e) => (
                <TableRow key={e.id} className="transition-colors hover:bg-muted/30">
                  <TableCell className="px-6 py-4 font-mono text-sm text-foreground">{e.email}</TableCell>
                  <TableCell className="px-6 py-4 font-medium text-foreground">{e.full_name || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap px-6 py-4 text-muted-foreground">{formatDate(e.created_at)}</TableCell>
                  <TableCell className="whitespace-nowrap px-6 py-4 text-muted-foreground">{formatDate(e.last_sign_in)}</TableCell>
                  <TableCell className="px-6 py-4">
                    {e.profile_complete ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Completo</Badge>
                    ) : (
                      <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Parcial</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </EmptyOrTable>
        </TabsContent>
      </Tabs>

      {/* Add manual dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Adicionar Cliente à Migração</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <Input placeholder="Email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} />
            <Input placeholder="Nome (opcional)" value={addName} onChange={(e) => setAddName(e.target.value)} />
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
            onChange={(e) => setImportText(e.target.value)}
          />
          <DialogFooter>
            <Button onClick={handleImport} disabled={importLoading}>
              {importLoading ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              Importar ({importText.split(/[\n,;]+/).filter((l) => l.trim().includes("@")).length} emails)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Helper components =====

function TH({ children, icon: Icon, className = "" }: { children: React.ReactNode; icon?: any; className?: string }) {
  return (
    <TableHead className={`px-3 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${className}`}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="size-3.5" />}
        {children}
      </div>
    </TableHead>
  );
}

function EmptyOrTable({ items, emptyMessage, children }: { items: any[]; emptyMessage: string; children: React.ReactNode }) {
  if (!items.length) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center">
        <AlertCircle className="mx-auto size-12 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground text-lg">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="glass-panel overflow-hidden rounded-2xl">
      <div className="overflow-x-auto">
        <Table className="min-w-[900px]">{children}</Table>
      </div>
    </div>
  );
}
