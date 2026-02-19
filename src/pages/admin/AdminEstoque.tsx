import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Search, 
  Download, 
  Send, 
  ArrowLeft,
  Briefcase,
  UserRound,
  Flag,
  Copy,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LayoutGrid,
  Archive,
  ClipboardList
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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

// Mock data for stock items
const mockItems = [
  {
    id: 1,
    type: "bm",
    name: "BM Principal Q4",
    subtitle: "Business Manager",
    identification: "business.facebook.com/...",
    status: "aguardando",
    date: "24/10/2023"
  },
  {
    id: 2,
    type: "perfil",
    name: "João Silva Marketing",
    subtitle: "Perfil",
    identification: "ID: 882910293",
    identificationLink: "fb.com/joaosilva...",
    status: "revisado",
    date: "23/10/2023"
  },
  {
    id: 3,
    type: "pagina",
    name: "Ofertas Imperdíveis",
    subtitle: "Página",
    identification: "fb.com/pages/ofertas...",
    status: "aguardando",
    date: "22/10/2023"
  },
  {
    id: 4,
    type: "bm",
    name: "Backup BM 02",
    subtitle: "Business Manager",
    identification: "business.facebook.com/...",
    status: "erro",
    date: "20/10/2023"
  },
];

const stats = [
  { label: "TOTAL DE ITENS", value: 45, icon: Archive, color: "bg-zinc-800/50 border-zinc-700" },
  { label: "BUSINESS MANAGERS", value: 10, icon: Briefcase, color: "bg-primary/20 border-primary/30" },
  { label: "PERFIS", value: 20, icon: UserRound, color: "bg-cyan-500/20 border-cyan-500/30" },
  { label: "PÁGINAS", value: 15, icon: Flag, color: "bg-purple-500/20 border-purple-500/30" },
];

const typeIcons = {
  bm: { icon: Briefcase, color: "bg-primary/20 text-primary" },
  perfil: { icon: UserRound, color: "bg-cyan-500/20 text-cyan-400" },
  pagina: { icon: Flag, color: "bg-purple-500/20 text-purple-400" },
};

const statusStyles = {
  aguardando: { label: "Aguardando Cadastro", class: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  revisado: { label: "Revisado", class: "bg-green-500/20 text-green-400 border-green-500/30" },
  erro: { label: "Erro", class: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export default function AdminEstoque() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState<number[]>([]);

  const toggleItem = (id: number) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Badge className="bg-primary/20 text-primary border border-primary/30 font-medium">
            ESTOQUE INTERNO
          </Badge>
          <h1 className="text-3xl font-bold text-white">
            Itens em Blocagem na Pasta:
            <br />
            <span className="text-primary">Contingência Q4</span>
          </h1>
          <p className="text-zinc-400 max-w-md">
            Gerencie, revise e prepare os ativos de contingência antes da 
            sincronização oficial com a plataforma FBFLIX.
          </p>
        </div>
        <Button variant="outline" className="bg-zinc-800/50 border-zinc-700 text-white hover:bg-zinc-700 gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div 
            key={index}
            className={`glass-panel rounded-xl p-4 border ${stat.color} relative overflow-hidden`}
          >
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
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                placeholder="Buscar por nome, ID ou link..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-[220px] bg-zinc-900/50 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>

            {/* Type Filter */}
            <Select defaultValue="todos">
              <SelectTrigger className="w-[150px] bg-zinc-900/50 border-zinc-700 text-white">
                <SelectValue placeholder="Todos os Tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Tipos</SelectItem>
                <SelectItem value="bm">Business Manager</SelectItem>
                <SelectItem value="perfil">Perfil</SelectItem>
                <SelectItem value="pagina">Página</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select defaultValue="todos">
              <SelectTrigger className="w-[140px] bg-zinc-900/50 border-zinc-700 text-white">
                <SelectValue placeholder="Todos Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Status</SelectItem>
                <SelectItem value="aguardando">Aguardando</SelectItem>
                <SelectItem value="revisado">Revisado</SelectItem>
                <SelectItem value="erro">Erro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              className="bg-zinc-800/50 border-zinc-700 text-white hover:bg-zinc-700 gap-2"
              onClick={() => navigate("/admin/blocagem")}
            >
              <ClipboardList className="h-4 w-4" />
              Blocagem
            </Button>
            <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
              <Send className="h-4 w-4" />
              Enviar para Cadastro
            </Button>
            <Button variant="outline" className="bg-zinc-800/50 border-zinc-700 text-white hover:bg-zinc-700 gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Info tooltip */}
        <div className="mt-4 flex justify-end">
          <div className="bg-zinc-900/50 rounded-lg px-4 py-3 max-w-md text-right">
            <p className="text-xs text-zinc-400 leading-relaxed">
              Ao enviar para cadastro, os itens selecionados serão disponibilizados na tela de Gestão de Produtos para serem cadastrados com nome, categoria, tags, preço, etc., e então ficarão disponíveis para venda na plataforma principal.
            </p>
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
            {mockItems.map((item) => {
              const typeConfig = typeIcons[item.type as keyof typeof typeIcons];
              const statusConfig = statusStyles[item.status as keyof typeof statusStyles];
              const TypeIcon = typeConfig.icon;

              return (
                <TableRow key={item.id} className="border-zinc-800 hover:bg-zinc-800/30">
                  <TableCell>
                    <Checkbox
                      checked={selectedItems.includes(item.id)}
                      onCheckedChange={() => toggleItem(item.id)}
                      className="border-zinc-600"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeConfig.color}`}>
                        <TypeIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{item.name}</p>
                        <p className="text-xs text-zinc-500">{item.subtitle}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {item.identificationLink ? (
                        <>
                          <p className="text-zinc-400 text-sm">{item.identification}</p>
                          <a href="#" className="text-primary text-sm hover:underline flex items-center gap-1">
                            {item.identificationLink}
                          </a>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-400 text-sm">{item.identification}</span>
                          <button className="text-zinc-500 hover:text-white transition-colors">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${statusConfig.class}`}>
                      {statusConfig.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-zinc-400 text-sm">
                    {item.date}
                  </TableCell>
                  <TableCell>
                    {/* Actions can be added here */}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t border-zinc-800">
          <p className="text-sm text-zinc-500">
            Mostrando <span className="text-white font-medium">1-4</span> de <span className="text-white font-medium">45</span> itens
          </p>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-zinc-400 hover:text-white">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-zinc-400 hover:text-white">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
