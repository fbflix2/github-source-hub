import { useState, useEffect } from "react";
import { Plus, Search, Trash2, SquarePen, Tag, FolderTree, Palette, X, Save, User, Briefcase, Server, Globe, Flag, CircleUser, Building2, PackageOpen, Shield, Wifi, Key, Monitor, Smartphone, CreditCard, Mail, Lock, Loader2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface TagItem {
  id: string;
  name: string;
  color: string;
  type: "status" | "product";
}

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  icon: string;
}

const defaultStatusTags: TagItem[] = [
  { id: "1", name: "Acabando Rápido", color: "#ef4444", type: "status" },
  { id: "2", name: "Avisar Quando Chegar", color: "#f59e0b", type: "status" },
  { id: "3", name: "Novo", color: "#22c55e", type: "status" },
  { id: "4", name: "Promoção", color: "#8b5cf6", type: "status" },
  { id: "5", name: "Esgotado", color: "#6b7280", type: "status" },
];

const defaultProductTags: TagItem[] = [
  { id: "10", name: "Premium", color: "#f59e0b", type: "product" },
  { id: "11", name: "Popular", color: "#3b82f6", type: "product" },
  { id: "12", name: "Exclusivo", color: "#8b5cf6", type: "product" },
];

interface PlatformIcon {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  category: string;
}

const platformIcons: PlatformIcon[] = [
  // Produtos
  { key: "perfil", label: "Perfil", icon: User, color: "bg-blue-500/20 text-blue-400", category: "Produtos" },
  { key: "bm", label: "Business Manager", icon: Briefcase, color: "bg-green-500/20 text-green-400", category: "Produtos" },
  { key: "proxy", label: "Proxy", icon: Server, color: "bg-purple-500/20 text-purple-400", category: "Produtos" },
  { key: "page", label: "Página", icon: Globe, color: "bg-cyan-500/20 text-cyan-400", category: "Produtos" },
  // Estoque
  { key: "perfil-estoque", label: "Perfil (Estoque)", icon: CircleUser, color: "bg-cyan-500/20 text-cyan-400", category: "Estoque" },
  { key: "bm-estoque", label: "BM (Estoque)", icon: Building2, color: "bg-primary/20 text-primary", category: "Estoque" },
  { key: "pagina", label: "Página (Estoque)", icon: Flag, color: "bg-purple-500/20 text-purple-400", category: "Estoque" },
  { key: "combo", label: "Combo / Kit", icon: PackageOpen, color: "bg-amber-500/20 text-amber-400", category: "Estoque" },
  // Geral
  { key: "shield", label: "Segurança", icon: Shield, color: "bg-emerald-500/20 text-emerald-400", category: "Geral" },
  { key: "wifi", label: "Conexão", icon: Wifi, color: "bg-blue-500/20 text-blue-400", category: "Geral" },
  { key: "key", label: "Chave / Token", icon: Key, color: "bg-amber-500/20 text-amber-400", category: "Geral" },
  { key: "monitor", label: "Monitor", icon: Monitor, color: "bg-gray-500/20 text-gray-400", category: "Geral" },
  { key: "smartphone", label: "Smartphone", icon: Smartphone, color: "bg-indigo-500/20 text-indigo-400", category: "Geral" },
  { key: "credit-card", label: "Pagamento", icon: CreditCard, color: "bg-emerald-500/20 text-emerald-400", category: "Geral" },
  { key: "mail", label: "Email", icon: Mail, color: "bg-rose-500/20 text-rose-400", category: "Geral" },
  { key: "lock", label: "Bloqueio", icon: Lock, color: "bg-red-500/20 text-red-400", category: "Geral" },
];

