import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Upload, X, Copy, ImageIcon, Sparkles, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Creative {
  id: string;
  title: string;
  description: string | null;
  type: string;
  media_url: string | null;
  copy_text: string | null;
  status: string;
  created_at: string;
}

export default function AdminCriativos() {
  const [items, setItems] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Creative | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [copyText, setCopyText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [active, setActive] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("partner_creatives" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setTitle(""); setDescription(""); setCopyText(""); setMediaUrl(""); setActive(true);
    setModalOpen(true);
  };

  const openEdit = (it: Creative) => {
    setEditing(it);
    setTitle(it.title);
    setDescription(it.description || "");
    setCopyText(it.copy_text || "");
    setMediaUrl(it.media_url || "");
    setActive(it.status === "active");
    setModalOpen(true);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `criativos/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setMediaUrl(data.publicUrl);
      toast.success("Imagem enviada");
    } catch (err: any) {
      toast.error("Erro ao enviar: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!title.trim()) { toast.error("Título é obrigatório"); return; }
    if (!mediaUrl && !copyText.trim()) { toast.error("Adicione uma imagem ou uma copy"); return; }
    setSaving(true);
    const payload: any = {
      title: title.trim(),
      description: description.trim() || null,
      type: "image",
      media_url: mediaUrl.trim() || null,
      copy_text: copyText.trim() || null,
      status: active ? "active" : "inactive",
    };
    const q = editing
      ? supabase.from("partner_creatives" as any).update(payload).eq("id", editing.id)
      : supabase.from("partner_creatives" as any).insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Criativo atualizado" : "Criativo publicado para os afiliados");
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir criativo?")) return;
    const { error } = await supabase.from("partner_creatives" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removido");
    load();
  };

  const toggle = async (it: Creative) => {
    const next = it.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("partner_creatives" as any).update({ status: next }).eq("id", it.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const copy = (t: string) => {
    navigator.clipboard.writeText(t);
    toast.success("Copiado!");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Criativos & Copys dos Afiliados
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre imagens e textos prontos. Assim que ativados, aparecem para os afiliados na aba <strong>Criativos & Copys</strong>.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Novo criativo
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
      ) : items.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <ImageIcon className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">Nenhum criativo cadastrado ainda.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it) => (
            <div key={it.id} className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
              {it.media_url && (
                <img src={it.media_url} alt={it.title} className="w-full aspect-video object-cover" />
              )}
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-foreground text-sm truncate">{it.title}</p>
                    {it.description && <p className="text-xs text-muted-foreground mt-0.5">{it.description}</p>}
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded shrink-0 ${it.status === "active" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {it.status === "active" ? "Ativo" : "Inativo"}
                  </span>
                </div>
                {it.copy_text && (
                  <div className="mt-3">
                    <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">Copy</p>
                    <p className="text-xs text-foreground/80 whitespace-pre-wrap bg-muted/40 border border-border rounded p-2 line-clamp-4">{it.copy_text}</p>
                    <button onClick={() => copy(it.copy_text!)} className="mt-2 inline-flex items-center gap-1 text-primary text-xs font-semibold">
                      <Copy className="w-3 h-3" /> Copiar
                    </button>
                  </div>
                )}
                <div className="mt-4 flex items-center gap-2 pt-3 border-t border-border">
                  <Switch checked={it.status === "active"} onCheckedChange={() => toggle(it)} />
                  <span className="text-xs text-muted-foreground flex-1">Visível</span>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(it)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(it.id)} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar criativo" : "Novo criativo"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <Label>Título *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Anúncio BM Selecionada" />
            </div>
            <div>
              <Label>Descrição curta</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Ideal para stories no Instagram" />
            </div>
            <div>
              <Label>Imagem / Criativo</Label>
              {mediaUrl ? (
                <div className="relative mt-1 rounded-lg overflow-hidden border border-border">
                  <img src={mediaUrl} alt="Preview" className="w-full max-h-64 object-cover" />
                  <button onClick={() => setMediaUrl("")} className="absolute top-2 right-2 bg-black/60 p-1 rounded-full hover:bg-black/80">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <label className="mt-1 flex items-center justify-center gap-2 h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : <Upload className="w-5 h-5 text-muted-foreground" />}
                  <span className="text-sm text-muted-foreground">{uploading ? "Enviando..." : "Clique para enviar imagem"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
              )}
              <Input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="Ou cole a URL da imagem" className="mt-2" />
            </div>
            <div>
              <Label>Copy (texto pronto)</Label>
              <Textarea value={copyText} onChange={(e) => setCopyText(e.target.value)} placeholder="Texto que o afiliado pode copiar e colar…" rows={6} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={active} onCheckedChange={setActive} />
              <Label>{active ? "Ativo (visível para afiliados)" : "Inativo"}</Label>
            </div>
            <Button onClick={save} disabled={saving} className="w-full mt-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editing ? "Salvar alterações" : "Publicar criativo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}