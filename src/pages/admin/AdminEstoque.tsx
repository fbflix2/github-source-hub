import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Search, Download, Send, ArrowLeft, Briefcase, UserRound, Flag, Copy,
  ChevronLeft, ChevronRight, ClipboardList, Archive, Loader2, Pencil
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { EditStockItemModal } from "@/components/admin/EditStockItemModal";

interface StockItem {
  id: string;
  type: string;
  name: string;
  identification: string | null;
  identification_link: string | null;
  status: string;
  data: any;
  created_at: string;
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
};

export default function AdminEstoque() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);

  const fetchItems = async () => {
    const { data } = await supabase
      .from("stock_items")
      .select("*")
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const toggleItem = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const filtered = items.filter(item =>
    !searchTerm || item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.identification?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h1 className="text-3xl font-bold text-white">Gestão de Estoque</h1>
          <p className="text-zinc-400 max-w-md">
            Gerencie, revise e prepare os ativos antes da sincronização oficial com a plataforma FBFLIX.
          </p>
        </div>
        <Button variant="outline" className="bg-zinc-800/50 border-zinc-700 text-white hover:bg-zinc-700 gap-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className={`glass-panel rounded-xl p-4 border ${stat.color} relative overflow-hidden`}>
            <div className="relative z-10">
              <p className="text-xs text-zinc-400 font-medium tracking-wider">{stat.label}</p>
              <p className="text-3xl font-bold text-white mt-1">{stat.value}</p>
            </div>
            <stat.icon className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 text-white/10" />
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-transparent" />
          </div>
        ))}
      </div>

      {/* Filters and Actions */}
      <div className="glass-panel rounded-xl p-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input placeholder="Buscar por nome, ID ou link..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 w-[220px] bg-zinc-900/50 border-zinc-700 text-white placeholder:text-zinc-500" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="bg-zinc-800/50 border-zinc-700 text-white hover:bg-zinc-700 gap-2" onClick={() => navigate("/admin/blocagem")}>
              <ClipboardList className="h-4 w-4" />
              Blocagem
            </Button>
            <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
              <Send className="h-4 w-4" />
              Enviar para Cadastro
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="w-12"></TableHead>
              <TableHead className="text-zinc-400 text-xs font-medium">TIPO / NOME</TableHead>
              <TableHead className="text-zinc-400 text-xs font-medium">IDENTIFICAÇÃO (ID/LINK)</TableHead>
              <TableHead className="text-zinc-400 text-xs font-medium">STATUS</TableHead>
              <TableHead className="text-zinc-400 text-xs font-medium">DATA ADIÇÃO</TableHead>
              <TableHead className="text-zinc-400 text-xs font-medium">AÇÕES</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-zinc-500 py-12">
                  Nenhum item no estoque ainda. Adicione itens pela tela de Blocagem.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => {
                const typeConfig = typeIcons[item.type as keyof typeof typeIcons] ?? typeIcons.perfil;
                const statusConfig = statusStyles[item.status] ?? statusStyles.aguardando;
                const TypeIcon = typeConfig.icon;

                return (
                  <TableRow key={item.id} className="border-zinc-800 hover:bg-zinc-800/30">
                    <TableCell>
                      <Checkbox checked={selectedItems.includes(item.id)} onCheckedChange={() => toggleItem(item.id)} className="border-zinc-600" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {item.type === "perfil" && item.identification ? (
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-cyan-500/20 flex items-center justify-center">
                            <img
                              src={`https://graph.facebook.com/${item.identification}/picture?type=normal`}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.style.display = "none";
                                target.parentElement!.classList.add("rounded-lg");
                                const icon = document.createElement("span");
                                icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-cyan-400"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>`;
                                target.parentElement!.appendChild(icon);
                              }}
                            />
                          </div>
                        ) : (
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeConfig.color}`}>
                            <TypeIcon className="h-5 w-5" />
                          </div>
                        )}
                        <div>
                          <p className="text-white font-medium">{item.name}</p>
                          <p className="text-xs text-zinc-500">{typeConfig.label}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {item.identification_link ? (
                          <>
                            <p className="text-zinc-400 text-sm">{item.identification}</p>
                            <a href={item.identification_link} target="_blank" rel="noreferrer" className="text-primary text-sm hover:underline">
                              {item.identification_link}
                            </a>
                          </>
                        ) : (
                          <span className="text-zinc-400 text-sm">{item.identification || "—"}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${statusConfig.class}`}>{statusConfig.label}</Badge>
                    </TableCell>
                    <TableCell className="text-zinc-400 text-sm">
                      {new Date(item.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white hover:bg-zinc-700" onClick={() => setEditingItem(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between p-4 border-t border-zinc-800">
          <p className="text-sm text-zinc-500">
            Mostrando <span className="text-white font-medium">{filtered.length}</span> itens
          </p>
        </div>
      </div>

      <EditStockItemModal
        item={editingItem}
        open={!!editingItem}
        onOpenChange={(open) => { if (!open) setEditingItem(null); }}
        onSaved={fetchItems}
      />
    </div>
  );
}
