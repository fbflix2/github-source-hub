import { useState, useEffect } from "react";
import {
  Search,
  Link as LinkIcon,
  Tag,
  PlusCircle,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  Play,
  Video,
  X,
  Check,
  FolderPlus,
  Settings,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Tutorial {
  id: string;
  title: string;
  video_url: string | null;
  category: string | null;
  description: string | null;
  published: boolean;
  position: number;
  thumbnail_url: string | null;
  content: string | null;
  created_at: string;
}

interface TutorialCategory {
  name: string;
  color: string;
}

const defaultColors = [
  "blue", "purple", "orange", "emerald", "pink", "cyan", "amber", "rose",
];

const colorMap: Record<string, { text: string; bg: string; border: string }> = {
  blue: { text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  purple: { text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  orange: { text: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  emerald: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  pink: { text: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20" },
  cyan: { text: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
  amber: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  rose: { text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
};

export default function AdminTutoriais() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [categories, setCategories] = useState<TutorialCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Form state
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoCategory, setVideoCategory] = useState("");
  const [videoTags, setVideoTags] = useState("");
  const [videoDescription, setVideoDescription] = useState("");
  const [editingTutorial, setEditingTutorial] = useState<Tutorial | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Category management
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("blue");
  const [editingCategory, setEditingCategory] = useState<TutorialCategory | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryColor, setEditCategoryColor] = useState("");

  useEffect(() => {
    fetchTutorials();
    fetchCategories();
  }, []);

  const fetchTutorials = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tutorials")
      .select("*")
      .order("position", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar tutoriais");
    } else {
      setTutorials(data || []);
    }
    setLoading(false);
  };

  const fetchCategories = async () => {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "tutorial_categories")
      .single();
    if (data?.value) {
      try {
        setCategories(JSON.parse(data.value));
      } catch {
        setCategories([]);
      }
    } else {
      // Seed defaults
      const defaults: TutorialCategory[] = [
        { name: "Uso da Plataforma", color: "blue" },
        { name: "Pagamentos", color: "purple" },
        { name: "Suporte Técnico", color: "orange" },
        { name: "Novidades", color: "emerald" },
      ];
      setCategories(defaults);
      await saveCategories(defaults);
    }
  };

  const saveCategories = async (cats: TutorialCategory[]) => {
    const { data: existing } = await supabase
      .from("site_settings")
      .select("id")
      .eq("key", "tutorial_categories")
      .single();

    if (existing) {
      await supabase
        .from("site_settings")
        .update({ value: JSON.stringify(cats) })
        .eq("key", "tutorial_categories");
    } else {
      await supabase
        .from("site_settings")
        .insert({ key: "tutorial_categories", value: JSON.stringify(cats) });
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    if (categories.some((c) => c.name.toLowerCase() === newCategoryName.trim().toLowerCase())) {
      toast.error("Categoria já existe");
      return;
    }
    const updated = [...categories, { name: newCategoryName.trim(), color: newCategoryColor }];
    setCategories(updated);
    await saveCategories(updated);
    setNewCategoryName("");
    setNewCategoryColor("blue");
    toast.success("Categoria adicionada");
  };

  const handleEditCategory = async () => {
    if (!editingCategory || !editCategoryName.trim()) return;
    const oldName = editingCategory.name;
    const updated = categories.map((c) =>
      c.name === oldName ? { name: editCategoryName.trim(), color: editCategoryColor } : c
    );
    setCategories(updated);
    await saveCategories(updated);

    // Update tutorials that use the old category name
    if (oldName !== editCategoryName.trim()) {
      await supabase
        .from("tutorials")
        .update({ category: editCategoryName.trim() })
        .eq("category", oldName);
      fetchTutorials();
    }

    setEditingCategory(null);
    toast.success("Categoria atualizada");
  };

  const handleDeleteCategory = async (name: string) => {
    const updated = categories.filter((c) => c.name !== name);
    setCategories(updated);
    await saveCategories(updated);
    // Clear category from tutorials that used it
    await supabase.from("tutorials").update({ category: null }).eq("category", name);
    fetchTutorials();
    toast.success("Categoria removida");
  };

  const getCategoryStyle = (catName: string | null) => {
    if (!catName) return colorMap.blue;
    const cat = categories.find((c) => c.name === catName);
    return colorMap[cat?.color || "blue"] || colorMap.blue;
  };

  const resetForm = () => {
    setVideoUrl("");
    setVideoTitle("");
    setVideoCategory("");
    setVideoTags("");
    setVideoDescription("");
    setEditingTutorial(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoTitle.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    setSubmitting(true);

    const payload = {
      title: videoTitle.trim(),
      video_url: videoUrl.trim() || null,
      category: videoCategory || null,
      description: videoDescription.trim() || null,
      content: videoTags.trim() || null, // using content field to store tags string
      published: false,
    };

    if (editingTutorial) {
      const { error } = await supabase
        .from("tutorials")
        .update(payload)
        .eq("id", editingTutorial.id);
      if (error) {
        toast.error("Erro ao atualizar tutorial");
      } else {
        toast.success("Tutorial atualizado!");
        resetForm();
        fetchTutorials();
      }
    } else {
      const { error } = await supabase
        .from("tutorials")
        .insert({ ...payload, position: tutorials.length });
      if (error) {
        toast.error("Erro ao criar tutorial");
      } else {
        toast.success("Tutorial adicionado!");
        resetForm();
        fetchTutorials();
      }
    }
    setSubmitting(false);
  };

  const handleEdit = (tutorial: Tutorial) => {
    setEditingTutorial(tutorial);
    setVideoTitle(tutorial.title);
    setVideoUrl(tutorial.video_url || "");
    setVideoCategory(tutorial.category || "");
    setVideoDescription(tutorial.description || "");
    setVideoTags(tutorial.content || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const { error } = await supabase.from("tutorials").delete().eq("id", deletingId);
    if (error) {
      toast.error("Erro ao excluir tutorial");
    } else {
      toast.success("Tutorial excluído!");
      fetchTutorials();
    }
    setDeletingId(null);
  };

  const handleTogglePublished = async (tutorial: Tutorial) => {
    const { error } = await supabase
      .from("tutorials")
      .update({ published: !tutorial.published })
      .eq("id", tutorial.id);
    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      fetchTutorials();
    }
  };

  const filteredTutorials = tutorials.filter((tutorial) => {
    const matchesSearch =
      tutorial.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tutorial.category || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tutorial.content || "").toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === "all") return matchesSearch;
    if (statusFilter === "published") return matchesSearch && tutorial.published;
    return matchesSearch && !tutorial.published;
  });

  const getYouTubeThumbnail = (url: string | null) => {
    if (!url) return null;
    const match = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return match ? `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg` : null;
  };

  return (
    <div className="flex flex-col gap-8 py-6">
      {/* Header */}
      <header className="flex flex-col gap-2 mb-4">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-sm">
          Gerenciamento de <span className="text-primary">Tutoriais</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl">
          Adicione, edite e organize os vídeos de ajuda para os seus clientes.
          Mantenha a base de conhecimento do FBFLIX sempre atualizada.
        </p>
      </header>

      {/* Section 1: Form */}
      <section className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 md:p-8">
        <div className="flex items-center justify-between gap-3 mb-6 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Video className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white">
              {editingTutorial ? "Editar Tutorial" : "Novo Tutorial"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {editingTutorial && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetForm}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4 mr-1" />
                Cancelar
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCategoryModal(true)}
              className="border-white/10 text-gray-300 hover:text-white hover:bg-white/10"
            >
              <Settings className="w-4 h-4 mr-1" />
              Categorias
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Video URL */}
          <div className="col-span-1 md:col-span-8">
            <label className="block text-sm font-medium text-gray-300 mb-2">URL do Vídeo</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500">
                <LinkIcon className="w-5 h-5" />
              </span>
              <Input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full rounded-xl py-3 h-auto pl-11 pr-4 bg-black/40 border border-white/10 text-white placeholder:text-gray-500 focus:border-primary focus-visible:ring-1 focus-visible:ring-primary transition-all"
              />
            </div>
          </div>

          {/* Categoria */}
          <div className="col-span-1 md:col-span-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Categoria</label>
            <Select value={videoCategory} onValueChange={setVideoCategory}>
              <SelectTrigger className="w-full rounded-xl py-3 h-auto bg-black/40 border border-white/10 text-white focus:border-primary focus:ring-1 focus:ring-primary">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent className="bg-neutral-900 border-white/10">
                {categories.map((cat) => (
                  <SelectItem key={cat.name} value={cat.name}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Título */}
          <div className="col-span-1 md:col-span-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Título do Tutorial</label>
            <Input
              type="text"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              placeholder="Ex: Como redefinir sua senha"
              className="w-full rounded-xl py-3 h-auto px-4 bg-black/40 border border-white/10 text-white placeholder:text-gray-500 focus:border-primary focus-visible:ring-1 focus-visible:ring-primary transition-all"
            />
          </div>

          {/* Tags */}
          <div className="col-span-1 md:col-span-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Tags</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500">
                <Tag className="w-5 h-5" />
              </span>
              <Input
                type="text"
                value={videoTags}
                onChange={(e) => setVideoTags(e.target.value)}
                placeholder="Separadas por vírgula"
                className="w-full rounded-xl py-3 h-auto pl-11 pr-4 bg-black/40 border border-white/10 text-white placeholder:text-gray-500 focus:border-primary focus-visible:ring-1 focus-visible:ring-primary transition-all"
              />
            </div>
          </div>

          {/* Descrição */}
          <div className="col-span-1 md:col-span-12">
            <label className="block text-sm font-medium text-gray-300 mb-2">Descrição do Vídeo</label>
            <Textarea
              value={videoDescription}
              onChange={(e) => setVideoDescription(e.target.value)}
              placeholder="Breve resumo sobre o conteúdo do vídeo..."
              rows={3}
              className="w-full rounded-xl py-3 px-4 bg-black/40 border border-white/10 text-white placeholder:text-gray-500 focus:border-primary focus-visible:ring-1 focus-visible:ring-primary transition-all resize-none"
            />
          </div>

          {/* Botão */}
          <div className="col-span-1 md:col-span-12 flex justify-end mt-2">
            <Button
              type="submit"
              disabled={submitting}
              className="group flex items-center gap-2 bg-primary hover:bg-red-700 text-white font-bold py-3 px-8 h-auto rounded-xl shadow-[0_0_15px_rgba(249,6,6,0.4)] hover:shadow-[0_0_25px_rgba(249,6,6,0.6)]"
            >
              <PlusCircle className="w-5 h-5" />
              {editingTutorial ? "Salvar Alterações" : "Adicionar Tutorial"}
            </Button>
          </div>
        </form>
      </section>

      {/* Section 2: Listing */}
      <section className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 md:p-8 flex flex-col gap-6 min-h-[400px]">
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="w-full md:w-1/3 relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
              <Search className="w-5 h-5" />
            </span>
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por título, tag ou categoria..."
              className="w-full rounded-xl py-2.5 h-auto pl-10 pr-4 bg-black/40 border border-white/10 text-white placeholder:text-gray-500 focus:border-primary focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="rounded-xl py-2.5 h-auto px-4 bg-black/40 border border-white/10 text-white min-w-[140px] focus:border-primary focus:ring-1 focus:ring-primary">
                <SelectValue placeholder="Todos Status" />
              </SelectTrigger>
              <SelectContent className="bg-neutral-900 border-white/10">
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="published">Publicado</SelectItem>
                <SelectItem value="draft">Rascunho</SelectItem>
              </SelectContent>
            </Select>
            <button
              onClick={fetchTutorials}
              className="bg-black/40 border border-white/10 p-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Atualizar"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-white/5">
          <Table>
            <TableHeader>
              <TableRow className="bg-black/40 hover:bg-black/40 border-b border-white/5">
                <TableHead className="text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">Vídeo</TableHead>
                <TableHead className="text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">Detalhes</TableHead>
                <TableHead className="text-gray-400 text-xs uppercase tracking-wider font-semibold p-4 hidden md:table-cell">Categoria</TableHead>
                <TableHead className="text-gray-400 text-xs uppercase tracking-wider font-semibold p-4 hidden lg:table-cell">Tags</TableHead>
                <TableHead className="text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">Status</TableHead>
                <TableHead className="text-gray-400 text-xs uppercase tracking-wider font-semibold p-4 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-12">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredTutorials.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-12">
                    Nenhum tutorial encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTutorials.map((tutorial) => {
                  const catStyle = getCategoryStyle(tutorial.category);
                  const thumb = tutorial.thumbnail_url || getYouTubeThumbnail(tutorial.video_url);
                  const tags = tutorial.content
                    ? tutorial.content.split(",").map((t) => t.trim()).filter(Boolean)
                    : [];

                  return (
                    <TableRow key={tutorial.id} className="hover:bg-white/5 transition-colors group border-b border-white/5">
                      <TableCell className="p-4 align-middle w-[160px]">
                        <div className="relative w-32 h-20 rounded-lg overflow-hidden bg-gray-800 shadow-lg group-hover:shadow-primary/20 transition-all border border-white/10">
                          {thumb ? (
                            <img src={thumb} alt={tutorial.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-600">
                              <Video className="w-8 h-8" />
                            </div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="w-8 h-8 text-white drop-shadow-md" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="p-4 align-middle">
                        <p className="text-white font-semibold text-base mb-1">{tutorial.title}</p>
                        <p className="text-gray-500 text-xs truncate max-w-[200px]">{tutorial.video_url || "—"}</p>
                      </TableCell>
                      <TableCell className="p-4 align-middle hidden md:table-cell">
                        {tutorial.category ? (
                          <span className={`px-2.5 py-1 rounded-md ${catStyle.bg} ${catStyle.text} border ${catStyle.border} text-xs font-medium`}>
                            {tutorial.category}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="p-4 align-middle hidden lg:table-cell">
                        <div className="flex gap-1 flex-wrap">
                          {tags.map((tag) => (
                            <span key={tag} className="text-gray-400 text-xs bg-white/5 px-2 py-0.5 rounded">#{tag}</span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="p-4 align-middle">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={tutorial.published}
                            onCheckedChange={() => handleTogglePublished(tutorial)}
                            className="scale-75"
                          />
                          <span className={`text-xs font-medium ${tutorial.published ? "text-green-400" : "text-yellow-500"}`}>
                            {tutorial.published ? "Publicado" : "Rascunho"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="p-4 align-middle text-right">
                        <div className="flex justify-end gap-2">
                          {tutorial.video_url && (
                            <a
                              href={tutorial.video_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                              title="Visualizar"
                            >
                              <Eye className="w-5 h-5" />
                            </a>
                          )}
                          <button
                            onClick={() => handleEdit(tutorial)}
                            className="p-2 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => setDeletingId(tutorial.id)}
                            className="p-2 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
          <span className="text-xs text-gray-500">
            {filteredTutorials.length} tutorial(is) encontrado(s)
          </span>
        </div>
      </section>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent className="bg-neutral-900 border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Excluir Tutorial</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Tem certeza que deseja excluir este tutorial? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-gray-300 hover:bg-white/10">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-primary hover:bg-red-700 text-white">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Category Management Modal */}
      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent className="bg-neutral-900 border-white/10 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Gerenciar Categorias
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Add new category */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">Nova Categoria</label>
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nome da categoria"
                  className="bg-black/40 border-white/10 text-white rounded-lg h-9"
                  onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Cor</label>
                <Select value={newCategoryColor} onValueChange={setNewCategoryColor}>
                  <SelectTrigger className="w-24 bg-black/40 border-white/10 text-white rounded-lg h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-white/10">
                    {defaultColors.map((c) => (
                      <SelectItem key={c} value={c}>
                        <span className={`${colorMap[c]?.text}`}>{c}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddCategory} size="sm" className="bg-primary hover:bg-red-700 text-white h-9 px-3">
                <FolderPlus className="w-4 h-4" />
              </Button>
            </div>

            {/* Category list */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {categories.map((cat) => {
                const style = colorMap[cat.color] || colorMap.blue;
                const isEditing = editingCategory?.name === cat.name;

                return (
                  <div key={cat.name} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/5">
                    {isEditing ? (
                      <>
                        <Input
                          value={editCategoryName}
                          onChange={(e) => setEditCategoryName(e.target.value)}
                          className="flex-1 bg-black/40 border-white/10 text-white rounded-lg h-8 text-sm"
                        />
                        <Select value={editCategoryColor} onValueChange={setEditCategoryColor}>
                          <SelectTrigger className="w-20 bg-black/40 border-white/10 text-white rounded-lg h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-neutral-900 border-white/10">
                            {defaultColors.map((c) => (
                              <SelectItem key={c} value={c}>
                                <span className={`${colorMap[c]?.text}`}>{c}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <button onClick={handleEditCategory} className="p-1 text-green-400 hover:text-green-300">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingCategory(null)} className="p-1 text-gray-400 hover:text-white">
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text} border ${style.border} flex-1`}>
                          {cat.name}
                        </span>
                        <button
                          onClick={() => {
                            setEditingCategory(cat);
                            setEditCategoryName(cat.name);
                            setEditCategoryColor(cat.color);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat.name)}
                          className="p-1 text-gray-400 hover:text-primary transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
              {categories.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">Nenhuma categoria criada.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
