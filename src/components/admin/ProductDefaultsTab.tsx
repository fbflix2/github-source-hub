import { useState, useEffect } from "react";
import { Plus, Trash2, SquarePen, Save, Loader2, PackageOpen, X, Tag, Download, AlertTriangle, DollarSign, Clock, FileText, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProxyBRProducts } from "@/hooks/useProxyBR";

interface ProductDefault {
  id: string;
  name: string;
  tags: string[];
  price: number;
  tempo_plataforma: string | null;
  description: string | null;
  default_image: string | null;
  created_at: string;
}

interface ProductImage {
  id: string;
  name: string;
  url: string;
  category: string;
}

interface ProductDefaultsTabProps {
  searchTerm: string;
}

export default function ProductDefaultsTab({ searchTerm }: ProductDefaultsTabProps) {
  const [items, setItems] = useState<ProductDefault[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductDefault | null>(null);
  const [formName, setFormName] = useState("");
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formPrice, setFormPrice] = useState("");
  const [formTempo, setFormTempo] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formImage, setFormImage] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [importingProxy, setImportingProxy] = useState(false);
  const { data: proxyData } = useProxyBRProducts();
  const [localProducts, setLocalProducts] = useState<{ id: string; name: string }[]>([]);
  const [productImages, setProductImages] = useState<ProductImage[]>([]);

  useEffect(() => {
    fetchItems();
    fetchLocalProducts();
    fetchProductImages();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("product_defaults")
      .select("*")
      .order("name");
    if (data) setItems(data as ProductDefault[]);
    if (error) toast.error("Erro ao carregar padrões de produto");
    setLoading(false);
  };

  const fetchLocalProducts = async () => {
    const catRes = await supabase.from("product_categories").select("id").eq("slug", "proxy").single();
    if (!catRes.data) return;
    const { data } = await supabase
      .from("products")
      .select("id, name")
      .eq("category_id", catRes.data.id);
    if (data) setLocalProducts(data);
  };

  const fetchProductImages = async () => {
    const { data } = await supabase.from("product_images").select("*").order("name");
    if (data) setProductImages(data as ProductImage[]);
  };

  const getProductDivergence = (defaultName: string): string | null => {
    // Find a local product whose name matches loosely (case-insensitive)
    const match = localProducts.find(
      (p) => p.name.toLowerCase().trim() === defaultName.toLowerCase().trim()
    );
    if (match) return null; // names match, no divergence
    // Check if there's a product that could be related (partial match)
    const partial = localProducts.find(
      (p) => p.name.toLowerCase().includes(defaultName.toLowerCase().substring(0, 10)) ||
             defaultName.toLowerCase().includes(p.name.toLowerCase().substring(0, 10))
    );
    if (partial) return `Nome no produto: "${partial.name}"`;
    return null;
  };

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormTags([]);
    setFormPrice("");
    setFormTempo("");
    setFormDescription("");
    setFormImage("");
    setTagInput("");
    setModalOpen(true);
  };

  const openEdit = (item: ProductDefault) => {
    setEditing(item);
    setFormName(item.name);
    setFormTags([...item.tags]);
    setFormPrice(item.price ? item.price.toFixed(2) : "");
    setFormTempo(item.tempo_plataforma || "");
    setFormDescription(item.description || "");
    setFormImage(item.default_image || "");
    setTagInput("");
    setModalOpen(true);
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;
    if (formTags.includes(tag)) {
      toast.error("Tag já adicionada");
      return;
    }
    setFormTags((prev) => [...prev, tag]);
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setFormTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error("Nome do produto é obrigatório");
      return;
    }
    setSaving(true);

    const payload = {
      name: formName.trim(),
      tags: formTags,
      price: parseFloat(formPrice) || 0,
      tempo_plataforma: formTempo || null,
      description: formDescription.trim() || null,
      default_image: formImage || null,
    };

    if (editing) {
      const { error } = await supabase
        .from("product_defaults")
        .update(payload as any)
        .eq("id", editing.id);
      if (error) toast.error("Erro ao atualizar");
      else toast.success("Padrão atualizado!");
    } else {
      const { error } = await supabase
        .from("product_defaults")
        .insert(payload as any);
      if (error) toast.error("Erro ao criar");
      else toast.success("Padrão criado!");
    }
    setSaving(false);
    setModalOpen(false);
    fetchItems();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("product_defaults").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else {
      toast.success("Padrão removido!");
      fetchItems();
    }
  };

  const handleImportProxy = async () => {
    const products = proxyData?.data || proxyData;
    if (!products || !Array.isArray(products) || products.length === 0) {
      toast.error("Nenhum produto proxy encontrado na ProxyBR");
      return;
    }

    setImportingProxy(true);
    let created = 0;
    let skipped = 0;

    for (const product of products) {
      const name = product.name || product.title || `Proxy ${product.id}`;
      // Check if already exists
      const exists = items.some((i) => i.name.toLowerCase() === name.toLowerCase());
      if (exists) {
        skipped++;
        continue;
      }

      // Build tags from product info
      const tags: string[] = [];
      if (product.type) tags.push(product.type);
      if (product.protocol) tags.push(product.protocol);
      if (product.variants && Array.isArray(product.variants)) {
        for (const v of product.variants) {
          if (v.name && !tags.includes(v.name)) tags.push(v.name);
        }
      }
      if (product.location || product.country) tags.push(product.location || product.country);
      tags.push("Proxy");

      const { error } = await supabase
        .from("product_defaults")
        .insert({ name, tags } as any);
      if (!error) created++;
    }

    setImportingProxy(false);
    if (created > 0) {
      toast.success(`${created} padrão(ões) de proxy importado(s)!${skipped > 0 ? ` ${skipped} já existiam.` : ""}`);
      fetchItems();
    } else {
      toast.info(`Todos os produtos proxy já estão cadastrados. (${skipped} ignorados)`);
    }
  };

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <>
      <section className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <PackageOpen className="w-5 h-5 text-primary" />
            Padrões de Produtos
          </h2>
          <div className="flex gap-2">
            <Button
              onClick={handleImportProxy}
              disabled={importingProxy}
              variant="outline"
              className="border-primary/30 text-primary hover:bg-primary/10 font-bold py-2.5 px-5 rounded-xl flex items-center gap-2"
            >
              {importingProxy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Importar Proxys
            </Button>
            <Button
              onClick={openCreate}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 shadow-lg shadow-primary/20"
            >
              <Plus className="w-4 h-4" />
              Novo Padrão
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground text-sm mb-6">
          Crie nomes padrão de produtos com tags pré-definidas. Na blocagem, ao selecionar um padrão, as tags serão vinculadas automaticamente.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <PackageOpen className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Nenhum padrão de produto cadastrado.</p>
            <p className="text-gray-500 text-xs mt-1">Crie padrões para agilizar a blocagem.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item) => {
              const divergence = getProductDivergence(item.name);
              return (
              <div
                key={item.id}
                className={`group relative p-5 rounded-xl bg-white/5 border ${divergence ? 'border-yellow-500/40' : 'border-white/10'} hover:border-white/20 transition-all`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-white text-sm">{item.name}</h3>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(item)}
                      className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                    >
                      <SquarePen className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {/* Price & Tempo info */}
                {(item.price > 0 || item.tempo_plataforma) && (
                  <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
                    {item.price > 0 && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        R$ {item.price.toFixed(2)}
                      </span>
                    )}
                    {item.tempo_plataforma && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {item.tempo_plataforma}
                      </span>
                    )}
                  </div>
                )}
                {item.description && (
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{item.description}</p>
                )}
                {divergence && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-1.5 mb-3 px-2 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-medium cursor-help">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Divergência de nome</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        <p className="text-xs">{divergence}. Defina o mesmo nome no padrão e no produto para sincronizar corretamente.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {item.tags.length === 0 ? (
                    <span className="text-xs text-gray-600">Sem tags</span>
                  ) : (
                    item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary text-xs font-medium"
                      >
                        <Tag className="w-3 h-3" />
                        {tag}
                      </span>
                    ))
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Padrão" : "Novo Padrão de Produto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Nome do Produto</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Perfil BR Marketplace"
                className="bg-black/30 border-white/10 focus:border-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" /> Preço (R$)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  placeholder="0.00"
                  className="bg-black/30 border-white/10 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Tempo Plataforma
                </label>
                <Select value={formTempo} onValueChange={setFormTempo}>
                  <SelectTrigger className="bg-black/30 border-white/10">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0-1-mes">0-1 mês</SelectItem>
                    <SelectItem value="3-meses">3 meses</SelectItem>
                    <SelectItem value="6-meses">6 meses</SelectItem>
                    <SelectItem value="1-ano">1 ano</SelectItem>
                    <SelectItem value="2-anos">2+ anos</SelectItem>
                    <SelectItem value="5-anos">5+ anos</SelectItem>
                    <SelectItem value="10-anos">10+ anos</SelectItem>
                  </SelectContent>
                </Select>
            </div>
            {/* Image selector */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" /> Imagem Padrão
              </label>
              {formImage && (
                <div className="relative mb-2 w-16 h-16 rounded-lg overflow-hidden border border-white/10">
                  <img src={formImage} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setFormImage("")}
                    className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 hover:bg-black/80 text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {productImages.length > 0 ? (
                <div className="grid grid-cols-6 gap-1.5 max-h-[120px] overflow-y-auto rounded-lg border border-white/10 p-2 bg-black/20">
                  {productImages.map((img) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => setFormImage(img.url)}
                      className={`w-full aspect-square rounded-md overflow-hidden border-2 transition-all ${formImage === img.url ? "border-primary ring-1 ring-primary" : "border-transparent hover:border-white/30"}`}
                    >
                      <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma imagem cadastrada. Adicione imagens na seção de Imagens.</p>
              )}
            </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Descrição
              </label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Descrição do produto..."
                rows={3}
                className="bg-black/30 border-white/10 focus:border-primary resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Tags</label>
              <div className="flex gap-2 mb-3">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Digite uma tag e pressione Enter"
                  className="bg-black/30 border-white/10 focus:border-primary flex-1"
                />
                <Button
                  type="button"
                  onClick={addTag}
                  variant="outline"
                  className="border-white/10 text-gray-300 hover:bg-white/5 px-3"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 min-h-[32px]">
                {formTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-medium"
                  >
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-red-400 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {formTags.length === 0 && (
                  <span className="text-xs text-gray-600">Nenhuma tag adicionada</span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} className="border-white/10 text-gray-300 hover:bg-white/5">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-red-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
