import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, X } from "lucide-react";

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  cta_text: string | null;
  link_url: string | null;
  image_url: string | null;
  position: number;
  active: boolean;
  created_at: string;
  category: string | null;
  background_color: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  banner: Banner | null;
  onSaved: () => void;
}

const CATEGORIES = [
  { value: "promo", label: "Promoção" },
  { value: "destaque", label: "Destaque" },
  { value: "info", label: "Informativo" },
  { value: "evento", label: "Evento" },
];

export default function BannerEditorModal({ open, onOpenChange, banner, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [position, setPosition] = useState(0);
  const [active, setActive] = useState(true);
  const [category, setCategory] = useState("promo");
  const [backgroundColor, setBackgroundColor] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (banner) {
      setTitle(banner.title);
      setSubtitle(banner.subtitle || "");
      setCtaText(banner.cta_text || "");
      setLinkUrl(banner.link_url || "");
      setImageUrl(banner.image_url || "");
      setPosition(banner.position);
      setActive(banner.active);
      setCategory(banner.category || "promo");
      setBackgroundColor(banner.background_color || "");
    } else {
      setTitle("");
      setSubtitle("");
      setCtaText("");
      setLinkUrl("");
      setImageUrl("");
      setPosition(0);
      setActive(true);
      setCategory("promo");
      setBackgroundColor("");
    }
  }, [banner, open]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `banners/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
      setImageUrl(urlData.publicUrl);
      toast.success("Imagem enviada");
    } catch (err: any) {
      toast.error("Erro ao enviar imagem: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        cta_text: ctaText.trim() || null,
        link_url: linkUrl.trim() || null,
        image_url: imageUrl.trim() || null,
        position,
        active,
        category,
        background_color: backgroundColor.trim() || null,
      };

      if (banner) {
        const { error } = await supabase.from("banners").update(payload).eq("id", banner.id);
        if (error) throw error;
        toast.success("Banner atualizado");
      } else {
        const { error } = await supabase.from("banners").insert(payload);
        if (error) throw error;
        toast.success("Banner criado");
      }
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{banner ? "Editar Banner" : "Novo Banner"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          <div>
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do banner" />
          </div>
          <div>
            <Label>Subtítulo / Descrição</Label>
            <Textarea value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Texto descritivo" rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cor de Fundo</Label>
              <div className="flex gap-2 items-center">
                <Input value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} placeholder="#000000 ou rgb(...)" className="flex-1" />
                {backgroundColor && (
                  <div className="w-8 h-8 rounded border border-border shrink-0" style={{ backgroundColor }} />
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Texto do CTA</Label>
              <Input value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Ex: Aproveitar agora" />
            </div>
            <div>
              <Label>Link do CTA</Label>
              <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="/promo ou https://..." />
            </div>
          </div>

          {/* Image */}
          <div>
            <Label>Imagem</Label>
            {imageUrl ? (
              <div className="relative mt-1 rounded-lg overflow-hidden border border-border">
                <img src={imageUrl} alt="Preview" className="w-full h-40 object-cover" />
                <button onClick={() => setImageUrl("")} className="absolute top-2 right-2 bg-black/60 p-1 rounded-full hover:bg-black/80">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <label className="mt-1 flex items-center justify-center gap-2 h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                {uploading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : <Upload className="w-5 h-5 text-muted-foreground" />}
                <span className="text-sm text-muted-foreground">{uploading ? "Enviando..." : "Clique para enviar"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
              </label>
            )}
            <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Ou cole a URL da imagem" className="mt-2" />
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <Label>Posição (ordem)</Label>
              <Input type="number" value={position} onChange={(e) => setPosition(Number(e.target.value))} />
            </div>
            <div className="flex items-center gap-3 pb-1">
              <Switch checked={active} onCheckedChange={setActive} />
              <Label>{active ? "Ativo" : "Inativo"}</Label>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full mt-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {banner ? "Salvar Alterações" : "Criar Banner"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
