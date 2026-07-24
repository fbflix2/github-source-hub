import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Image as ImageIcon, Plus, Pencil, Trash2, ExternalLink, Loader2, Upload } from "lucide-react";

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  cta_text: string | null;
  link_url: string | null;
  image_url: string | null;
  position: number;
  active: boolean;
  category: string | null;
  reseller_id: string | null;
}

interface Props {
  resellerId: string;
}

const emptyForm = {
  id: "" as string | null,
  title: "",
  subtitle: "",
  cta_text: "",
  link_url: "",
  image_url: "",
  position: 0,
  active: true,
  category: "promo",
};

export function ResellerBannersManager({ resellerId }: Props) {
  const [loading, setLoading] = useState(true);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<any>({ ...emptyForm });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("banners")
      .select("*")
      .eq("reseller_id", resellerId)
      .order("position", { ascending: true });
    if (error) toast.error("Erro ao carregar banners");
    setBanners((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [resellerId]);

  const openNew = () => {
    setForm({ ...emptyForm, id: null, position: banners.length });
    setModalOpen(true);
  };

  const openEdit = (b: Banner) => {
    setForm({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle || "",
      cta_text: b.cta_text || "",
      link_url: b.link_url || "",
      image_url: b.image_url || "",
      position: b.position,
      active: b.active,
      category: b.category || "promo",
    });
    setModalOpen(true);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `reseller/${resellerId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("banners").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("banners").getPublicUrl(path);
      setForm((f: any) => ({ ...f, image_url: data.publicUrl }));
      toast.success("Imagem enviada");
    } catch (err: any) {
      toast.error("Erro ao enviar imagem: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        cta_text: form.cta_text.trim() || null,
        link_url: form.link_url.trim() || null,
        image_url: form.image_url.trim() || null,
        position: Number(form.position) || 0,
        active: !!form.active,
        category: form.category || "promo",
        audience: "reseller",
        reseller_id: resellerId,
      };
      if (form.id) {
        const { error } = await supabase.from("banners").update(payload).eq("id", form.id);
        if (error) throw error;
        toast.success("Banner atualizado");
      } else {
        const { error } = await supabase.from("banners").insert(payload);
        if (error) throw error;
        toast.success("Banner criado");
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (b: Banner) => {
    const { error } = await supabase.from("banners").update({ active: !b.active }).eq("id", b.id);
    if (error) return toast.error("Erro ao atualizar");
    setBanners(prev => prev.map(x => x.id === b.id ? { ...x, active: !x.active } : x));
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este banner?")) return;
    const { error } = await supabase.from("banners").delete().eq("id", id);
    if (error) return toast.error("Erro ao excluir");
    toast.success("Banner excluído");
    load();
  };

  return (
    <Card className="p-5 bg-card/60 border-border/40 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ImageIcon className="size-4 text-primary" />
          <div>
            <h3 className="font-bold">Banners da sua loja</h3>
            <p className="text-xs text-muted-foreground">
              Apenas os banners cadastrados aqui aparecem para os seus clientes.
            </p>
          </div>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="size-4" /> Novo banner
        </Button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin mx-auto" />
        </div>
      ) : banners.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
          Nenhum banner cadastrado ainda. Clique em "Novo banner" para criar o primeiro.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {banners.map((b) => (
            <div key={b.id} className={`rounded-xl border border-border/50 overflow-hidden bg-card/40 flex flex-col ${!b.active ? "opacity-60" : ""}`}>
              <div className="relative aspect-video bg-muted overflow-hidden">
                {b.image_url ? (
                  <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${b.image_url}')` }} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="size-8 opacity-40" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-3 flex flex-col justify-end">
                  <div className="text-white font-bold text-sm truncate">{b.title}</div>
                  {b.subtitle && <div className="text-white/80 text-xs line-clamp-1">{b.subtitle}</div>}
                </div>
                <div className="absolute top-2 left-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.active ? "bg-green-500/80 text-white" : "bg-muted text-muted-foreground"}`}>
                    {b.active ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
              <div className="p-3 flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <Switch checked={b.active} onCheckedChange={() => toggleActive(b)} />
                  <span className="text-xs text-muted-foreground">Ativo</span>
                </div>
                <div className="flex items-center gap-1">
                  {b.link_url && (
                    <Button size="icon" variant="ghost" asChild>
                      <a href={b.link_url} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /></a>
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => openEdit(b)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(b.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar banner" : "Novo banner"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label>Título *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Promoção de proxies" />
            </div>
            <div>
              <Label>Subtítulo</Label>
              <Textarea rows={2} value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Descrição curta do banner" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Texto do botão (CTA)</Label>
                <Input value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} placeholder="Ex: Comprar agora" />
              </div>
              <div>
                <Label>Link do botão</Label>
                <Input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://..." />
              </div>
            </div>
            <div>
              <Label>Imagem do banner</Label>
              <div className="flex items-center gap-2 mt-1.5">
                <Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="URL da imagem" />
                <label className="inline-flex items-center gap-1 px-3 py-2 rounded-md border border-border cursor-pointer hover:bg-muted text-xs whitespace-nowrap">
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  Upload
                  <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
              </div>
              {form.image_url && (
                <div className="mt-2 aspect-video bg-muted rounded-md overflow-hidden">
                  <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url('${form.image_url}')` }} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Posição</Label>
                <Input type="number" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
              </div>
              <div className="flex items-end gap-2">
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                <span className="text-sm">Banner ativo</span>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin mr-1" />}
              {form.id ? "Salvar" : "Criar banner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}