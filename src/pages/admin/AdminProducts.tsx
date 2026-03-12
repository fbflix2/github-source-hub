import { useState, useEffect } from "react";
import { 
  Search, Plus, Upload, User, Briefcase, Globe, Server, Tag, Save, X,
  Filter, ChevronLeft, ChevronRight, Edit, Trash2, Image as ImageIcon, Loader2, ImagePlus,
  BarChart3, Download, BellRing, Clock, CheckSquare, Square, CheckCheck, Store
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useProxyBRProducts } from "@/hooks/useProxyBR";
import { WaitlistTab } from "@/components/admin/WaitlistTab";
import { StockItemsModal } from "@/components/admin/StockItemsModal";

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
  external_id: string | null;
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
  const [formStatus, setFormStatus] = useState("estoque_interno");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formBadgeText, setFormBadgeText] = useState("");
  const [formBadgeIcon, setFormBadgeIcon] = useState("");
  const [formBadgeColor, setFormBadgeColor] = useState("");
  const [productImages, setProductImages] = useState<{ id: string; name: string; url: string }[]>([]);
  const [showImagePicker, setShowImagePicker] = useState(false);

  // Table state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Category management
  const [newCategory, setNewCategory] = useState("");

  // Sales data
  const [salesByProduct, setSalesByProduct] = useState<Record<string, number>>({});

  // Stock items modal
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockModalProduct, setStockModalProduct] = useState<{ id: string; name: string } | null>(null);

  // Proxy import
  const { data: proxyProductsData } = useProxyBRProducts();
  const [importingProxy, setImportingProxy] = useState(false);
  const [proxyImages, setProxyImages] = useState<{ name: string; url: string }[]>([]);

  const fetchData = async () => {
    const [productsRes, categoriesRes, imagesRes, salesRes, proxyImgRes] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("product_categories").select("*").order("name"),
      supabase.from("product_images").select("id, name, url").order("created_at", { ascending: false }),
      supabase.from("order_items").select("product_id, quantity"),
      supabase.from("product_images").select("name, url").eq("category", "proxy"),
    ]);
    setProducts(productsRes.data ?? []);
    setCategories(categoriesRes.data ?? []);
    setProductImages(imagesRes.data ?? []);
    setProxyImages(proxyImgRes.data ?? []);

    // Aggregate sales by product
    const sales: Record<string, number> = {};
    (salesRes.data ?? []).forEach((item: any) => {
      if (item.product_id) {
        sales[item.product_id] = (sales[item.product_id] || 0) + (item.quantity || 1);
      }
    });
    setSalesByProduct(sales);

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getProxyImageUrl = (name: string): string | null => {
    const match = proxyImages.find(
      (img) => img.name.toLowerCase().trim() === name.toLowerCase().trim()
    );
    return match?.url || null;
  };

  const handleImportProxyProducts = async () => {
    const apiProducts = proxyProductsData?.data || proxyProductsData;
    if (!apiProducts || !Array.isArray(apiProducts) || apiProducts.length === 0) {
      toast.error("Nenhum produto proxy encontrado na ProxyBR");
      return;
    }

    // Find or create "Proxy" category
    let proxyCatId: string | null = null;
    const existingCat = categories.find(c => c.name.toLowerCase() === "proxy");
    if (existingCat) {
      proxyCatId = existingCat.id;
    } else {
      const { data: newCat, error: catErr } = await supabase
        .from("product_categories")
        .insert({ name: "Proxy", slug: "proxy" })
        .select("id")
        .single();
      if (newCat) proxyCatId = newCat.id;
    }

    setImportingProxy(true);
    let created = 0, skipped = 0, updated = 0;

    for (const product of apiProducts) {
      const name = product.name || `Proxy ${product.id}`;
      const externalId = String(product.id);

      // Check if already exists by external_id
      const existsByExternalId = products.find((p) => p.external_id === externalId);
      if (existsByExternalId) { skipped++; continue; }

      // Check if exists by name (legacy, without external_id) - normalize spaces
      const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
      const existsByName = products.find(
        (p) => normalize(p.name) === normalize(name) && p.icon_type === "proxy"
      );
      if (existsByName) {
        // Update external_id on existing product
        await supabase.from("products").update({ external_id: externalId } as any).eq("id", existsByName.id);
        updated++;
        continue;
      }

      const variants = product.variants?.data || product.variants || [];
      const cheapestVariant = variants.length
        ? variants.reduce((min: any, v: any) => ((v.price || 0) < (min.price || 0) ? v : min), variants[0])
        : null;
      const price = cheapestVariant?.price || product.price || 0;

      const tags: string[] = [];
      if (product.type) tags.push(product.type);
      tags.push("Proxy");

      const imageUrl = getProxyImageUrl(name);

      const { error } = await supabase.from("products").insert({
        name,
        price: Number(price),
        stock: 999,
        description: product.description || null,
        category_id: proxyCatId,
        icon_type: "proxy",
        tags: tags.length > 0 ? tags : null,
        status: "active",
        available: true,
        image_url: imageUrl,
        external_id: externalId,
      } as any);
      if (!error) created++;
    }

    setImportingProxy(false);
    const messages: string[] = [];
    if (created > 0) messages.push(`${created} importado(s)`);
    if (updated > 0) messages.push(`${updated} vinculado(s)`);
    if (skipped > 0) messages.push(`${skipped} já existiam`);
    if (created > 0 || updated > 0) {
      toast.success(messages.join(", ") + "!");
      fetchData();
    } else {
      toast.info(`Todos os produtos proxy já estão cadastrados. (${skipped} ignorados)`);
    }
  };

  const resetForm = () => {
    setFormName(""); setFormPrice(""); setFormStock(""); setFormDescription("");
    setFormCategory(""); setFormIcon("perfil"); setFormTags([]); setFormStatus("estoque_interno");
    setFormImageUrl(""); setFormBadgeText(""); setFormBadgeIcon(""); setFormBadgeColor("");
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
    setFormImageUrl(product.image_url ?? "");
    setFormBadgeText(product.badge_text ?? "");
    setFormBadgeIcon(product.badge_icon ?? "");
    setFormBadgeColor(product.badge_color ?? "");
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
      image_url: formImageUrl || null,
      badge_text: formBadgeText || null,
      badge_icon: formBadgeIcon || null,
      badge_color: formBadgeColor || null,
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
    if (!window.confirm("Tem certeza que deseja excluir este produto?")) return;
    
    // Remove foreign key references first
    await supabase.from("stock_items").update({ product_id: null }).eq("product_id", id);
    await supabase.from("order_items").update({ product_id: null }).eq("product_id", id);
    await supabase.from("subscriptions").update({ product_id: null }).eq("product_id", id);
    
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success("Produto excluído!");
    fetchData();
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Tem certeza que deseja excluir ${selectedIds.size} produto(s)?`)) return;
    
    for (const id of selectedIds) {
      await supabase.from("stock_items").update({ product_id: null }).eq("product_id", id);
      await supabase.from("order_items").update({ product_id: null }).eq("product_id", id);
      await supabase.from("subscriptions").update({ product_id: null }).eq("product_id", id);
      await supabase.from("products").delete().eq("id", id);
    }
    toast.success(`${selectedIds.size} produto(s) excluído(s)!`);
    setSelectedIds(new Set());
    fetchData();
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      await supabase.from("products").update({ status: newStatus, available: newStatus === "active" }).eq("id", id);
    }
    toast.success(`${selectedIds.size} produto(s) atualizado(s) para "${newStatus === "active" ? "Ativo" : newStatus === "estoque_interno" ? "Estoque Interno" : "Inativo"}"!`);
    setSelectedIds(new Set());
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

  // Build a map of external_id → real API stock for proxy products
  const apiStockMap = new Map<string, number>();
  const apiProducts = proxyProductsData?.data || (Array.isArray(proxyProductsData) ? proxyProductsData : []);
  if (Array.isArray(apiProducts)) {
    for (const ap of apiProducts) {
      const variants = ap.variant || ap.variants || [];
      const totalStock = variants.reduce((sum: number, v: any) => sum + (v.stocks ?? 0), 0);
      apiStockMap.set(String(ap.id), totalStock);
    }
  }

  const getDisplayStock = (product: Product): number => {
    if (product.external_id && apiStockMap.has(product.external_id)) {
      return apiStockMap.get(product.external_id)!;
    }
    return product.stock;
  };

  // Filtering & pagination
  const filtered = products.filter(p => {
    const matchesSearch = !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.tags?.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = filterCategory === "all" || p.category_id === filterCategory;
    const matchesStatus = filterStatus === "all" || p.status === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const allPageSelected = paginated.length > 0 && paginated.every(p => selectedIds.has(p.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        paginated.forEach(p => next.delete(p.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        paginated.forEach(p => next.add(p.id));
        return next;
      });
    }
  };

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
        <div className="flex gap-2">
          <Button
            onClick={handleImportProxyProducts}
            disabled={importingProxy}
            variant="outline"
            className="border-primary/30 text-primary hover:bg-primary/10 gap-2"
          >
            {importingProxy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Importar Proxys
          </Button>
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="bg-primary hover:bg-primary/90 text-white gap-2">
            <Plus className="h-4 w-4" />
            NOVO PRODUTO
          </Button>
        </div>
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
                    <SelectItem value="estoque_interno">Estoque Interno</SelectItem>
                    <SelectItem value="active">Ativo (na loja)</SelectItem>
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

            {/* Badge / Etiqueta */}
            <div className="space-y-3">
              <label className="text-sm text-zinc-400">Etiqueta (Badge)</label>
              
              {/* Texto */}
              <div className="space-y-1">
                <span className="text-[11px] text-zinc-500">Texto</span>
                <Input value={formBadgeText} onChange={e => setFormBadgeText(e.target.value)} placeholder="Ex: SOCKS5, TURBO, Premium" className="bg-zinc-900/50 border-zinc-700 text-white placeholder:text-zinc-500 h-9 text-sm" />
              </div>

              {/* Cor - Seletor visual */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-zinc-500">Cor</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Vermelho", value: "bg-red-500/20 text-red-400 border-red-500/30" },
                    { label: "Verde", value: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
                    { label: "Azul", value: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
                    { label: "Roxo", value: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
                    { label: "Amarelo", value: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
                    { label: "Laranja", value: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
                    { label: "Rosa", value: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
                    { label: "Ciano", value: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
                    { label: "Cinza", value: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
                  ].map((color) => (
                    <button
                      key={color.label}
                      type="button"
                      onClick={() => setFormBadgeColor(color.value)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 transition-all ${color.value} ${formBadgeColor === color.value ? "ring-2 ring-white/50 scale-105" : "opacity-70 hover:opacity-100"}`}
                    >
                      {color.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ícone - Seletor visual */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-zinc-500">Ícone</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { name: "bolt", label: "Raio" },
                    { name: "star", label: "Estrela" },
                    { name: "verified", label: "Verificado" },
                    { name: "diamond", label: "Diamante" },
                    { name: "shield", label: "Escudo" },
                    { name: "rocket_launch", label: "Foguete" },
                    { name: "speed", label: "Velocidade" },
                    { name: "lock", label: "Cadeado" },
                    { name: "public", label: "Global" },
                    { name: "dns", label: "DNS" },
                    { name: "vpn_key", label: "VPN" },
                    { name: "wifi", label: "WiFi" },
                    { name: "trending_up", label: "Subindo" },
                    { name: "local_fire_department", label: "Fogo" },
                    { name: "workspace_premium", label: "Premium" },
                    { name: "new_releases", label: "Novo" },
                    { name: "thumb_up", label: "Joinha" },
                    { name: "visibility", label: "Olho" },
                  ].map((icon) => (
                    <button
                      key={icon.name}
                      type="button"
                      onClick={() => setFormBadgeIcon(formBadgeIcon === icon.name ? "" : icon.name)}
                      title={icon.label}
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${formBadgeIcon === icon.name ? "bg-primary/20 border-primary/50 text-primary ring-1 ring-primary/30" : "bg-zinc-900/50 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500"}`}
                    >
                      <span className="material-symbols-outlined text-[16px]">{icon.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              {formBadgeText && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-900/50 border border-zinc-700/50">
                  <span className="text-[11px] text-zinc-500">Preview:</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${formBadgeColor || "bg-muted text-foreground border-border"}`}>
                    {formBadgeIcon && <span className="material-symbols-outlined text-[11px]">{formBadgeIcon}</span>}
                    {formBadgeText}
                  </span>
                </div>
              )}
            </div>

            {/* Image selector */}
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Foto do Produto</label>
              {formImageUrl ? (
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-800">
                    <img src={formImageUrl} alt="Produto" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-700" onClick={() => setShowImagePicker(true)}>Trocar</Button>
                    <Button type="button" size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => setFormImageUrl("")}>Remover</Button>
                  </div>
                </div>
              ) : (
                <Button type="button" variant="outline" className="border-zinc-700 text-zinc-400 hover:bg-zinc-700 gap-2 w-full justify-center" onClick={() => setShowImagePicker(true)}>
                  <ImagePlus className="h-4 w-4" /> Selecionar imagem
                </Button>
              )}
            </div>

            {/* Image picker modal */}
            {showImagePicker && (
              <div className="border border-zinc-700 rounded-lg p-3 space-y-2 bg-zinc-900/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400 font-medium">Biblioteca de Imagens</span>
                  <button onClick={() => setShowImagePicker(false)} className="text-zinc-500 hover:text-white"><X className="h-4 w-4" /></button>
                </div>
                {productImages.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-4 text-center">Nenhuma imagem na biblioteca. Adicione em Plataforma → Imagens.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto">
                    {productImages.map(img => (
                      <button key={img.id} onClick={() => { setFormImageUrl(img.url); setShowImagePicker(false); }}
                        className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${formImageUrl === img.url ? "border-primary" : "border-transparent hover:border-zinc-600"}`}>
                        <img src={img.url} alt={img.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
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

      {/* Tabs */}
      <Tabs defaultValue="produtos" className="space-y-4">
        <TabsList className="bg-zinc-800/50 border border-zinc-700">
          <TabsTrigger value="produtos" className="data-[state=active]:bg-primary data-[state=active]:text-white text-zinc-400">Produtos</TabsTrigger>
          <TabsTrigger value="vendas" className="data-[state=active]:bg-primary data-[state=active]:text-white text-zinc-400 gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Visão de Vendas
          </TabsTrigger>
          <TabsTrigger value="espera" className="data-[state=active]:bg-primary data-[state=active]:text-white text-zinc-400 gap-1.5">
            <BellRing className="h-3.5 w-3.5" />
            Produtos em Espera
          </TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="space-y-4">
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
                <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setCurrentPage(1); }}>
                  <SelectTrigger className="bg-zinc-900/50 border-zinc-700 text-white w-[160px] text-sm"><SelectValue placeholder="Todos Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Status</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="estoque_interno">Estoque Interno</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Bulk Actions Bar */}
            {someSelected && (
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/20">
                <CheckCheck className="h-4 w-4 text-primary" />
                <span className="text-sm text-white font-medium">{selectedIds.size} selecionado(s)</span>
                <div className="flex items-center gap-2 ml-auto">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1.5 h-8 text-xs" onClick={() => handleBulkStatusChange("active")}>
                    <Store className="h-3.5 w-3.5" />
                    Enviar para Loja
                  </Button>
                  <Select onValueChange={handleBulkStatusChange}>
                    <SelectTrigger className="bg-zinc-900/80 border-zinc-700 text-white w-[170px] text-xs h-8"><SelectValue placeholder="Alterar status..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Marcar como Ativo</SelectItem>
                      <SelectItem value="estoque_interno">Marcar como Estoque Interno</SelectItem>
                      <SelectItem value="inactive">Marcar como Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1.5 h-8 text-xs" onClick={handleBulkDelete}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </Button>
                  <Button size="sm" variant="ghost" className="text-zinc-400 hover:text-white h-8 text-xs" onClick={() => setSelectedIds(new Set())}>
                    Limpar seleção
                  </Button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="w-10">
                      <Checkbox checked={allPageSelected} onCheckedChange={toggleSelectAll} className="border-zinc-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                    </TableHead>
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
                      <TableCell colSpan={9} className="text-center text-zinc-500 py-12">
                        Nenhum produto cadastrado ainda.
                      </TableCell>
                    </TableRow>
                  ) : paginated.map(product => {
                    const iconKey = (product.icon_type as ProductIcon) || "perfil";
                    const isSelected = selectedIds.has(product.id);
                    return (
                      <TableRow key={product.id} className={`border-zinc-800 hover:bg-zinc-800/30 ${isSelected ? "bg-primary/5" : ""}`}>
                        <TableCell>
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(product.id)} className="border-zinc-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                        </TableCell>
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
                        <TableCell className="text-white text-sm font-medium whitespace-normal break-words">{product.name}</TableCell>
                        <TableCell className="text-zinc-400 text-sm">{getCategoryName(product.category_id)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {product.tags && product.tags.length > 0 ? product.tags.map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs bg-zinc-700 text-zinc-300">{tag}</Badge>
                            )) : <span className="text-zinc-600 text-xs">—</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-white text-sm">R$ {product.price.toFixed(2).replace(".", ",")}</TableCell>
                        <TableCell className={`text-sm font-medium ${getDisplayStock(product) > 10 ? "text-green-400" : getDisplayStock(product) > 0 ? "text-yellow-400" : "text-red-400"}`}>
                          {getDisplayStock(product)} un.
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${
                            product.status === "active" ? "bg-green-500/20 text-green-400" : 
                            product.status === "estoque_interno" ? "bg-yellow-500/20 text-yellow-400" : 
                            "bg-zinc-600 text-zinc-400"
                          }`}>
                            ● {product.status === "active" ? "Ativo" : product.status === "estoque_interno" ? "Estoque Interno" : "Inativo"}
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
        </TabsContent>

        {/* Sales Overview Tab */}
        <TabsContent value="vendas">
          <div className="glass-panel rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-white">Visão Geral de Vendas</h3>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-zinc-400">Total de produtos: <span className="text-white font-medium">{products.length}</span></span>
                <span className="text-zinc-400">Total vendidos: <span className="text-green-400 font-medium">{Object.values(salesByProduct).reduce((a, b) => a + b, 0)}</span></span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400 text-xs font-medium">IMAGEM</TableHead>
                    <TableHead className="text-zinc-400 text-xs font-medium">PRODUTO</TableHead>
                    <TableHead className="text-zinc-400 text-xs font-medium">CATEGORIA</TableHead>
                    <TableHead className="text-zinc-400 text-xs font-medium">PREÇO</TableHead>
                    <TableHead className="text-zinc-400 text-xs font-medium">ESTOQUE ATUAL</TableHead>
                    <TableHead className="text-zinc-400 text-xs font-medium">VENDIDOS</TableHead>
                    <TableHead className="text-zinc-400 text-xs font-medium">STATUS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-zinc-500 py-12">
                        Nenhum produto cadastrado ainda.
                      </TableCell>
                    </TableRow>
                  ) : [...products].sort((a, b) => (salesByProduct[b.id] || 0) - (salesByProduct[a.id] || 0)).map(product => {
                    const iconKey = (product.icon_type as ProductIcon) || "perfil";
                    const sold = salesByProduct[product.id] || 0;
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
                        <TableCell className="text-white text-sm font-medium">{product.name}</TableCell>
                        <TableCell className="text-zinc-400 text-sm">{getCategoryName(product.category_id)}</TableCell>
                        <TableCell className="text-white text-sm">R$ {product.price.toFixed(2).replace(".", ",")}</TableCell>
                        <TableCell 
                          className={`text-sm font-medium cursor-pointer hover:underline ${getDisplayStock(product) > 10 ? "text-green-400" : getDisplayStock(product) > 0 ? "text-yellow-400" : "text-red-400"}`}
                          onClick={() => { setStockModalProduct({ id: product.id, name: product.name }); setStockModalOpen(true); }}
                        >
                          {getDisplayStock(product)} un.
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm font-bold ${sold > 0 ? "text-green-400" : "text-zinc-500"}`}>
                            {sold}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${
                            product.status === "active" ? "bg-green-500/20 text-green-400" : 
                            product.status === "estoque_interno" ? "bg-yellow-500/20 text-yellow-400" : 
                            "bg-zinc-600 text-zinc-400"
                          }`}>
                            ● {product.status === "active" ? "Ativo" : product.status === "estoque_interno" ? "Estoque Interno" : "Inativo"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="espera">
          <WaitlistTab />
        </TabsContent>
      </Tabs>

      {stockModalProduct && (
        <StockItemsModal
          open={stockModalOpen}
          onOpenChange={setStockModalOpen}
          productId={stockModalProduct.id}
          productName={stockModalProduct.name}
        />
      )}
    </div>
  );
}
