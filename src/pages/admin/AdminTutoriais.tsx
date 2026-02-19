import { useState } from "react";
import {
  Search,
  Link as LinkIcon,
  ChevronDown,
  Tag,
  PlusCircle,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  Play,
  Video,
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

type TutorialStatus = "published" | "draft";
type TutorialCategory = "plataforma" | "financeiro" | "suporte" | "novidades";

interface Tutorial {
  id: string;
  title: string;
  url: string;
  category: TutorialCategory;
  tags: string[];
  status: TutorialStatus;
  thumbnail: string;
}

const mockTutorials: Tutorial[] = [
  {
    id: "1",
    title: "Introdução ao Painel",
    url: "https://youtu.be/dQw4w9WgXcQ",
    category: "plataforma",
    tags: ["início", "básico"],
    status: "published",
    thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&h=200&fit=crop",
  },
  {
    id: "2",
    title: "Configurando Pagamentos",
    url: "https://vimeo.com/123456789",
    category: "financeiro",
    tags: ["pix", "cartão"],
    status: "draft",
    thumbnail: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=300&h=200&fit=crop",
  },
  {
    id: "3",
    title: "Recuperação de Acesso",
    url: "https://youtu.be/abc123xyz",
    category: "suporte",
    tags: ["senha", "login"],
    status: "published",
    thumbnail: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=300&h=200&fit=crop",
  },
];

const categoryConfig: Record<TutorialCategory, { label: string; color: string; bgColor: string; borderColor: string }> = {
  plataforma: { label: "Plataforma", color: "text-blue-400", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/20" },
  financeiro: { label: "Financeiro", color: "text-purple-400", bgColor: "bg-purple-500/10", borderColor: "border-purple-500/20" },
  suporte: { label: "Suporte", color: "text-orange-400", bgColor: "bg-orange-500/10", borderColor: "border-orange-500/20" },
  novidades: { label: "Novidades", color: "text-emerald-400", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500/20" },
};

export default function AdminTutoriais() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Form state
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoCategory, setVideoCategory] = useState("");
  const [videoTags, setVideoTags] = useState("");
  const [videoDescription, setVideoDescription] = useState("");

  const filteredTutorials = mockTutorials.filter((tutorial) => {
    const matchesSearch =
      tutorial.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tutorial.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()));

    if (statusFilter === "all") return matchesSearch;
    return matchesSearch && tutorial.status === statusFilter;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log({ videoUrl, videoTitle, videoCategory, videoTags, videoDescription });
    // TODO: Implement tutorial creation
  };

  const totalTutorials = 12;

  return (
    <div className="flex flex-col gap-8 py-6">
      {/* Header */}
      <header className="flex flex-col gap-2 mb-4">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-sm">
          Gerenciamento de <span className="text-primary">Tutoriais</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-2xl">
          Adicione, edite e organize os vídeos de ajuda para os seus clientes.
          Mantenha a base de conhecimento do FBFLIX 2.0 sempre atualizada.
        </p>
      </header>

      {/* Section 1: Cadastro de Vídeo (Form) */}
      <section className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Video className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Novo Tutorial</h2>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Video URL */}
          <div className="col-span-1 md:col-span-8">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              URL do Vídeo
            </label>
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
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Categoria
            </label>
            <Select value={videoCategory} onValueChange={setVideoCategory}>
              <SelectTrigger className="w-full rounded-xl py-3 h-auto bg-black/40 border border-white/10 text-white focus:border-primary focus:ring-1 focus:ring-primary">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent className="bg-neutral-900 border-white/10">
                <SelectItem value="plataforma">Uso da Plataforma</SelectItem>
                <SelectItem value="pagamentos">Pagamentos</SelectItem>
                <SelectItem value="suporte">Suporte Técnico</SelectItem>
                <SelectItem value="novidades">Novidades</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Título */}
          <div className="col-span-1 md:col-span-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Título do Tutorial
            </label>
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
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tags
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500">
                <Tag className="w-5 h-5" />
              </span>
              <Input
                type="text"
                value={videoTags}
                onChange={(e) => setVideoTags(e.target.value)}
                placeholder="Adicionar tags (separadas por vírgula)"
                className="w-full rounded-xl py-3 h-auto pl-11 pr-4 bg-black/40 border border-white/10 text-white placeholder:text-gray-500 focus:border-primary focus-visible:ring-1 focus-visible:ring-primary transition-all"
              />
            </div>
          </div>

          {/* Descrição */}
          <div className="col-span-1 md:col-span-12">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Descrição do Vídeo
            </label>
            <Textarea
              value={videoDescription}
              onChange={(e) => setVideoDescription(e.target.value)}
              placeholder="Breve resumo sobre o conteúdo do vídeo..."
              rows={3}
              className="w-full rounded-xl py-3 px-4 bg-black/40 border border-white/10 text-white placeholder:text-gray-500 focus:border-primary focus-visible:ring-1 focus-visible:ring-primary transition-all resize-none"
            />
          </div>

          {/* Botão de Ação */}
          <div className="col-span-1 md:col-span-12 flex justify-end mt-2">
            <Button
              type="submit"
              className="group flex items-center gap-2 bg-primary hover:bg-red-700 text-white font-bold py-3 px-8 h-auto rounded-xl shadow-[0_0_15px_rgba(249,6,6,0.4)] hover:shadow-[0_0_25px_rgba(249,6,6,0.6)]"
            >
              <PlusCircle className="w-5 h-5" />
              Adicionar Tutorial
            </Button>
          </div>
        </form>
      </section>

      {/* Section 2: Listagem (Table & Filters) */}
      <section className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 md:p-8 flex flex-col gap-6 min-h-[500px]">
        {/* Filters Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          {/* Search */}
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

          {/* Right Filters */}
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
                <TableHead className="text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">
                  Vídeo
                </TableHead>
                <TableHead className="text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">
                  Detalhes
                </TableHead>
                <TableHead className="text-gray-400 text-xs uppercase tracking-wider font-semibold p-4 hidden md:table-cell">
                  Categorias
                </TableHead>
                <TableHead className="text-gray-400 text-xs uppercase tracking-wider font-semibold p-4 hidden lg:table-cell">
                  Tags
                </TableHead>
                <TableHead className="text-gray-400 text-xs uppercase tracking-wider font-semibold p-4">
                  Status
                </TableHead>
                <TableHead className="text-gray-400 text-xs uppercase tracking-wider font-semibold p-4 text-right">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTutorials.map((tutorial) => {
                const category = categoryConfig[tutorial.category];
                return (
                  <TableRow
                    key={tutorial.id}
                    className="hover:bg-white/5 transition-colors group border-b border-white/5"
                  >
                    <TableCell className="p-4 align-middle w-[160px]">
                      <div className="relative w-32 h-20 rounded-lg overflow-hidden bg-gray-800 shadow-lg group-hover:shadow-primary/20 transition-all border border-white/10">
                        <img
                          src={tutorial.thumbnail}
                          alt={tutorial.title}
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-8 h-8 text-white drop-shadow-md" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="p-4 align-middle">
                      <p className="text-white font-semibold text-base mb-1">
                        {tutorial.title}
                      </p>
                      <p className="text-gray-500 text-xs truncate max-w-[200px]">
                        {tutorial.url}
                      </p>
                    </TableCell>
                    <TableCell className="p-4 align-middle hidden md:table-cell">
                      <span
                        className={`px-2.5 py-1 rounded-md ${category.bgColor} ${category.color} border ${category.borderColor} text-xs font-medium`}
                      >
                        {category.label}
                      </span>
                    </TableCell>
                    <TableCell className="p-4 align-middle hidden lg:table-cell">
                      <div className="flex gap-1 flex-wrap">
                        {tutorial.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-gray-400 text-xs bg-white/5 px-2 py-0.5 rounded"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="p-4 align-middle">
                      {tutorial.status === "published" ? (
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                          <span className="text-green-400 font-medium text-xs">
                            Publicado
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-yellow-500" />
                          <span className="text-yellow-500 font-medium text-xs">
                            Rascunho
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="p-4 align-middle text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                          title="Visualizar"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button
                          className="p-2 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          className="p-2 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
          <span className="text-xs text-gray-500">
            Mostrando 1-{filteredTutorials.length} de {totalTutorials} tutoriais
          </span>
          <div className="flex gap-2">
            <button
              disabled
              className="px-3 py-1.5 rounded-lg border border-white/10 text-gray-400 text-xs hover:bg-white/5 hover:text-white transition disabled:opacity-50"
            >
              Anterior
            </button>
            <button className="px-3 py-1.5 rounded-lg border border-white/10 text-gray-400 text-xs hover:bg-white/5 hover:text-white transition">
              Próxima
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
