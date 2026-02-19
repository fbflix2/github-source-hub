import { useState, useMemo } from "react";
import { 
  Building2, 
  CircleUser, 
  PackageOpen, 
  FolderOpen,
  FolderPlus,
  Pencil,
  ChevronRight,
  ChevronDown,
  Shield,
  ArrowLeft,
  Link,
  FileText,
  Info,
  AlertTriangle,
  Save,
  Copy,
  Hash,
  Mail,
  AtSign,
  KeyRound,
  Clock,
  BadgeCheck,
  Cookie,
  Eye,
  EyeOff,
  Plus,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// Mock data for folders
const mockFolders = [
  {
    id: 1,
    name: "BMs para Revenda",
    items: 124,
    updatedAt: "Atualizado hoje"
  },
  {
    id: 2,
    name: "Perfis Nível 1",
    items: 45,
    updatedAt: "Atualizado ontem"
  },
  {
    id: 3,
    name: "Páginas Verificadas",
    items: 12,
    updatedAt: "Atualizado há 3 dias"
  },
];

const itemTypes = [
  {
    id: "bm",
    icon: Building2,
    title: "BM",
    subtitle: "BUSINESS MANAGER"
  },
  {
    id: "perfil",
    icon: CircleUser,
    title: "Perfil",
    subtitle: "CONTAS DE USUÁRIO"
  },
  {
    id: "combo",
    icon: PackageOpen,
    title: "Combo ou Kit",
    subtitle: "PACOTE DE PRODUTOS"
  },
];

// Perfil Form Component
function PerfilForm({ onBack }: { onBack: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    linkPerfil: "",
    idPerfil: "",
    emailAcesso: "",
    emailAlternativo: "",
    senha: "",
    token2fa: "",
    tempoPlataforma: "3-meses",
    statusAtual: "aquecido",
    cookies: "",
    descricao: ""
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-zinc-800/50 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">Blocagem de Perfil</h1>
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <FolderOpen className="h-4 w-4" />
            <span>Pasta Alpha • Contingência FBFLIX</span>
          </div>
        </div>
      </div>

      {/* Main Form Panel */}
      <div className="glass-panel rounded-2xl p-6 md:p-8">
        <form className="flex flex-col gap-8">
          {/* Two Column Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column - Identificação */}
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                <BadgeCheck className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-white">Identificação</h2>
              </div>

              {/* Link do Perfil */}
              <div className="flex flex-col gap-2 group">
                <label className="text-sm font-medium text-zinc-400 group-focus-within:text-white transition-colors">
                  Link do Perfil
                </label>
                <div className="relative">
                  <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    type="url"
                    placeholder="https://facebook.com/profile.php?id=..."
                    value={formData.linkPerfil}
                    onChange={(e) => setFormData({ ...formData, linkPerfil: e.target.value })}
                    className="pl-10 bg-black/30 border-white/5 text-white placeholder:text-zinc-600"
                  />
                </div>
              </div>

              {/* ID do Perfil */}
              <div className="flex flex-col gap-2 group">
                <label className="text-sm font-medium text-zinc-400 group-focus-within:text-white transition-colors">
                  ID do Perfil
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    type="text"
                    placeholder="10000843..."
                    value={formData.idPerfil}
                    onChange={(e) => setFormData({ ...formData, idPerfil: e.target.value })}
                    className="pl-10 bg-black/30 border-white/5 text-white placeholder:text-zinc-600 font-mono"
                  />
                </div>
              </div>

              {/* Email de Acesso */}
              <div className="flex flex-col gap-2 group">
                <label className="text-sm font-medium text-zinc-400 group-focus-within:text-white transition-colors">
                  Email de Acesso
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    type="email"
                    placeholder="exemplo@fbflix.com"
                    value={formData.emailAcesso}
                    onChange={(e) => setFormData({ ...formData, emailAcesso: e.target.value })}
                    className="pl-10 bg-black/30 border-white/5 text-white placeholder:text-zinc-600"
                  />
                </div>
              </div>

              {/* Email Alternativo */}
              <div className="flex flex-col gap-2 group">
                <label className="text-sm font-medium text-zinc-400 group-focus-within:text-white transition-colors">
                  Email Alternativo
                </label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    type="email"
                    placeholder="recuperacao@email.com"
                    value={formData.emailAlternativo}
                    onChange={(e) => setFormData({ ...formData, emailAlternativo: e.target.value })}
                    className="pl-10 bg-black/30 border-white/5 text-white placeholder:text-zinc-600"
                  />
                </div>
              </div>
            </div>

            {/* Right Column - Segurança & Status */}
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                <Shield className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-white">Segurança & Status</h2>
              </div>

              {/* Senha de Acesso */}
              <div className="flex flex-col gap-2 group">
                <label className="text-sm font-medium text-zinc-400 group-focus-within:text-white transition-colors">
                  Senha de Acesso
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={formData.senha}
                    onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                    className="pl-10 pr-10 bg-black/30 border-white/5 text-white placeholder:text-zinc-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Token 2FA */}
              <div className="flex flex-col gap-2 group">
                <label className="text-sm font-medium text-zinc-400 group-focus-within:text-white transition-colors">
                  Token 2FA
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input
                    type="text"
                    placeholder="JBSWY3DPEHPK3PXP"
                    value={formData.token2fa}
                    onChange={(e) => setFormData({ ...formData, token2fa: e.target.value })}
                    className="pl-10 bg-black/30 border-white/5 text-white placeholder:text-zinc-600 font-mono"
                  />
                </div>
              </div>

              {/* Tempo e Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2 group">
                  <label className="text-sm font-medium text-zinc-400 group-focus-within:text-white transition-colors">
                    Tempo de Plataforma
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 z-10" />
                    <Select
                      value={formData.tempoPlataforma}
                      onValueChange={(value) => setFormData({ ...formData, tempoPlataforma: value })}
                    >
                      <SelectTrigger className="pl-10 bg-black/30 border-white/5 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0-1-mes">Novo (0-1 mês)</SelectItem>
                        <SelectItem value="3-meses">3 meses</SelectItem>
                        <SelectItem value="6-meses">6 meses</SelectItem>
                        <SelectItem value="1-ano">1 ano+</SelectItem>
                        <SelectItem value="2-anos">2 anos+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-col gap-2 group">
                  <label className="text-sm font-medium text-zinc-400 group-focus-within:text-white transition-colors">
                    Status Atual
                  </label>
                  <div className="relative">
                    <BadgeCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 z-10" />
                    <Select
                      value={formData.statusAtual}
                      onValueChange={(value) => setFormData({ ...formData, statusAtual: value })}
                    >
                      <SelectTrigger className="pl-10 bg-black/30 border-white/5 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="novo">Novo</SelectItem>
                        <SelectItem value="antigo">Antigo</SelectItem>
                        <SelectItem value="aquecido">Aquecido</SelectItem>
                        <SelectItem value="verificado">Verificado</SelectItem>
                        <SelectItem value="restrito">Restrito</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Warning Alert */}
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-start gap-3 mt-auto">
                <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-primary/80 leading-relaxed">
                  Certifique-se de que o 2FA está ativo antes de salvar perfis "Aquecidos" ou "Verificados" para evitar bloqueios imediatos.
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Section - Cookies and Description */}
          <div className="flex flex-col gap-6 pt-4 border-t border-white/5">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Cookies */}
              <div className="flex-1 flex flex-col gap-2 group">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-400 group-focus-within:text-white transition-colors flex items-center gap-2">
                    <Cookie className="h-4 w-4" />
                    Cookies JSON/Netscape
                  </label>
                  <button type="button" className="text-xs text-primary hover:text-primary/80 transition-colors font-medium">
                    Validar Formato
                  </button>
                </div>
                <Textarea
                  placeholder='[{"domain": ".facebook.com", "expirationDate": 1729384728, "name": "c_user", "value": "1000..."}]'
                  value={formData.cookies}
                  onChange={(e) => setFormData({ ...formData, cookies: e.target.value })}
                  className="h-32 bg-black/30 border-white/5 text-zinc-300 placeholder:text-zinc-600 font-mono text-xs resize-none"
                />
              </div>

              {/* Descrição */}
              <div className="flex-1 flex flex-col gap-2 group">
                <label className="text-sm font-medium text-zinc-400 group-focus-within:text-white transition-colors flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Descrição de Orientação
                </label>
                <Textarea
                  placeholder="Adicione notas sobre o aquecimento, proxy utilizado ou observações específicas..."
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  className="h-32 bg-black/30 border-white/5 text-white placeholder:text-zinc-600 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse md:flex-row items-center justify-between gap-4 pt-6 mt-2 border-t border-white/10">
            <Button
              type="button"
              variant="ghost"
              onClick={onBack}
              className="w-full md:w-auto text-zinc-400 hover:text-white hover:bg-white/5"
            >
              Voltar
            </Button>
            <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
              <Button
                type="button"
                variant="outline"
                className="w-full md:w-auto bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20 gap-2"
              >
                <Plus className="h-4 w-4" />
                Adicionar Outro
              </Button>
              <Button
                type="button"
                className="w-full md:w-auto bg-primary hover:bg-primary/90 text-white gap-2 shadow-[0_0_20px_-5px_rgba(242,13,13,0.5)] hover:shadow-[0_0_25px_-5px_rgba(242,13,13,0.7)]"
              >
                <Save className="h-4 w-4" />
                Adicionar à Pasta
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// BM Form Component
function BMForm({ onBack }: { onBack: () => void }) {
  const [urls, setUrls] = useState("");
  const [notes, setNotes] = useState("");

  const urlLines = useMemo(() => {
    return urls.split("\n").filter(line => line.trim() !== "");
  }, [urls]);

  const totalBMs = urlLines.length;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button 
          onClick={onBack}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Estoque
        </button>
        <span className="text-zinc-600">/</span>
        <span className="text-primary font-medium">Nova Blocagem</span>
      </div>

      {/* Main Form Panel */}
      <div className="glass-panel rounded-2xl p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Cadastro de BM</h1>
              <p className="text-zinc-400">
                Pasta Destino: <span className="text-white font-medium">Contingência Q4</span>
              </p>
            </div>
          </div>
          <Badge className="bg-zinc-800 text-white border border-zinc-700 gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            SISTEMA OPERACIONAL
          </Badge>
        </div>

        {/* Form Content */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* URLs Section - Takes more space */}
          <div className="lg:col-span-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-300">
                <Link className="h-4 w-4 text-zinc-500" />
                <span className="text-sm font-medium">URLs dos BMs (um por linha)</span>
              </div>
              <Badge variant="outline" className="border-green-500/50 text-green-400 text-xs">
                Aceita multiplas linhas
              </Badge>
            </div>
            
            <div className="relative">
              <Textarea
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                placeholder={`https://business.facebook.com/overview...\nhttps://business.facebook.com/settings...\nhttps://business.facebook.com/ads...`}
                className="min-h-[280px] bg-zinc-900/50 border-zinc-700 text-white placeholder:text-zinc-600 font-mono text-sm resize-none pl-12"
              />
              {/* Line Numbers */}
              <div className="absolute left-0 top-0 w-10 h-full pointer-events-none border-r border-zinc-700/50 flex flex-col pt-2 text-right pr-2">
                {Array.from({ length: Math.max(urlLines.length + 1, 3) }, (_, i) => (
                  <span key={i} className="text-xs text-zinc-600 leading-[1.65rem]">
                    {i + 1}
                  </span>
                ))}
              </div>
              <button className="absolute top-3 right-3 text-zinc-500 hover:text-white transition-colors">
                <Copy className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Pressione Enter para nova linha.</span>
              <span className="text-primary font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                Total de BMs para Adicionar: {totalBMs}
              </span>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
              <AlertTriangle className="h-4 w-4 text-primary flex-shrink-0" />
              <p className="text-xs text-zinc-400">
                Links duplicados serão destacados em uma cor diferente e removidos com sua permissão.
              </p>
            </div>
          </div>

          {/* Notes Section */}
          <div className="lg:col-span-2 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-zinc-300">
                <FileText className="h-4 w-4 text-zinc-500" />
                <span className="text-sm font-medium">Notas Internas</span>
              </div>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações sobre a origem, fornecedor ou motivo do bloqueio..."
                className="min-h-[120px] bg-zinc-900/50 border-zinc-700 text-white placeholder:text-zinc-500 resize-none"
              />
            </div>

            {/* Info Alert */}
            <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-2">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                <span className="text-white font-medium text-sm">Atenção</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Certifique-se de que todos os links estão ativos antes de salvar. 
                Itens duplicados serão ignorados automaticamente.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <Button className="w-full bg-primary hover:bg-primary/90 text-white gap-2 h-12">
                <Save className="h-4 w-4" />
                Salvar BMs na Pasta
              </Button>
              <Button 
                variant="ghost" 
                className="w-full text-zinc-400 hover:text-white border border-zinc-700 hover:bg-zinc-800 gap-2 h-12"
              >
                Ver Itens na Pasta
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminBlocagem() {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [showAllFolders, setShowAllFolders] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folders, setFolders] = useState(mockFolders);

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) {
      toast.error("Digite um nome para a pasta");
      return;
    }
    
    const newFolder = {
      id: folders.length + 1,
      name: newFolderName.trim(),
      items: 0,
      updatedAt: "Criado agora"
    };
    
    setFolders([newFolder, ...folders]);
    setNewFolderName("");
    setIsCreateFolderOpen(false);
    toast.success("Pasta criada com sucesso!");
  };

  // If BM is selected, show the BM form
  if (selectedType === "bm") {
    return (
      <div className="py-6">
        <BMForm onBack={() => setSelectedType(null)} />
      </div>
    );
  }

  // If Perfil is selected, show the Perfil form
  if (selectedType === "perfil") {
    return (
      <div className="py-6">
        <PerfilForm onBack={() => setSelectedType(null)} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header Section */}
      <div className="text-center py-4 space-y-2 flex-shrink-0">
        <div className="flex justify-center">
          <div className="w-10 h-10 rounded-full bg-zinc-800/80 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-white">
          Nova Blocagem de Itens
        </h1>
        <p className="text-sm text-zinc-400 max-w-lg mx-auto">
          Selecione o tipo de item para iniciar uma nova blocagem de contingência ou 
          gerencie suas pastas de estoque existentes.
        </p>
      </div>

      {/* Item Type Selection */}
      <div className="flex justify-center gap-6 py-4 flex-shrink-0">
        {itemTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => setSelectedType(type.id)}
            className={`group flex flex-col items-center gap-2 p-4 rounded-xl transition-all duration-300 ${
              selectedType === type.id
                ? "bg-white/5 border border-primary/40 shadow-[0_0_40px_-10px_rgba(242,13,13,0.3)]"
                : "bg-transparent border border-transparent hover:bg-white/[0.03] hover:border-white/10"
            }`}
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              selectedType === type.id
                ? "bg-zinc-700"
                : "bg-zinc-800/80 group-hover:bg-zinc-700/80"
            }`}>
              <type.icon className={`h-6 w-6 transition-colors ${
                selectedType === type.id
                  ? "text-white"
                  : "text-zinc-400 group-hover:text-zinc-300"
              }`} />
            </div>
            <div className="text-center">
              <h3 className={`text-sm font-semibold transition-colors ${
                selectedType === type.id ? "text-white" : "text-zinc-300"
              }`}>
                {type.title}
              </h3>
              <p className="text-[10px] text-zinc-500 tracking-wider mt-0.5">
                {type.subtitle}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Folder Management Section */}
      <div className="glass-panel rounded-xl p-4 flex-1 min-h-0 flex flex-col max-w-3xl mx-auto w-full">
        <div className="flex items-center justify-between pb-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-4 w-4 text-primary" />
            <div>
              <h2 className="text-sm font-semibold text-white">
                Gerenciar Pastas de Estoque
              </h2>
              <p className="text-xs text-zinc-500">
                Organize seus ativos em pastas para facilitar a distribuição.
              </p>
            </div>
          </div>
          <Button 
            size="sm" 
            onClick={() => setIsCreateFolderOpen(true)}
            className="bg-primary hover:bg-primary/90 text-white gap-1.5 text-xs h-8"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            Criar Nova Pasta
          </Button>
        </div>

        {/* Folders List */}
        <div className="flex-1 min-h-0 overflow-auto space-y-1">
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-white/[0.03] transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FolderOpen className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm text-white font-medium">{folder.name}</h3>
                  <p className="text-xs text-zinc-500">
                    {folder.items} itens • {folder.updatedAt}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* View All Button */}
        <button 
          onClick={() => setShowAllFolders(!showAllFolders)}
          className="w-full flex items-center justify-center gap-2 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-wider flex-shrink-0 border-t border-white/5 mt-2"
        >
          Ver todas as pastas
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAllFolders ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent className="bg-zinc-900 border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-primary" />
              Criar Nova Pasta
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">
                Nome da Pasta
              </label>
              <Input
                placeholder="Ex: BMs Premium, Perfis Aquecidos..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                className="bg-black/30 border-white/10 text-white placeholder:text-zinc-600"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button 
                variant="ghost" 
                onClick={() => setIsCreateFolderOpen(false)}
                className="text-zinc-400 hover:text-white hover:bg-white/5"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateFolder}
                className="bg-primary hover:bg-primary/90 text-white gap-1.5"
              >
                <FolderPlus className="h-4 w-4" />
                Criar Pasta
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