export default function AdminPlataforma() {
  const [activeTab, setActiveTab] = useState<"tags" | "categorias" | "icones">("tags");
  const [statusTags, setStatusTags] = useState<TagItem[]>(defaultStatusTags);
  const [productTags, setProductTags] = useState<TagItem[]>(defaultProductTags);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);
  const [tagForm, setTagForm] = useState({ name: "", color: "#ef4444", type: "status" as "status" | "product" });

  // Categories state
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string; created_at: string }[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", slug: "" });
  const [savingCategory, setSavingCategory] = useState(false);

  // Fetch categories
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoadingCategories(true);
    const { data, error } = await supabase
      .from("product_categories")
      .select("*")
      .order("name");
    if (data) setCategories(data);
    if (error) toast.error("Erro ao carregar categorias");
    setLoadingCategories(false);
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  };

  const handleOpenCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm({ name: "", slug: "" });
    setCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: { id: string; name: string; slug: string }) => {
    setEditingCategory(cat);
    setCategoryForm({ name: cat.name, slug: cat.slug });
    setCategoryModalOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast.error("Nome da categoria é obrigatório");
      return;
    }
    setSavingCategory(true);
    const slug = categoryForm.slug || generateSlug(categoryForm.name);

    if (editingCategory) {
      const { error } = await supabase
        .from("product_categories")
        .update({ name: categoryForm.name, slug })
        .eq("id", editingCategory.id);
      if (error) toast.error("Erro ao atualizar categoria");
      else toast.success("Categoria atualizada!");
    } else {
      const { error } = await supabase
        .from("product_categories")
        .insert({ name: categoryForm.name, slug });
      if (error) toast.error("Erro ao criar categoria");
      else toast.success("Categoria criada!");
    }
    setSavingCategory(false);
    setCategoryModalOpen(false);
    fetchCategories();
  };

  const handleDeleteCategory = async (id: string) => {
    const { error } = await supabase.from("product_categories").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir categoria");
    else {
      toast.success("Categoria excluída!");
      fetchCategories();
    }
  };

  const tabs = [
    { key: "tags" as const, label: "Tags de Status", icon: Tag },
    { key: "categorias" as const, label: "Categorias", icon: FolderTree },
    { key: "icones" as const, label: "Banco de Ícones", icon: Palette },
  ];

  const handleOpenCreate = (type: "status" | "product") => {
    setEditingTag(null);
    setTagForm({ name: "", color: "#ef4444", type });
    setModalOpen(true);
  };

  const handleOpenEdit = (tag: TagItem) => {
    setEditingTag(tag);
    setTagForm({ name: tag.name, color: tag.color, type: tag.type });
    setModalOpen(true);
  };

  const handleSaveTag = () => {
    if (!tagForm.name.trim()) {
      toast.error("Nome da tag é obrigatório");
      return;
    }

    if (editingTag) {
      const updatedTag = { ...editingTag, name: tagForm.name, color: tagForm.color };
      if (editingTag.type === "status") {
        setStatusTags(prev => prev.map(t => t.id === editingTag.id ? updatedTag : t));
      } else {
        setProductTags(prev => prev.map(t => t.id === editingTag.id ? updatedTag : t));
      }
      toast.success("Tag atualizada com sucesso!");
    } else {
      const newTag: TagItem = {
        id: Date.now().toString(),
        name: tagForm.name,
        color: tagForm.color,
        type: tagForm.type,
      };
      if (tagForm.type === "status") {
        setStatusTags(prev => [...prev, newTag]);
      } else {
        setProductTags(prev => [...prev, newTag]);
      }
      toast.success("Tag criada com sucesso!");
    }
    setModalOpen(false);
  };

  const handleDeleteTag = (tag: TagItem) => {
    if (tag.type === "status") {
      setStatusTags(prev => prev.filter(t => t.id !== tag.id));
    } else {
      setProductTags(prev => prev.filter(t => t.id !== tag.id));
    }
    toast.success("Tag removida!");
  };

  const colorOptions = [
    "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6",
    "#ec4899", "#14b8a6", "#f97316", "#6b7280", "#dc2626",
  ];

  const filteredStatusTags = statusTags.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredProductTags = productTags.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="flex flex-col gap-8 py-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Palette className="w-4 h-4" />
            <span>Configurações</span>
            <span className="text-gray-600">/</span>
            <span>Plataforma</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
            Plataforma
          </h1>
          <p className="text-gray-400 text-base max-w-2xl">
            Gerencie tags, categorias e ícones utilizados na plataforma.
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border transition-all text-sm font-medium whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-transparent border-white/10 hover:bg-white/5 text-gray-300"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <Input
          type="text"
          placeholder="Buscar..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 rounded-xl bg-black/30 border-white/10 text-sm placeholder:text-gray-500 focus:border-primary focus:ring-primary"
        />
      </div>

      {/* Tags Tab */}
      {activeTab === "tags" && (
        <div className="flex flex-col gap-8">
          {/* Status Tags */}
          <section className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Tag className="w-5 h-5 text-primary" />
                Tags de Status
              </h2>
              <Button 
                onClick={() => handleOpenCreate("status")}
                className="bg-primary hover:bg-red-700 text-white font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 shadow-lg shadow-primary/20"
              >
                <Plus className="w-4 h-4" />
                Nova Tag
              </Button>
            </div>
            <div className="flex flex-wrap gap-3">
              {filteredStatusTags.map((tag) => (
                <div
                  key={tag.id}
                  className="group flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm font-medium text-white">{tag.name}</span>
                  <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenEdit(tag)}
                      className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                    >
                      <SquarePen className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTag(tag)}
                      className="p-1 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {filteredStatusTags.length === 0 && (
                <p className="text-gray-500 text-sm">Nenhuma tag de status encontrada.</p>
              )}
            </div>
          </section>

          {/* Product Tags */}
          <section className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Tag className="w-5 h-5 text-blue-400" />
                Tags de Produto
              </h2>
              <Button 
                onClick={() => handleOpenCreate("product")}
                className="bg-primary hover:bg-red-700 text-white font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 shadow-lg shadow-primary/20"
              >
                <Plus className="w-4 h-4" />
                Nova Tag
              </Button>
            </div>
            <div className="flex flex-wrap gap-3">
              {filteredProductTags.map((tag) => (
                <div
                  key={tag.id}
                  className="group flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm font-medium text-white">{tag.name}</span>
                  <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenEdit(tag)}
                      className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                    >
                      <SquarePen className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTag(tag)}
                      className="p-1 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {filteredProductTags.length === 0 && (
                <p className="text-gray-500 text-sm">Nenhuma tag de produto encontrada.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Categorias Tab */}
      {activeTab === "categorias" && (
        <section className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-primary" />
              Categorias da Plataforma
            </h2>
            <Button 
              onClick={handleOpenCreateCategory}
              className="bg-primary hover:bg-red-700 text-white font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 shadow-lg shadow-primary/20"
            >
              <Plus className="w-4 h-4" />
              Nova Categoria
            </Button>
          </div>

          {loadingCategories ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12">
              <FolderTree className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Nenhuma categoria cadastrada ainda.</p>
              <p className="text-gray-500 text-xs mt-1">Crie categorias para organizar os produtos na loja.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories
                .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((cat) => (
                <div
                  key={cat.id}
                  className="group flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <FolderTree className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{cat.name}</p>
                      <p className="text-xs text-gray-500">{cat.slug}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenEditCategory(cat)}
                      className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                    >
                      <SquarePen className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-2 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Ícones Tab */}
      {activeTab === "icones" && (
        <section className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" />
              Banco de Ícones
            </h2>
          </div>
          <p className="text-gray-500 text-sm mb-6">Ícones utilizados em produtos, estoque e categorias da plataforma FBFLIX.</p>
          
          {["Produtos", "Estoque", "Geral"].map((category) => {
            const icons = platformIcons.filter(i => i.category === category);
            return (
              <div key={category} className="mb-8 last:mb-0">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">{category}</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {icons.map((item) => {
                    const IconComp = item.icon;
                    return (
                      <div
                        key={item.key}
                        className="flex flex-col items-center gap-2.5 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer group"
                      >
                        <div className={`p-2.5 rounded-lg ${item.color} transition-colors`}>
                          <IconComp className="w-5 h-5" />
                        </div>
                        <span className="text-[11px] text-gray-500 group-hover:text-gray-300 truncate w-full text-center font-medium">
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Tag Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTag ? "Editar Tag" : "Nova Tag"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Nome</label>
              <Input
                value={tagForm.name}
                onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })}
                placeholder="Ex: Acabando Rápido"
                className="bg-black/30 border-white/10 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Cor</label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    onClick={() => setTagForm({ ...tagForm, color })}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      tagForm.color === color ? "border-white scale-110" : "border-transparent hover:border-white/30"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">Preview:</span>
              <span
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: tagForm.color + "20", border: `1px solid ${tagForm.color}40` }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tagForm.color }} />
                {tagForm.name || "Nome da Tag"}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} className="border-white/10 text-gray-300 hover:bg-white/5">
              Cancelar
            </Button>
            <Button onClick={handleSaveTag} className="bg-primary hover:bg-red-700 text-white">
              <Save className="w-4 h-4 mr-2" />
              {editingTag ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Create/Edit Modal */}
      <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Nome</label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value, slug: generateSlug(e.target.value) })}
                placeholder="Ex: Perfis Facebook"
                className="bg-black/30 border-white/10 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Slug</label>
              <Input
                value={categoryForm.slug}
                onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })}
                placeholder="perfis-facebook"
                className="bg-black/30 border-white/10 focus:border-primary font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Gerado automaticamente a partir do nome.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryModalOpen(false)} className="border-white/10 text-gray-300 hover:bg-white/5">
              Cancelar
            </Button>
            <Button onClick={handleSaveCategory} disabled={savingCategory} className="bg-primary hover:bg-red-700 text-white">
              {savingCategory ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {editingCategory ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
