import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Search, Download, Send, ArrowLeft, Briefcase, UserRound, Flag, Copy,
  ChevronLeft, ChevronRight, ClipboardList, Archive, Loader2, Pencil,
  Trash2, CheckSquare, Square, Filter, X
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { EditStockItemModal } from "@/components/admin/EditStockItemModal";
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

interface StockItem {
  id: string;
  type: string;
  name: string;
  identification: string | null;
  identification_link: string | null;
  status: string;
  data: any;
  created_at: string;
  folder: string | null;
}

const typeIcons = {
  bm: { icon: Briefcase, color: "bg-primary/20 text-primary", label: "Business Manager" },
  perfil: { icon: UserRound, color: "bg-cyan-500/20 text-cyan-400", label: "Perfil" },
  pagina: { icon: Flag, color: "bg-purple-500/20 text-purple-400", label: "Página" },
};

const statusStyles: Record<string, { label: string; class: string }> = {
  aguardando: { label: "Aguardando Cadastro", class: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  revisado: { label: "Revisado", class: "bg-green-500/20 text-green-400 border-green-500/30" },
  erro: { label: "Erro", class: "bg-red-500/20 text-red-400 border-red-500/30" },
  bloqueado: { label: "Bloqueado", class: "bg-red-500/20 text-red-400 border-red-500/30" },
  vendido: { label: "Vendido", class: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
};

export default function AdminEstoque() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterFolder, setFilterFolder] = useState<string>("all");
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bulkStatusChanging, setBulkStatusChanging] = useState(false);

  const fetchItems = async () => {
    const { data } = await supabase
      .from("stock_items")
      .select("*")
      .neq("status", "revisado")
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
    supabase.from("stock_folders").select("id, name").order("name").then(({ data }) => setFolders(data ?? []));
  }, []);

  const toggleItem = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const filtered = useMemo(() => {
    return items.filter(item => {
      if (filterType !== "all" && item.type !== filterType) return false;
      if (filterStatus !== "all" && item.status !== filterStatus) return false;
      if (filterFolder !== "all" && item.folder !== filterFolder) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return item.name.toLowerCase().includes(term) ||
          item.identification?.toLowerCase().includes(term) ||
          item.identification_link?.toLowerCase().includes(term);
      }
      return true;
    });
  }, [items, filterType, filterStatus, filterFolder, searchTerm]);

  const allFilteredSelected = filtered.length > 0 && filtered.every(i => selectedItems.includes(i.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedItems(prev => prev.filter(id => !filtered.some(i => i.id === id)));
    } else {
      const filteredIds = filtered.map(i => i.id);
      setSelectedItems(prev => [...new Set([...prev, ...filteredIds])]);
    }
  };

  const handleEnviarParaCadastro = async () => {
    if (selectedItems.length === 0) {
      toast.warning("Selecione pelo menos um item para enviar.");
      return;
    }
    const selectedStockItems = items.filter(i => selectedItems.includes(i.id));
    const productsToCreate = selectedStockItems.map(item => {
      const data = item.data || {};
      return {
        name: data.nomeProduto || item.name,
        price: data.preco ? parseFloat(data.preco) : 0,
        stock: 1,
        description: data.descricao || null,
        category_id: data.categoryId || null,
        icon_type: item.type === "bm" ? "bm" : item.type === "perfil" ? "perfil" : "page",
        tags: data.tags && data.tags.length > 0 ? data.tags : null,
        image_url: data.foto_url || null,
        status: "estoque_interno",
        available: false,
      };
    });
    const { data: createdProducts, error: productError } = await supabase
      .from("products")
      .insert(productsToCreate)
      .select("id");
    if (productError || !createdProducts) {
      toast.error("Erro ao criar produtos: " + (productError?.message || "Erro desconhecido"));
      return;
    }
    for (let i = 0; i < selectedStockItems.length; i++) {
      await supabase
        .from("stock_items")
        .update({ status: "revisado", product_id: createdProducts[i].id })
        .eq("id", selectedStockItems[i].id);
    }
    toast.success(`${selectedItems.length} item(ns) enviado(s) para Produtos!`);
    setSelectedItems([]);
    fetchItems();
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;
    setBulkDeleting(true);
    const { error } = await supabase.from("stock_items").delete().in("id", selectedItems);
    setBulkDeleting(false);
    setShowDeleteConfirm(false);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
      return;
    }
    toast.success(`${selectedItems.length} item(ns) excluído(s)!`);
    setSelectedItems([]);
    fetchItems();
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedItems.length === 0) return;
    setBulkStatusChanging(true);
    const { error } = await supabase.from("stock_items").update({ status: newStatus }).in("id", selectedItems);
    setBulkStatusChanging(false);
    if (error) {
      toast.error("Erro ao alterar status: " + error.message);
      return;
    }
    toast.success(`${selectedItems.length} item(ns) alterado(s) para "${statusStyles[newStatus]?.label || newStatus}"!`);
    setSelectedItems([]);
    fetchItems();
  };

  const hasActiveFilters = filterType !== "all" || filterStatus !== "all" || filterFolder !== "all";

  const clearFilters = () => {
    setFilterType("all");
    setFilterStatus("all");
    setFilterFolder("all");
  };

  const totalByType = (type: string) => items.filter(i => i.type === type).length;

  const stats = [
    { label: "TOTAL DE ITENS", value: items.length, icon: Archive, color: "bg-zinc-800/50 border-zinc-700" },
    { label: "BUSINESS MANAGERS", value: totalByType("bm"), icon: Briefcase, color: "bg-primary/20 border-primary/30" },
    { label: "PERFIS", value: totalByType("perfil"), icon: UserRound, color: "bg-cyan-500/20 border-cyan-500/30" },
    { label: "PÁGINAS", value: totalByType("pagina"), icon: Flag, color: "bg-purple-500/20 border-purple-500/30" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Badge className="bg-primary/20 text-primary border border-primary/30 font-medium">
            ESTOQUE INTERNO
          </Badge>
          <h1 className="text-3xl font-bold text-foreground">Gestão de Estoque</h1>
          <p className="text-muted-foreground max-w-md">
            Gerencie, revise e prepare os ativos antes da sincronização oficial com a plataforma FBFLIX.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className={`glass-panel rounded-xl p-4 border ${stat.color} relative overflow-hidden`}>
            <div className="relative z-10">
              <p className="text-xs text-muted-foreground font-medium tracking-wider">{stat.label}</p>
              <p className="text-3xl font-bold text-foreground mt-1">{stat.value}</p>
            </div>
            <stat.icon className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 text-foreground/5" />
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-transparent" />
          </div>
        ))}
      </div>

      {/* Filters and Actions */}
      <div className="glass-panel rounded-xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome, ID ou link..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 w-[220px]" />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="perfil">Perfil</SelectItem>
                <SelectItem value="bm">BM</SelectItem>
                <SelectItem value="pagina">Página</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="aguardando">Aguardando</SelectItem>
                <SelectItem value="erro">Erro</SelectItem>
                <SelectItem value="bloqueado">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
            {folders.length > 0 && (
              <Select value={filterFolder} onValueChange={setFilterFolder}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Pasta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as pastas</SelectItem>
                  {folders.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground hover:text-foreground gap-1">
                <X className="h-3 w-3" /> Limpar
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2" onClick={() => navigate("/admin/blocagem")}>
              <ClipboardList className="h-4 w-4" />
              Blocagem
            </Button>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2" onClick={handleEnviarParaCadastro} disabled={selectedItems.length === 0}>
              <Send className="h-4 w-4" />
              Enviar para Cadastro ({selectedItems.length})
            </Button>
          </div>
        </div>

        {/* Bulk actions bar */}
        {selectedItems.length > 0 && (
          <div className="flex items-center gap-3 pt-2 border-t border-border/30">
            <span className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">{selectedItems.length}</span> selecionado(s)
            </span>
            <div className="h-4 w-px bg-border/50" />
            <Select onValueChange={handleBulkStatusChange} value="">
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Alterar status para..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aguardando">Aguardando Cadastro</SelectItem>
                <SelectItem value="erro">Erro</SelectItem>
                <SelectItem value="bloqueado">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="h-3.5 w-3.5" />
              Excluir ({selectedItems.length})
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedItems([])} className="text-muted-foreground">
              Limpar seleção
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/30 hover:bg-transparent">
              <TableHead className="w-12">
                <Checkbox
                  checked={allFilteredSelected && filtered.length > 0}
                  onCheckedChange={toggleSelectAll}
                  className="border-muted-foreground/50"
                />
              </TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">TIPO / NOME</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">IDENTIFICAÇÃO (ID/LINK)</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">STATUS</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">DATA ADIÇÃO</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">AÇÕES</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  {hasActiveFilters ? "Nenhum item encontrado com os filtros aplicados." : "Nenhum item no estoque ainda. Adicione itens pela tela de Blocagem."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => {
                const typeConfig = typeIcons[item.type as keyof typeof typeIcons] ?? typeIcons.perfil;
                const statusConfig = statusStyles[item.status] ?? statusStyles.aguardando;
                const TypeIcon = typeConfig.icon;

                return (
                  <TableRow key={item.id} className="border-border/20 hover:bg-muted/30">
                    <TableCell>
                      <Checkbox checked={selectedItems.includes(item.id)} onCheckedChange={() => toggleItem(item.id)} className="border-muted-foreground/50" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {item.type === "perfil" && item.data?.foto_url && !failedImages.has(item.id) ? (
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-cyan-500/20 flex items-center justify-center shrink-0">
                            <img
                              src={item.data.foto_url}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                              onError={() => setFailedImages(prev => new Set(prev).add(item.id))}
                            />
                          </div>
                        ) : (
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${typeConfig.color}`}>
                            <TypeIcon className="h-5 w-5" />
                          </div>
                        )}
                        <div>
                          <p className="text-foreground font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{typeConfig.label}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {item.identification_link ? (
                          <>
                            <p className="text-muted-foreground text-sm">{item.identification}</p>
                            <a href={item.identification_link} target="_blank" rel="noreferrer" className="text-primary text-sm hover:underline">
                              {item.identification_link}
                            </a>
                          </>
                        ) : (
                          <span className="text-muted-foreground text-sm">{item.identification || "—"}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${statusConfig.class}`}>{statusConfig.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(item.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={() => setEditingItem(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between p-4 border-t border-border/30">
          <p className="text-sm text-muted-foreground">
            Mostrando <span className="text-foreground font-medium">{filtered.length}</span> de {items.length} itens
          </p>
        </div>
      </div>

      <EditStockItemModal
        item={editingItem}
        open={!!editingItem}
        onOpenChange={(open) => { if (!open) setEditingItem(null); }}
        onSaved={fetchItems}
      />

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedItems.length} item(ns)?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Os itens selecionados serão removidos permanentemente do estoque.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={bulkDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {bulkDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
