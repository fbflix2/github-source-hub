import { useState, useEffect } from "react";
import { 
  Search, Plus, Upload, User, Briefcase, Globe, Server, Tag, Save, X,
  Filter, ChevronLeft, ChevronRight, Edit, Trash2, Image as ImageIcon, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  status: string;
  available: boolean;
  icon_type: string | null;
  image_url: string | null;
  tags: string[] | null;
  category_id: string | null;
  badge_text: string | null;
  badge_color: string | null;
  badge_icon: string | null;
  price_label: string | null;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

type ProductIcon = "perfil" | "bm" | "proxy" | "page";

const productIcons: Record<ProductIcon, React.ReactNode> = {
  perfil: <User className="h-5 w-5" />,
  bm: <Briefcase className="h-5 w-5" />,
  proxy: <Server className="h-5 w-5" />,
  page: <Globe className="h-5 w-5" />,
};

const iconColors: Record<ProductIcon, string> = {
  perfil: "bg-blue-500/20 text-blue-400",
  bm: "bg-green-500/20 text-green-400",
  proxy: "bg-purple-500/20 text-purple-400",
  page: "bg-cyan-500/20 text-cyan-400",
};

const ITEMS_PER_PAGE = 10;

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formStock, setFormStock] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formIcon, setFormIcon] = useState<ProductIcon>("perfil");
  const [formTags, setFormTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [formStatus, setFormStatus] = useState("active");

  // Table state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Category management
  const [newCategory, setNewCategory] = useState("");

  const fetchData = async () => {
    const [productsRes, categoriesRes] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("product_categories").select("*").order("name"),
    ]);
    setProducts(productsRes.data ?? []);
    setCategories(categoriesRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const resetForm = () => {
    setFormName(""); setFormPrice(""); setFormStock(""); setFormDescription("");
    setFormCategory(""); setFormIcon("perfil"); setFormTags([]); setFormStatus("active");
    setEditingProduct(null);
  };

  const openEditForm = (product: Product) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormPrice(product.price.toString());
    setFormStock(product.stock.toString());
    setFormDescription(product.description ?? "");
    setFormCategory(product.category_id ?? "");
    setFormIcon((product.icon_type as ProductIcon) ?? "perfil");
    setFormTags(product.tags ?? []);
    setFormStatus(product.status);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { toast.error("Nome do produto é obrigatório"); return; }
    setSaving(true);

    const payload = {
      name: formName,
      price: parseFloat(formPrice) || 0,
      stock: parseInt(formStock) || 0,
      description: formDescription || null,
      category_id: formCategory || null,
      icon_type: formIcon,
      tags: formTags.length > 0 ? formTags : null,
      status: formStatus,
      available: formStatus === "active",
    };

    let error;
    if (editingProduct) {
      ({ error } = await supabase.from("products").update(payload).eq("id", editingProduct.id));
    } else {
      ({ error } = await supabase.from("products").insert(payload));
    }

    setSaving(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success(editingProduct ? "Produto atualizado!" : "Produto criado!");
    resetForm();
    setShowForm(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success("Produto excluído!");
    fetchData();
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    const slug = newCategory.trim().toLowerCase().replace(/\s+/g, "-");
    const { error } = await supabase.from("product_categories").insert({ name: newCategory.trim(), slug });
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Categoria criada!");
    setNewCategory("");
    fetchData();
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      if (!formTags.includes(tagInput.trim())) setFormTags([...formTags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const getCategoryName = (catId: string | null) => {
    if (!catId) return "—";
    return categories.find(c => c.id === catId)?.name ?? "—";
  };

  // Filtering & pagination
  const filtered = products.filter(p => {
    const matchesSearch = !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.tags?.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = filterCategory === "all" || p.category_id === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Painel de Controle</h1>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="bg-primary hover:bg-primary/90 text-white gap-2">
          <Plus className="h-4 w-4" />
          NOVO PRODUTO
        </Button>
      </div>

      {/* Product Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { resetForm(); } setShowForm(open); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl text-white">
              {editingProduct ? "Editar Produto" : "Cadastrar Novo Produto"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Icon selector */}
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Ícone do Produto</label>
              <div className="flex gap-2">
                {(Object.keys(productIcons) as ProductIcon[]).map((icon) => (
                  <button key={icon} onClick={() => setFormIcon(icon)} className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all ${formIcon === icon ? `${iconColors[icon]} ring-2 ring-primary` : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700"}`}>
                    {productIcons[icon]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-zinc-400">Nome do Produto</label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex: Perfil Facebook High Limit - 2018" className="bg-zinc-900/50 border-zinc-700 text-white placeholder:text-zinc-500" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm text-zinc-400">Preço (R$)</label>
                <Input type="number" step="0.01" value={formPrice} onChange={e => setFormPrice(e.target.value)} placeholder="0,00" className="bg-zinc-900/50 border-zinc-700 text-white placeholder:text-zinc-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-zinc-400">Estoque</label>
                <Input type="number" value={formStock} onChange={e => setFormStock(e.target.value)} placeholder="0" className="bg-zinc-900/50 border-zinc-700 text-white placeholder:text-zinc-500" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-zinc-400">Descrição</label>
              <Textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Características do produto..." className="bg-zinc-900/50 border-zinc-700 text-white placeholder:text-zinc-500 min-h-[80px] resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm text-zinc-400">Categoria</label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger className="bg-zinc-900/50 border-zinc-700 text-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-zinc-400">Status</label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger className="bg-zinc-900/50 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-zinc-400">Tags</label>
              <div className="relative">
                <Input placeholder="Adicionar tags (Enter)..." value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleAddTag} className="bg-zinc-900/50 border-zinc-700 text-white placeholder:text-zinc-500 pr-8" />
                <Tag className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-yellow-500" />
              </div>
              {formTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {formTags.map(tag => (
                    <Badge key={tag} variant="secondary" className="bg-zinc-700 text-zinc-200 hover:bg-zinc-600 gap-1 cursor-pointer" onClick={() => setFormTags(formTags.filter(t => t !== tag))}>
                      {tag} <X className="h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <Button variant="ghost" onClick={() => { resetForm(); setShowForm(false); }} className="text-zinc-400 hover:text-white">Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-white gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editingProduct ? "Salvar Alterações" : "SALVAR PRODUTO"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Categories Management */}
      <div className="glass-panel rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-white">
          <Briefcase className="h-4 w-4 text-zinc-400" />
          <h3 className="font-medium text-sm">Gerenciar Categorias</h3>
        </div>
        <div className="flex gap-2">
          <Input placeholder="Nome da nova categoria..." value={newCategory} onChange={e => setNewCategory(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddCategory()} className="bg-zinc-900/50 border-zinc-700 text-white placeholder:text-zinc-500 text-sm" />
          <Button size="sm" variant="secondary" className="bg-zinc-700 hover:bg-zinc-600 px-3" onClick={handleAddCategory}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <Badge key={cat.id} className="bg-zinc-800 text-zinc-300 text-xs">{cat.name}</Badge>
            ))}
          </div>
        )}
      </div>

      {/* Products Table */}
      <div className="glass-panel rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-medium text-white">Todos os Produtos</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input placeholder="Buscar por nome ou tag..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="bg-zinc-900/50 border-zinc-700 text-white placeholder:text-zinc-500 pl-8 w-[220px] text-sm" />
            </div>
            <Select value={filterCategory} onValueChange={v => { setFilterCategory(v); setCurrentPage(1); }}>
              <SelectTrigger className="bg-zinc-900/50 border-zinc-700 text-white w-[160px] text-sm"><SelectValue placeholder="Todas Categorias" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Categorias</SelectItem>
                {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400 text-xs font-medium">IMAGEM</TableHead>
                <TableHead className="text-zinc-400 text-xs font-medium">NOME DO PRODUTO</TableHead>
                <TableHead className="text-zinc-400 text-xs font-medium">CATEGORIA</TableHead>
                <TableHead className="text-zinc-400 text-xs font-medium">TAGS</TableHead>
                <TableHead className="text-zinc-400 text-xs font-medium">PREÇO</TableHead>
                <TableHead className="text-zinc-400 text-xs font-medium">ESTOQUE</TableHead>
                <TableHead className="text-zinc-400 text-xs font-medium">STATUS</TableHead>
                <TableHead className="text-zinc-400 text-xs font-medium">AÇÕES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-zinc-500 py-12">
                    Nenhum produto cadastrado ainda.
                  </TableCell>
                </TableRow>
              ) : paginated.map(product => {
                const iconKey = (product.icon_type as ProductIcon) || "perfil";
                return (
                  <TableRow key={product.id} className="border-zinc-800 hover:bg-zinc-800/30">
                    <TableCell>
                      {product.image_url ? (
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-800">
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconColors[iconKey] || "bg-zinc-700"}`}>
                          {productIcons[iconKey] || <ImageIcon className="h-5 w-5" />}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-white text-sm font-medium max-w-[180px] truncate">{product.name}</TableCell>
                    <TableCell className="text-zinc-400 text-sm">{getCategoryName(product.category_id)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {product.tags && product.tags.length > 0 ? product.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs bg-zinc-700 text-zinc-300">{tag}</Badge>
                        )) : <span className="text-zinc-600 text-xs">—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-white text-sm">R$ {product.price.toFixed(2).replace(".", ",")}</TableCell>
                    <TableCell className={`text-sm font-medium ${product.stock > 10 ? "text-green-400" : product.stock > 0 ? "text-yellow-400" : "text-red-400"}`}>
                      {product.stock} un.
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${product.status === "active" ? "bg-green-500/20 text-green-400" : "bg-zinc-600 text-zinc-400"}`}>
                        ● {product.status === "active" ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-zinc-400 hover:text-white" onClick={() => openEditForm(product)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-zinc-400 hover:text-red-400" onClick={() => handleDelete(product.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-zinc-500">
            Mostrando {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filtered.length)}-{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} de {filtered.length} produtos
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" className="text-zinc-400 hover:text-white text-xs gap-1" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(page => (
                <Button key={page} size="sm" variant={currentPage === page ? "default" : "ghost"} className={`h-7 w-7 p-0 ${currentPage === page ? "bg-primary text-white" : "text-zinc-400 hover:text-white"}`} onClick={() => setCurrentPage(page)}>
                  {page}
                </Button>
              ))}
              <Button size="sm" variant="ghost" className="text-zinc-400 hover:text-white text-xs gap-1" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                Próximo <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
