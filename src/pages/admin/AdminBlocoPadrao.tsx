import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText, Upload, Trash2, Star, Plus, Eye, Copy, Info } from "lucide-react";

interface BlockTemplate {
  id: string;
  name: string;
  content: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

const PLACEHOLDERS = [
  { tag: "{{nomePerfil}}", desc: "Nome do perfil" },
  { tag: "{{emailAcesso}}", desc: "Email de acesso" },
  { tag: "{{emailAlternativo}}", desc: "Email alternativo" },
  { tag: "{{senha}}", desc: "Senha" },
  { tag: "{{senhaEmail}}", desc: "Senha do e-mail" },
  { tag: "{{token2fa}}", desc: "Código 2FA" },
  { tag: "{{dataNascimento}}", desc: "Data de nascimento" },
  { tag: "{{genero}}", desc: "Gênero" },
  { tag: "{{tempoPlataforma}}", desc: "Tempo de plataforma" },
  { tag: "{{statusAtual}}", desc: "Status atual" },
  { tag: "{{descricao}}", desc: "Descrição" },
  { tag: "{{cookies}}", desc: "Cookies" },
  { tag: "{{linkDocumento}}", desc: "Link do documento" },
  { tag: "{{linkPerfil}}", desc: "Link do perfil (blocagem)" },
  { tag: "{{idPerfil}}", desc: "ID do perfil (blocagem)" },
  { tag: "{{pedido}}", desc: "Código do pedido" },
  { tag: "{{data}}", desc: "Data da compra" },
  { tag: "{{nomeProduto}}", desc: "Nome do produto" },
];

const SAMPLE_DATA: Record<string, string> = {
  "{{nomePerfil}}": "João Silva",
  "{{emailAcesso}}": "joao@email.com",
  "{{emailAlternativo}}": "joao2@email.com",
  "{{senha}}": "MinhaSenh@123",
  "{{senhaEmail}}": "SenhaEmail@456",
  "{{token2fa}}": "ABCD1234EFGH",
  "{{dataNascimento}}": "15/03/1995",
  "{{genero}}": "Masculino",
  "{{tempoPlataforma}}": "2 anos",
  "{{statusAtual}}": "Ativo",
  "{{descricao}}": "Perfil premium com acesso completo",
  "{{cookies}}": "[cookies_data]",
  "{{linkDocumento}}": "https://exemplo.com/doc.pdf",
  "{{linkPerfil}}": "https://facebook.com/joaosilva",
  "{{idPerfil}}": "100045678901234",
  "{{pedido}}": "PED-00123",
  "{{data}}": "26/02/2026",
  "{{nomeProduto}}": "Perfil Premium Netflix",
};

export default function AdminBlocoPadrao() {
  const [templates, setTemplates] = useState<BlockTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("block_templates" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setTemplates(data as any);
    setLoading(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".txt")) {
      toast.error("Apenas arquivos .txt são aceitos");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setContent(ev.target?.result as string || "");
      if (!name) setName(file.name.replace(".txt", ""));
      toast.success("Arquivo carregado!");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!name.trim() || !content.trim()) {
      toast.error("Preencha o nome e o conteúdo do template");
      return;
    }

    if (editingId) {
      const { error } = await supabase
        .from("block_templates" as any)
        .update({ name: name.trim(), content: content.trim() } as any)
        .eq("id", editingId);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Template atualizado!");
    } else {
      const { error } = await supabase
        .from("block_templates" as any)
        .insert({ name: name.trim(), content: content.trim(), is_default: templates.length === 0 } as any);
      if (error) { toast.error("Erro ao salvar"); return; }
      toast.success("Template criado!");
    }

    setName("");
    setContent("");
    setEditingId(null);
    fetchTemplates();
  };

  const handleSetDefault = async (id: string) => {
    const { error } = await supabase
      .from("block_templates" as any)
      .update({ is_default: true } as any)
      .eq("id", id);
    if (error) { toast.error("Erro ao definir padrão"); return; }
    toast.success("Template definido como padrão!");
    fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("block_templates" as any)
      .delete()
      .eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Template excluído!");
    fetchTemplates();
  };

  const handleEdit = (t: BlockTemplate) => {
    setEditingId(t.id);
    setName(t.name);
    setContent(t.content);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getPreview = () => {
    let result = content;
    for (const [key, val] of Object.entries(SAMPLE_DATA)) {
      result = result.split(key).join(val);
    }
    return result;
  };

  const copyPlaceholder = (tag: string) => {
    navigator.clipboard.writeText(tag);
    toast.success(`${tag} copiado!`);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Bloco Padrão</h1>
        <p className="text-sm text-muted-foreground">Gerencie o modelo de download dos perfis vendidos</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Editor */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-white/10 bg-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="size-4" />
                {editingId ? "Editar Template" : "Novo Template"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Nome do template"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex-1"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="size-4 mr-1" /> Upload .txt
                </Button>
              </div>

              <Textarea
                placeholder="Cole ou digite o conteúdo do template aqui. Use os placeholders como {{emailAcesso}}, {{senha}}, etc."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[250px] font-mono text-xs"
              />

              <div className="flex gap-2">
                <Button onClick={handleSave} className="flex-1">
                  {editingId ? "Atualizar" : "Salvar"} Template
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  <Eye className="size-4 mr-1" /> {showPreview ? "Ocultar" : "Preview"}
                </Button>
                {editingId && (
                  <Button variant="ghost" onClick={() => { setEditingId(null); setName(""); setContent(""); }}>
                    Cancelar
                  </Button>
                )}
              </div>

              {showPreview && content && (
                <div className="rounded-lg border border-white/10 bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Preview com dados de exemplo:</p>
                  <pre className="whitespace-pre-wrap text-xs font-mono text-foreground">{getPreview()}</pre>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Templates list */}
          <Card className="border-white/10 bg-card">
            <CardHeader>
              <CardTitle className="text-base">Templates Salvos</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum template criado ainda.</p>
              ) : (
                <div className="space-y-3">
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-muted/20"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="size-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{t.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {t.content.substring(0, 80)}...
                          </p>
                        </div>
                        {t.is_default && (
                          <Badge variant="default" className="shrink-0">
                            <Star className="size-3 mr-1" /> Padrão
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {!t.is_default && (
                          <Button variant="ghost" size="sm" onClick={() => handleSetDefault(t.id)} title="Definir como padrão">
                            <Star className="size-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(t)}>
                          Editar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Placeholders Reference */}
        <div>
          <Card className="border-white/10 bg-card sticky top-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="size-4" />
                Placeholders Disponíveis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Use esses placeholders no template. Eles serão substituídos pelos dados reais do perfil vendido.
              </p>
              <div className="space-y-1.5">
                {PLACEHOLDERS.map((p) => (
                  <button
                    key={p.tag}
                    onClick={() => copyPlaceholder(p.tag)}
                    className="w-full flex items-center justify-between p-2 rounded hover:bg-muted/40 transition-colors group text-left"
                  >
                    <div className="min-w-0">
                      <code className="text-xs font-mono text-primary">{p.tag}</code>
                      <p className="text-[11px] text-muted-foreground">{p.desc}</p>
                    </div>
                    <Copy className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
