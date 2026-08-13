import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Users, Plus, Loader2, Copy, RefreshCw, Power, Search, ExternalLink, CheckCircle2, Send, Rocket } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  access_token: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

const PORTAL_URL = `${window.location.origin}/fornecedor/portal`;
const genToken = () => Math.random().toString(36).substring(2, 10).toUpperCase();

const onboardingMessage = (name: string, token: string) =>
`Olá ${name}! Seu acesso de fornecedor parceiro FBFLIX está liberado 🚀

1) Acesse: ${PORTAL_URL}
2) Token de acesso: ${token}
3) Cadastre sua forma de pagamento (PIX ou conta bancária) na aba Pagamentos.
4) Envie seus itens (perfil, BM ou página) na aba Estoque → Cadastrar item, informando o valor combinado.
5) Nossa equipe revisa cada item. Aprovado, ele entra no estoque da loja e você acompanha vendas e valores a receber pelo próprio painel.

Guarde o token com segurança: ele é a sua senha de acesso.`;

export default function AdminFornecedores() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [search, setSearch] = useState("");
  const [onboarding, setOnboarding] = useState<Supplier | null>(null);

  const fetchSuppliers = async () => {
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name, access_token, status, notes, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar fornecedores: " + error.message);
    setSuppliers((data as Supplier[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchSuppliers(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return toast.error("Informe o nome do fornecedor");
    setCreating(true);
    const token = genToken();
    const { data, error } = await supabase.from("suppliers").insert({
      name: newName.trim(),
      notes: newNotes.trim() || null,
      access_token: token,
      status: "active",
    }).select().single();
    setCreating(false);
    if (error) return toast.error("Erro ao criar: " + error.message);
    toast.success("Fornecedor criado com sucesso!");
    setNewName(""); setNewNotes("");
    if (data) setOnboarding(data as Supplier);
    fetchSuppliers();
  };

  const regenerateToken = async (s: Supplier) => {
    if (!confirm(`Gerar novo token para ${s.name}? O token antigo deixará de funcionar.`)) return;
    const token = genToken();
    const { error } = await supabase.from("suppliers").update({ access_token: token }).eq("id", s.id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Novo token gerado");
    fetchSuppliers();
  };

  const toggleStatus = async (s: Supplier) => {
    const next = s.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("suppliers").update({ status: next }).eq("id", s.id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success(next === "active" ? "Fornecedor ativado" : "Fornecedor desativado");
    fetchSuppliers();
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.access_token || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 p-1">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-foreground">Fornecedores</h1>
            <p className="text-muted-foreground text-sm">Cadastro, tokens de acesso e status dos parceiros.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{suppliers.filter(s => s.status === "active").length} ativos</Badge>
          <Badge variant="outline">{suppliers.length} total</Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" /> Novo Fornecedor
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 flex flex-col md:flex-row items-end gap-3">
          <div className="flex-1 space-y-2 w-full">
            <label className="text-sm text-muted-foreground">Nome</label>
            <Input placeholder="Ex: Fornecedor de Perfis VIP" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div className="flex-1 space-y-2 w-full">
            <label className="text-sm text-muted-foreground">Observações (opcional)</label>
            <Input placeholder="Ex: contato via WhatsApp" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
          </div>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Criar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle className="text-lg">Lista de Fornecedores</CardTitle>
          <div className="relative w-full max-w-xs">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nome ou token..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <p className="p-10 text-center text-muted-foreground">Nenhum fornecedor encontrado.</p>
          ) : (
            <div className="divide-y">
              {filtered.map((s) => (
                <div key={s.id} className="p-4 flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate">{s.name}</p>
                      <Badge variant={s.status === "active" ? "default" : "secondary"}>
                        {s.status === "active" ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    {s.notes && <p className="text-xs text-muted-foreground truncate">{s.notes}</p>}
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Criado em {new Date(s.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="px-3 py-1.5 rounded-md bg-muted text-sm font-mono tracking-widest">
                      {s.access_token || "SEM TOKEN"}
                    </code>
                    <Button size="sm" variant="outline" onClick={() => copy(s.access_token || "", "Token")} disabled={!s.access_token}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => copy(`${PORTAL_URL}\nToken: ${s.access_token || ""}`, "Link + token")}>
                      <ExternalLink className="h-4 w-4 mr-1" /> Link
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => regenerateToken(s)}>
                      <RefreshCw className="h-4 w-4 mr-1" /> Token
                    </Button>
                    <Button size="sm" variant={s.status === "active" ? "destructive" : "default"} onClick={() => toggleStatus(s)}>
                      <Power className="h-4 w-4 mr-1" /> {s.status === "active" ? "Desativar" : "Ativar"}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setOnboarding(s)}>
                      <Rocket className="h-4 w-4 mr-1" /> Onboarding
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!onboarding} onOpenChange={(o) => !o && setOnboarding(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" /> Onboarding do fornecedor
            </DialogTitle>
            <DialogDescription>
              Envie estas instruções para {onboarding?.name} começar a cadastrar itens.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border p-3 space-y-2 bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Link do portal</span>
                <Button size="sm" variant="ghost" onClick={() => copy(PORTAL_URL, "Link")}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <code className="text-xs break-all">{PORTAL_URL}</code>
              <div className="flex items-center justify-between gap-2 pt-2 border-t">
                <span className="text-xs text-muted-foreground">Token de acesso</span>
                <Button size="sm" variant="ghost" onClick={() => copy(onboarding?.access_token || "", "Token")}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <code className="text-sm font-mono tracking-widest">{onboarding?.access_token || "SEM TOKEN"}</code>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Checklist do parceiro</p>
              {[
                "Entrar no portal usando o token (funciona sem e-mail e sem senha).",
                "Cadastrar a forma de pagamento na aba Pagamentos (PIX ou conta bancária).",
                "Cadastrar o primeiro item na aba Estoque → Cadastrar item.",
                "Informar o valor combinado por item para o repasse.",
                "Acompanhar aprovação, vendas e valores a receber pelo painel.",
              ].map((t) => (
                <div key={t} className="flex gap-2 items-start text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> {t}
                </div>
              ))}
            </div>

            <Button
              className="w-full"
              onClick={() => copy(onboardingMessage(onboarding?.name || "", onboarding?.access_token || ""), "Mensagem de boas-vindas")}
            >
              <Send className="h-4 w-4 mr-2" /> Copiar mensagem de boas-vindas
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
