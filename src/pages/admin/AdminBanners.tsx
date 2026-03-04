import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Search, Plus, Link as LinkIcon, Edit, Copy, Trash2, Grid3X3, List,
  ToggleRight, ImagePlus, Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import BannerEditorModal from "@/components/admin/BannerEditorModal";

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
}

export default function AdminBanners() {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const fetchBanners = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("banners").select("*").order("position", { ascending: true });
    if (error) toast.error("Erro ao carregar banners");
    setBanners(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchBanners(); }, []);

  const toggleActive = async (banner: Banner) => {
    const { error } = await supabase.from("banners").update({ active: !banner.active }).eq("id", banner.id);
    if (error) return toast.error("Erro ao atualizar");
    setBanners((prev) => prev.map((b) => (b.id === banner.id ? { ...b, active: !b.active } : b)));
  };

  const duplicateBanner = async (banner: Banner) => {
    const { id, created_at, ...rest } = banner;
    const { error } = await supabase.from("banners").insert({ ...rest, title: `${rest.title} (cópia)`, active: false });
    if (error) return toast.error("Erro ao duplicar");
    toast.success("Banner duplicado");
    fetchBanners();
  };

  const deleteBanner = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("banners").delete().eq("id", deleteId);
    if (error) return toast.error("Erro ao excluir");
    toast.success("Banner excluído");
    setDeleteId(null);
    fetchBanners();
  };

  const filtered = banners
    .filter((b) => b.title.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter((b) => statusFilter === "all" ? true : statusFilter === "active" ? b.active : !b.active);

  return (
    <div className="flex flex-col gap-8 py-6">
      <header className="flex flex-col gap-8 mb-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground mb-2">Editor de Banners</h1>
            <p className="text-muted-foreground font-medium text-sm md:text-base">Gerencie as promoções e destaques do FBFLIX</p>
          </div>
          <Button onClick={() => { setEditingBanner(null); setEditorOpen(true); }} className="group flex items-center gap-2 font-bold py-3 px-6 h-auto rounded-xl">
            <Plus className="w-5 h-5" /> Novo Banner
          </Button>
        </div>

        <div className="bg-card/60 backdrop-blur-xl border border-border p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <div className="bg-background/40 border border-border rounded-xl flex items-center h-12 w-full transition-colors focus-within:border-primary">
              <div className="pl-4 text-muted-foreground flex items-center justify-center"><Search className="w-5 h-5" /></div>
              <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar por título do banner..." className="w-full bg-transparent border-none text-foreground placeholder:text-muted-foreground focus-visible:ring-0 text-sm font-medium h-full" />
            </div>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button onClick={() => setStatusFilter(statusFilter === "active" ? "inactive" : statusFilter === "inactive" ? "all" : "active")} className="bg-background/40 border border-border h-10 px-4 rounded-lg flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/10 transition-all whitespace-nowrap">
              <ToggleRight className="w-4 h-4" />
              <span>Status: {statusFilter === "all" ? "Todos" : statusFilter === "active" ? "Ativos" : "Inativos"}</span>
            </button>
            <div className="hidden md:flex bg-background/40 rounded-lg p-1 border border-border ml-2">
              <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded transition-colors ${viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}><Grid3X3 className="w-5 h-5" /></button>
              <button onClick={() => setViewMode("list")} className={`p-1.5 rounded transition-colors ${viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}><List className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((banner) => (
            <div key={banner.id} className={`bg-gradient-to-b from-card/60 to-card/40 backdrop-blur-xl border border-border rounded-2xl overflow-hidden group flex flex-col h-full relative transition-all duration-300 hover:border-primary/40 hover:-translate-y-1 ${!banner.active ? "opacity-70 hover:opacity-100" : ""}`}>
              <div className="absolute top-3 left-3 z-20">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold backdrop-blur-md shadow-lg ${banner.active ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-muted/60 text-muted-foreground border border-border"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${banner.active ? "bg-green-400 animate-pulse" : "bg-muted-foreground"}`} />
                  {banner.active ? "Ativo" : "Inativo"}
                </span>
              </div>

              <div className={`relative aspect-video w-full overflow-hidden bg-muted ${!banner.active ? "grayscale group-hover:grayscale-0 transition-all duration-500" : ""}`}>
                {banner.image_url ? (
                  <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: `url('${banner.image_url}')` }} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center"><ImagePlus className="w-12 h-12 text-muted-foreground/30" /></div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5 flex flex-col items-start gap-2">
                  <h3 className="text-xl font-bold leading-tight text-white drop-shadow-md">{banner.title}</h3>
                  {banner.subtitle && <p className="text-xs text-gray-300 line-clamp-2 drop-shadow-sm">{banner.subtitle}</p>}
                  {banner.cta_text && <span className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded shadow-lg bg-primary text-primary-foreground">{banner.cta_text}</span>}
                </div>
              </div>

              <div className="p-5 flex flex-col gap-4 flex-1 justify-between border-t border-border/50">
                {banner.link_url && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <LinkIcon className="w-4 h-4" />
                    <span className="truncate font-mono">{banner.link_url}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-3 mt-1 border-t border-border/50">
                  <label className="relative inline-flex items-center cursor-pointer group/toggle">
                    <Switch checked={banner.active} onCheckedChange={() => toggleActive(banner)} className="data-[state=checked]:bg-primary" />
                    <span className="ml-2 text-xs font-medium text-muted-foreground">{banner.active ? "Visível" : "Oculto"}</span>
                  </label>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingBanner(banner); setEditorOpen(true); }} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors" title="Editar"><Edit className="w-[18px] h-[18px]" /></button>
                    <button onClick={() => duplicateBanner(banner)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors" title="Duplicar"><Copy className="w-[18px] h-[18px]" /></button>
                    <button onClick={() => setDeleteId(banner.id)} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Excluir"><Trash2 className="w-[18px] h-[18px]" /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button onClick={() => { setEditingBanner(null); setEditorOpen(true); }} className="bg-card/40 border-2 border-dashed border-border hover:border-primary/50 rounded-2xl overflow-hidden group flex flex-col h-full min-h-[320px] relative items-center justify-center hover:bg-muted/5 cursor-pointer text-center p-8 gap-4 transition-all">
            <div className="w-16 h-16 rounded-full bg-muted/10 flex items-center justify-center group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
              <ImagePlus className="w-8 h-8 text-muted-foreground group-hover:text-primary" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-bold text-foreground/80 group-hover:text-foreground">Criar Novo Banner</h3>
              <p className="text-sm text-muted-foreground">Adicione uma nova promoção</p>
            </div>
          </button>
        </div>
      )}

      <BannerEditorModal open={editorOpen} onOpenChange={setEditorOpen} banner={editingBanner} onSaved={fetchBanners} />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir banner?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteBanner} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
