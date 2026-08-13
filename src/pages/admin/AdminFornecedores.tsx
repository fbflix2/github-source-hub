import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Plus, Loader2, Copy, RefreshCw, Power, Search, ExternalLink } from "lucide-react";

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

export default function AdminFornecedores() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [search, setSearch] = useState("");

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
    const { error } = await supabase.from("suppliers").insert({
      name: newName.trim(),
      notes: newNotes.trim() || null,
      access_token: genToken(),
      status: "active",
    });
    setCreating(false);
    if (error) return toast.error("Erro ao criar: " + error.message);
    toast.success("Fornecedor criado com sucesso!");
    setNewName(""); setNewNotes("");
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
