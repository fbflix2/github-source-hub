import { useState } from "react";
import {
  Search,
  Plus,
  Link as LinkIcon,
  Layers,
  Edit,
  Copy,
  Trash2,
  Grid3X3,
  List,
  LayoutDashboard,
  ToggleRight,
  Clock,
  ImagePlus,
  ChevronDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

type BannerStatus = "published" | "inactive" | "scheduled";

interface Banner {
  id: string;
  title: string;
  description: string;
  ctaText: string;
  ctaStyle: "primary" | "white";
  link: string;
  position: string;
  status: BannerStatus;
  isVisible: boolean;
  thumbnail: string;
  scheduledDate?: string;
}

const mockBanners: Banner[] = [
  {
    id: "1",
    title: "Cyber Future",
    description: "Experimente o futuro em 4K HDR. Assista agora.",
    ctaText: "Assistir Agora",
    ctaStyle: "primary",
    link: "/movies/cyber-future",
    position: "Home Hero",
    status: "published",
    isVisible: true,
    thumbnail: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=450&fit=crop",
  },
  {
    id: "2",
    title: "Verão Criativo",
    description: "Novas séries documentais sobre arte moderna.",
    ctaText: "Explorar",
    ctaStyle: "white",
    link: "/collections/art-docs",
    position: "Destaques Home",
    status: "published",
    isVisible: true,
    thumbnail: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&h=450&fit=crop",
  },
  {
    id: "3",
    title: "Promoção Pipoca",
    description: "Descontos especiais para o fim de semana.",
    ctaText: "Resgatar",
    ctaStyle: "primary",
    link: "/promo/weekend",
    position: "Rodapé",
    status: "inactive",
    isVisible: false,
    thumbnail: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&h=450&fit=crop",
  },
  {
    id: "4",
    title: "Festival Retro 80s",
    description: "A maior maratona de clássicos dos anos 80.",
    ctaText: "Em Breve",
    ctaStyle: "primary",
    link: "/festival/retro-80s",
    position: "Home Principal",
    status: "scheduled",
    isVisible: false,
    scheduledDate: "20 Nov",
    thumbnail: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&h=450&fit=crop",
  },
];

export default function AdminBanners() {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [banners, setBanners] = useState(mockBanners);

  const getStatusBadge = (status: BannerStatus) => {
    switch (status) {
      case "published":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30 backdrop-blur-md shadow-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Publicado
          </span>
        );
      case "inactive":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-800/60 text-gray-400 border border-white/10 backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
            Inativo
          </span>
        );
      case "scheduled":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 backdrop-blur-md shadow-lg">
            <Clock className="w-3 h-3" />
            Agendado
          </span>
        );
    }
  };

  const toggleVisibility = (id: string) => {
    setBanners((prev) =>
      prev.map((banner) =>
        banner.id === id ? { ...banner, isVisible: !banner.isVisible } : banner
      )
    );
  };

  const filteredBanners = banners.filter((banner) =>
    banner.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-8 py-6">
      {/* Header Section */}
      <header className="flex flex-col gap-8 mb-4">
        {/* Title Row */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-2">
              Editor de Banners
            </h1>
            <p className="text-gray-400 font-medium text-sm md:text-base">
              Gerencie as promoções e destaques do FBFLIX
            </p>
          </div>
          <Button className="group flex items-center justify-center gap-2 bg-primary hover:bg-red-700 text-white font-bold py-3 px-6 h-auto rounded-xl shadow-[0_0_20px_rgba(249,6,6,0.3)] hover:shadow-[0_0_30px_rgba(249,6,6,0.5)]">
            <Plus className="w-5 h-5" />
            <span>Novo Banner</span>
          </Button>
        </div>

        {/* Toolbar (Search & Filter) */}
        <div className="bg-[rgba(20,20,20,0.6)] backdrop-blur-xl border border-white/[0.08] p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search */}
          <div className="relative w-full md:max-w-md">
            <div className="bg-black/40 border border-white/10 rounded-xl flex items-center h-12 w-full transition-colors focus-within:border-primary">
              <div className="pl-4 text-gray-400 flex items-center justify-center">
                <Search className="w-5 h-5" />
              </div>
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por título do banner..."
                className="w-full bg-transparent border-none text-white placeholder:text-gray-500 focus-visible:ring-0 text-sm font-medium h-full"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            {/* Position Filter */}
            <button className="bg-black/40 border border-white/10 h-10 px-4 rounded-lg flex items-center gap-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all whitespace-nowrap">
              <LayoutDashboard className="w-4 h-4" />
              <span>Posição: Todas</span>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>

            {/* Status Filter */}
            <button className="bg-black/40 border border-white/10 h-10 px-4 rounded-lg flex items-center gap-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all whitespace-nowrap">
              <ToggleRight className="w-4 h-4" />
              <span>Status: Ativos</span>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>

            {/* View Layout Toggle */}
            <div className="hidden md:flex bg-black/40 rounded-lg p-1 border border-white/10 ml-2">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === "grid"
                    ? "bg-white/10 text-white"
                    : "text-gray-500 hover:text-white hover:bg-white/5"
                }`}
              >
                <Grid3X3 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === "list"
                    ? "bg-white/10 text-white"
                    : "text-gray-500 hover:text-white hover:bg-white/5"
                }`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Banners Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBanners.map((banner) => (
          <div
            key={banner.id}
            className={`bg-gradient-to-b from-[rgba(30,30,30,0.6)] to-[rgba(20,20,20,0.4)] backdrop-blur-xl border border-white/[0.06] rounded-2xl overflow-hidden group flex flex-col h-full relative transition-all duration-300 hover:border-primary/40 hover:-translate-y-1 hover:shadow-[0_10px_40px_-10px_rgba(249,6,6,0.15)] ${
              banner.status === "inactive" ? "opacity-80 hover:opacity-100" : ""
            }`}
          >
            {/* Status Tag */}
            <div className="absolute top-3 left-3 z-20">
              {getStatusBadge(banner.status)}
            </div>

            {/* Preview Area */}
            <div
              className={`relative aspect-video w-full overflow-hidden bg-gray-900 ${
                banner.status === "inactive"
                  ? "grayscale group-hover:grayscale-0 transition-all duration-500"
                  : ""
              }`}
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                style={{ backgroundImage: `url('${banner.thumbnail}')` }}
              />
              {/* Overlay Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              {/* Content Preview */}
              <div className="absolute bottom-0 left-0 right-0 p-5 flex flex-col items-start gap-3">
                <h3 className="text-xl font-bold leading-tight text-white drop-shadow-md">
                  {banner.title}
                </h3>
                <p className="text-xs text-gray-300 line-clamp-2 drop-shadow-sm">
                  {banner.description}
                </p>
                <span
                  className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded shadow-lg transform scale-90 origin-left ${
                    banner.ctaStyle === "primary"
                      ? "bg-primary text-white"
                      : "bg-white text-black"
                  }`}
                >
                  {banner.ctaText}
                </span>
              </div>
            </div>

            {/* Metadata & Controls */}
            <div className="p-5 flex flex-col gap-4 flex-1 justify-between border-t border-white/5 bg-gradient-to-b from-transparent to-black/20">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <LinkIcon className="w-4 h-4" />
                  <span className="truncate font-mono">{banner.link}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Layers className="w-4 h-4" />
                  <span className="text-gray-200 font-medium">{banner.position}</span>
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between pt-3 mt-1 border-t border-white/5">
                {banner.status === "scheduled" ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-blue-300 font-medium">
                      Inicia em: {banner.scheduledDate}
                    </span>
                  </div>
                ) : (
                  <label className="relative inline-flex items-center cursor-pointer group/toggle">
                    <Switch
                      checked={banner.isVisible}
                      onCheckedChange={() => toggleVisibility(banner.id)}
                      className="data-[state=checked]:bg-primary"
                    />
                    <span className="ml-2 text-xs font-medium text-gray-400 group-hover/toggle:text-white transition-colors">
                      {banner.isVisible ? "Visível" : "Oculto"}
                    </span>
                  </label>
                )}
                <div className="flex gap-1">
                  <button
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    title="Editar"
                  >
                    <Edit className="w-[18px] h-[18px]" />
                  </button>
                  <button
                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    title="Duplicar"
                  >
                    <Copy className="w-[18px] h-[18px]" />
                  </button>
                  <button
                    className="p-2 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-[18px] h-[18px]" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Empty Slot / Add New */}
        <button className="bg-gradient-to-b from-[rgba(30,30,30,0.6)] to-[rgba(20,20,20,0.4)] backdrop-blur-xl border-2 border-dashed border-white/10 hover:border-primary/50 rounded-2xl overflow-hidden group flex flex-col h-full min-h-[320px] relative items-center justify-center hover:bg-white/5 cursor-pointer text-center p-8 gap-4 transition-all">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
            <ImagePlus className="w-8 h-8 text-gray-400 group-hover:text-primary" />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold text-gray-200 group-hover:text-white">
              Criar Novo Banner
            </h3>
            <p className="text-sm text-gray-500 group-hover:text-gray-400">
              Adicione uma nova promoção
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
