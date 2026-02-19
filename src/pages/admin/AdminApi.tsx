import { useState } from "react";
import {
  PlusCircle,
  Server,
  Key,
  Save,
  ShieldCheck,
  Search,
  RefreshCw,
  Eye,
  Zap,
  Pencil,
  Trash2,
  Copy,
  ArrowLeft,
  Settings,
  ChevronRight,
  AlertCircle,
  Clipboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface ApiKey {
  id: string;
  name: string;
  abbreviation: string;
  description: string;
  token: string;
  status: "active" | "inactive" | "error";
  lastModified: string;
  color: string;
}

const mockApiKeys: ApiKey[] = [
  {
    id: "1",
    name: "Mercado Pago",
    abbreviation: "MP",
    description: "Checkout Transparente",
    token: "APP_USR-63...1a9df",
    status: "active",
    lastModified: "20/10/2023 14:30",
    color: "blue",
  },
  {
    id: "2",
    name: "Stripe",
    abbreviation: "ST",
    description: "Pagamentos Globais",
    token: "sk_test_51...L8x",
    status: "inactive",
    lastModified: "15/09/2023 09:12",
    color: "indigo",
  },
  {
    id: "3",
    name: "AWS S3",
    abbreviation: "AWS",
    description: "Armazenamento de Mídia",
    token: "AKIA...R5J2",
    status: "active",
    lastModified: "22/10/2023 11:05",
    color: "orange",
  },
  {
    id: "4",
    name: "OpenAI API",
    abbreviation: "GPT",
    description: "Geração de Sinopses",
    token: "sk-proj-...9x1",
    status: "error",
    lastModified: "01/10/2023 16:45",
    color: "purple",
  },
];

export default function AdminApi() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceName, setServiceName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const getColorClasses = (color: string) => {
    switch (color) {
      case "blue":
        return "bg-blue-500/20 text-blue-400";
      case "indigo":
        return "bg-indigo-500/20 text-indigo-400";
      case "orange":
        return "bg-orange-500/20 text-orange-400";
      case "purple":
        return "bg-purple-500/20 text-purple-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Ativo
          </span>
        );
      case "inactive":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
            Inativo
          </span>
        );
      case "error":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertCircle className="w-3.5 h-3.5" />
            Erro
          </span>
        );
      default:
        return null;
    }
  };

  const filteredKeys = mockApiKeys.filter((key) => {
    const matchesSearch =
      key.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      key.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || key.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCopyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast.success("Token copiado para a área de transferência");
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setApiKey(text);
      toast.success("Chave colada com sucesso");
    } catch {
      toast.error("Não foi possível acessar a área de transferência");
    }
  };

  return (
    <div className="flex flex-col gap-8 py-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-white/5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <Settings className="w-4 h-4" />
            <span>Admin</span>
            <ChevronRight className="w-3 h-3" />
            <span>Integrações</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white leading-tight">
            Gerenciamento de <span className="text-primary">Chaves API</span> e Tokens
          </h1>
          <p className="text-gray-400 text-base font-normal max-w-2xl">
            Gerencie credenciais seguras para integrações com parceiros externos. Mantenha suas
            chaves rotacionadas e seguras.
          </p>
        </div>
        <button
          onClick={() => navigate("/admin")}
          className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Voltar ao Dashboard
        </button>
      </header>

      <main className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* Left Column: Add New Key Form */}
        <section className="xl:col-span-4 flex flex-col gap-6">
          <div className="bg-[rgba(30,30,30,0.4)] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 shadow-lg relative overflow-hidden">
            {/* Subtle red accent line at top */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-red-900 to-transparent opacity-50" />

            <div className="flex items-center gap-3 mb-6">
              <div className="bg-primary/20 p-2 rounded-lg text-primary">
                <PlusCircle className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">Adicionar Nova Chave</h2>
            </div>

            <form className="flex flex-col gap-5">
              {/* Service Name */}
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-gray-300 ml-1">Nome do Serviço/Parceiro</span>
                <div className="relative">
                  <Server className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                  <Input
                    type="text"
                    placeholder="Ex: Mercado Pago"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/30 border-white/10 placeholder:text-gray-600 text-sm focus:border-primary focus:ring-primary"
                  />
                </div>
              </label>

              {/* API Key / Token */}
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-gray-300 ml-1">Chave API / Token (Valor)</span>
                <div className="relative group/input">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                  <Input
                    type="password"
                    placeholder="Cole a chave aqui..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 rounded-xl bg-black/30 border-white/10 placeholder:text-gray-600 text-sm font-mono tracking-wide focus:border-primary focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={handlePaste}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
                    title="Colar da área de transferência"
                  >
                    <Clipboard className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-xs text-gray-500 ml-1">Recomendamos rotacionar as chaves a cada 90 dias.</span>
              </label>

              {/* Description */}
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-gray-300 ml-1">Descrição (Uso)</span>
                <Textarea
                  placeholder="Ex: Integração de pagamentos checkout transparente v2"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 bg-black/30 border-white/10 placeholder:text-gray-600 text-sm min-h-[100px] resize-none focus:border-primary focus:ring-primary"
                />
              </label>

              {/* Toggle Active */}
              <div className="flex items-center justify-between bg-black/20 p-4 rounded-xl border border-white/5">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-white">Ativar para Uso</span>
                  <span className="text-xs text-gray-500">Disponibiliza a chave imediatamente.</span>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              {/* Action Button */}
              <Button
                type="button"
                className="mt-2 w-full bg-primary hover:bg-red-700 text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-primary/25 flex justify-center items-center gap-2"
              >
                <Save className="w-5 h-5" />
                Adicionar Chave/Token
              </Button>
            </form>
          </div>

          {/* Mini Helper Card */}
          <div className="bg-[rgba(30,30,30,0.4)] backdrop-blur-xl border border-white/[0.08] rounded-xl p-5 flex gap-4 items-start">
            <div className="bg-blue-500/10 p-2 rounded-lg text-blue-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-1">Ambiente Seguro</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Todas as chaves são criptografadas antes de serem salvas no banco de dados. Logs de
                acesso são gerados para qualquer visualização de token.
              </p>
            </div>
          </div>
        </section>

        {/* Right Column: List & Filters */}
        <section className="xl:col-span-8 flex flex-col gap-6 h-full">
          {/* Search & Filters Toolbar */}
          <div className="bg-[rgba(30,30,30,0.4)] backdrop-blur-xl border border-white/[0.08] rounded-xl p-2 flex flex-col md:flex-row gap-2 justify-between items-center">
            {/* Search */}
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
              <Input
                type="text"
                placeholder="Buscar por serviço ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-transparent border-transparent focus:border-white/10 focus:bg-white/5 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:ring-0 transition-all"
              />
            </div>

            {/* Filters Actions */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-white/5 border-white/10 hover:border-white/20 rounded-lg text-sm text-gray-300 w-[160px]">
                  <SelectValue placeholder="Todos os Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                </SelectContent>
              </Select>
              <button
                className="p-2.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                title="Atualizar Lista"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-[rgba(30,30,30,0.4)] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden flex flex-col flex-1 min-h-[400px]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-black/40 border-b border-white/5 text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-6 py-4 font-semibold">Nome do Serviço</th>
                    <th className="px-6 py-4 font-semibold">Valor (Token)</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Última Modificação</th>
                    <th className="px-6 py-4 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {filteredKeys.map((key) => (
                    <tr key={key.id} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded flex items-center justify-center font-bold text-xs ${getColorClasses(
                              key.color
                            )}`}
                          >
                            {key.abbreviation}
                          </div>
                          <div>
                            <div className="font-medium text-white">{key.name}</div>
                            <div className="text-xs text-gray-500">{key.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 group/token">
                          <code className="bg-black/30 px-2 py-1 rounded text-gray-300 text-xs font-mono border border-white/5">
                            {key.token}
                          </code>
                          <button
                            onClick={() => handleCopyToken(key.token)}
                            className="opacity-0 group-hover/token:opacity-100 transition-opacity text-gray-500 hover:text-primary"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(key.status)}</td>
                      <td className="px-6 py-4 text-gray-400 text-xs">{key.lastModified}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                            title="Visualizar"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          <button
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                            title="Testar Conexão"
                          >
                            <Zap className="w-5 h-5" />
                          </button>
                          <button
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-5 h-5" />
                          </button>
                          <button
                            className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination / Footer */}
            <div className="bg-black/20 border-t border-white/5 px-6 py-4 flex items-center justify-between mt-auto">
              <span className="text-xs text-gray-500">Mostrando {filteredKeys.length} de 12 registros</span>
              <div className="flex gap-2">
                <button className="px-3 py-1 rounded-lg border border-white/10 text-xs text-gray-400 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50">
                  Anterior
                </button>
                <button className="px-3 py-1 rounded-lg border border-white/10 text-xs text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
                  Próximo
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
