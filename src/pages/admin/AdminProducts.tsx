import { useState } from "react";
import { 
  Search, 
  Plus, 
  Upload, 
  User, 
  Briefcase, 
  Globe, 
  Server,
  Tag,
  Save,
  X,
  Filter,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
  Image as ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

// Mock data for products
const mockProducts = [
  {
    id: "#2045",
    image: "perfil",
    name: "Perfil Facebook 2015+ (Farmado)",
    category: "Perfis Farmados",
    tags: ["Antigo"],
    price: 45.00,
    stock: 85,
    status: "Ativo"
  },
  {
    id: "#2046",
    image: "bm",
    name: "BM Ilimitada (Com Documentos)",
    category: "Business Manager",
    tags: ["Verificado", "High Tier"],
    price: 120.00,
    stock: 5,
    status: "Ativo"
  },
  {
    id: "#2047",
    image: "page",
    name: "Página Facebook 10k Seguidores",
    category: "Páginas",
    tags: ["N/A"],
    price: 80.00,
    stock: 0,
    status: "Inativo"
  },
];

const categories = ["Perfis Farmados", "Business Manager (BM)", "Páginas Reestabelecidas"];
const existingTags = ["High Limit", "Verificado", "Com Documentos", "Antigo", "Sem Checkpoint"];

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

export default function AdminProducts() {
  const [showForm, setShowForm] = useState(true);
  const [selectedIcon, setSelectedIcon] = useState<ProductIcon>("perfil");
  const [imageTab, setImageTab] = useState<"upload" | "library">("upload");
  const [productTags, setProductTags] = useState<string[]>(["High Limit", "Verificado"]);
  const [tagInput, setTagInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newTagInput, setNewTagInput] = useState("");
  const [managedTags, setManagedTags] = useState(existingTags);
  const [currentPage, setCurrentPage] = useState(1);

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      if (!productTags.includes(tagInput.trim())) {
        setProductTags([...productTags, tagInput.trim()]);
      }
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setProductTags(productTags.filter(tag => tag !== tagToRemove));
  };

  const handleAddManagedTag = () => {
    if (newTagInput.trim() && !managedTags.includes(newTagInput.trim())) {
      setManagedTags([...managedTags, newTagInput.trim()]);
      setNewTagInput("");
    }
  };

  const handleRemoveManagedTag = (tagToRemove: string) => {
    setManagedTags(managedTags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className="space-y-4 py-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Painel de Controle</h1>
        </div>
        <Button 
          onClick={() => setShowForm(!showForm)}
          className="bg-primary hover:bg-primary/90 text-white gap-2"
        >
          <Plus className="h-4 w-4" />
          NOVO PRODUTO
        </Button>
      </div>

      {/* Product Form */}
      {showForm && (
        <div className="glass-panel rounded-xl p-5 space-y-5">
          <div className="flex items-center gap-2 text-white">
            <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center">
              <span className="text-primary text-sm">📦</span>
            </div>
            <h2 className="font-medium">Cadastrar Novo Produto</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left Column - Image Upload */}
            <div className="space-y-4">
              <label className="text-sm text-zinc-400">Imagem do Produto</label>
              
              {/* Tab Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setImageTab("upload")}
                  className={`px-4 py-1.5 rounded text-sm transition-colors ${
                    imageTab === "upload" 
                      ? "bg-zinc-700 text-white" 
                      : "bg-zinc-800/50 text-zinc-400 hover:text-white"
                  }`}
                >
                  Upload
                </button>
                <button
                  onClick={() => setImageTab("library")}
                  className={`px-4 py-1.5 rounded text-sm transition-colors ${
                    imageTab === "library" 
                      ? "bg-zinc-700 text-white" 
                      : "bg-zinc-800/50 text-zinc-400 hover:text-white"
                  }`}
                >
                  Biblioteca Padrão
                </button>
              </div>

              {/* Upload Area */}
              <div className="border-2 border-dashed border-zinc-700 rounded-xl p-8 flex flex-col items-center justify-center gap-2 hover:border-zinc-600 transition-colors cursor-pointer min-h-[180px]">
                <Upload className="h-8 w-8 text-zinc-500" />
                <span className="text-sm text-zinc-400">Arraste ou clique para upload</span>
                <span className="text-xs text-zinc-500">PNG, JPG até 5MB</span>
              </div>

              {/* Quick Icons */}
              <div className="flex gap-2">
                {(Object.keys(productIcons) as ProductIcon[]).map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setSelectedIcon(icon)}
                    className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all ${
                      selectedIcon === icon 
                        ? `${iconColors[icon]} ring-2 ring-primary` 
                        : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    {productIcons[icon]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-500">Ícones rápidos para Perfil, BM, Proxy, Page</p>
            </div>

            {/* Right Column - Form Fields */}
            <div className="lg:col-span-2 space-y-4">
              {/* Product Name */}
              <div className="space-y-1.5">
                <label className="text-sm text-zinc-400">Nome do Produto</label>
                <Input 
                  placeholder="Ex: Perfil Facebook High Limit - 2018" 
                  className="bg-zinc-900/50 border-zinc-700 text-white placeholder:text-zinc-500"
                />
              </div>

              {/* Price and Stock */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm text-zinc-400">Preço (R$)</label>
                  <Input 
                    placeholder="R$ 0,00" 
                    className="bg-zinc-900/50 border-zinc-700 text-white placeholder:text-zinc-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-zinc-400">Estoque Inicial</label>
                  <Input 
                    placeholder="Qtd. unidades" 
                    className="bg-zinc-900/50 border-zinc-700 text-white placeholder:text-zinc-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-sm text-zinc-400">Descrição Detalhada</label>
                <Textarea 
                  placeholder="Descreva as características do produto, limites, ano de criação, etc..."
                  className="bg-zinc-900/50 border-zinc-700 text-white placeholder:text-zinc-500 min-h-[80px] resize-none"
                />
              </div>

              {/* Category and Tags */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-zinc-400">Categoria</label>
                    <button className="text-xs text-primary hover:underline">+ Nova</button>
                  </div>
                  <Select>
                    <SelectTrigger className="bg-zinc-900/50 border-zinc-700 text-white">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-zinc-400">Tags</label>
                  <div className="relative">
                    <Input 
                      placeholder="Adicionar tags (Enter)..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleAddTag}
                      className="bg-zinc-900/50 border-zinc-700 text-white placeholder:text-zinc-500 pr-8"
                    />
                    <Tag className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-yellow-500" />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {productTags.map((tag) => (
                      <Badge 
                        key={tag} 
                        variant="secondary" 
                        className="bg-zinc-700 text-zinc-200 hover:bg-zinc-600 gap-1 cursor-pointer"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        {tag}
                        <X className="h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <Button 
                  variant="ghost" 
                  className="text-zinc-400 hover:text-white"
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </Button>
                <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
                  <Save className="h-4 w-4" />
                  SALVAR PRODUTO
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Categories and Tags Management */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Categories */}
        <div className="glass-panel rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-white">
            <Briefcase className="h-4 w-4 text-zinc-400" />
            <h3 className="font-medium text-sm">Gerenciar Categorias</h3>
          </div>
          <div className="flex gap-2">
            <Input 
              placeholder="Nome da nova categoria..."
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="bg-zinc-900/50 border-zinc-700 text-white placeholder:text-zinc-500 text-sm"
            />
            <Button size="sm" variant="secondary" className="bg-zinc-700 hover:bg-zinc-600 px-3">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1">
            {categories.map((cat) => (
              <div 
                key={cat} 
                className="text-sm text-zinc-300 py-1.5 px-2 hover:bg-zinc-800/50 rounded cursor-pointer"
              >
                {cat}
              </div>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="glass-panel rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-white">
            <Tag className="h-4 w-4 text-zinc-400" />
            <h3 className="font-medium text-sm">Gerenciar Tags</h3>
          </div>
          <div className="flex gap-2">
            <Input 
              placeholder="Nome da nova tag..."
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddManagedTag()}
              className="bg-zinc-900/50 border-zinc-700 text-white placeholder:text-zinc-500 text-sm"
            />
            <Button 
              size="sm" 
              variant="secondary" 
              className="bg-zinc-700 hover:bg-zinc-600 px-3"
              onClick={handleAddManagedTag}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {managedTags.map((tag) => (
              <Badge 
                key={tag} 
                className="bg-primary/20 text-primary hover:bg-primary/30 gap-1 cursor-pointer"
                onClick={() => handleRemoveManagedTag(tag)}
              >
                {tag}
                <X className="h-3 w-3" />
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="glass-panel rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-medium text-white">Todos os Produtos</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input 
                placeholder="Buscar por ID, nome ou tag..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-zinc-900/50 border-zinc-700 text-white placeholder:text-zinc-500 pl-8 w-[220px] text-sm"
              />
            </div>
            <Select>
              <SelectTrigger className="bg-zinc-900/50 border-zinc-700 text-white w-[140px] text-sm">
                <SelectValue placeholder="Todas Categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Categorias</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" className="text-zinc-400 hover:text-white px-2">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400 text-xs font-medium">ID</TableHead>
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
              {mockProducts.map((product) => (
                <TableRow key={product.id} className="border-zinc-800 hover:bg-zinc-800/30">
                  <TableCell className="text-zinc-400 text-sm">{product.id}</TableCell>
                  <TableCell>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconColors[product.image as ProductIcon] || "bg-zinc-700"}`}>
                      {productIcons[product.image as ProductIcon] || <ImageIcon className="h-5 w-5" />}
                    </div>
                  </TableCell>
                  <TableCell className="text-white text-sm font-medium max-w-[180px] truncate">
                    {product.name}
                  </TableCell>
                  <TableCell className="text-zinc-400 text-sm">{product.category}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {product.tags.map((tag) => (
                        <Badge 
                          key={tag} 
                          variant="secondary" 
                          className={`text-xs ${
                            tag === "Verificado" 
                              ? "bg-green-500/20 text-green-400" 
                              : tag === "High Tier" 
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-zinc-700 text-zinc-300"
                          }`}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-white text-sm">
                    R$ {product.price.toFixed(2).replace(".", ",")}
                  </TableCell>
                  <TableCell className={`text-sm font-medium ${
                    product.stock > 10 
                      ? "text-green-400" 
                      : product.stock > 0 
                      ? "text-yellow-400" 
                      : "text-red-400"
                  }`}>
                    {product.stock} un.
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${
                      product.status === "Ativo" 
                        ? "bg-green-500/20 text-green-400" 
                        : "bg-zinc-600 text-zinc-400"
                    }`}>
                      ● {product.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-zinc-400 hover:text-white">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-zinc-400 hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-zinc-500">Mostrando 1-3 de 156 produtos</p>
          <div className="flex items-center gap-1">
            <Button 
              size="sm" 
              variant="ghost" 
              className="text-zinc-400 hover:text-white text-xs gap-1"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            {[1, 2, 3].map((page) => (
              <Button
                key={page}
                size="sm"
                variant={currentPage === page ? "default" : "ghost"}
                className={`h-7 w-7 p-0 ${
                  currentPage === page 
                    ? "bg-primary text-white" 
                    : "text-zinc-400 hover:text-white"
                }`}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            ))}
            <Button 
              size="sm" 
              variant="ghost" 
              className="text-zinc-400 hover:text-white text-xs gap-1"
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Próximo
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
