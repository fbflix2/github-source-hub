import { useState } from "react";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Search,
  Download,
  Globe,
  Eye,
  Pencil,
  Ban,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Subscription {
  id: string;
  code: string;
  proxyIp: string;
  country: string;
  quantity: number;
  clientName: string;
  clientEmail: string;
  status: "active" | "pending" | "cancelled";
  startDate: string;
  endDate: string;
  daysRemaining: string;
  renewalType: "auto" | "manual";
}

const mockSubscriptions: Subscription[] = [
  {
    id: "1",
    code: "#PX-9281",
    proxyIp: "192.168.0.45",
    country: "BR",
    quantity: 5,
    clientName: "Carlos Andrade",
    clientEmail: "carlos.a@gmail.com",
    status: "active",
    startDate: "24 Jul 2024",
    endDate: "24 Ago 2024",
    daysRemaining: "12 dias restantes",
    renewalType: "auto",
  },
  {
    id: "2",
    code: "#PX-8822",
    proxyIp: "104.22.11.90",
    country: "US",
    quantity: 1,
    clientName: "Mariana Souza",
    clientEmail: "mari.souza@outlook.com",
    status: "pending",
    startDate: "10 Jul 2024",
    endDate: "10 Ago 2024",
    daysRemaining: "Vence hoje",
    renewalType: "manual",
  },
  {
    id: "3",
    code: "#PX-7731",
    proxyIp: "45.33.22.11",
    country: "UK",
    quantity: 10,
    clientName: "Roberto Lima",
    clientEmail: "beto.lima@gmail.com",
    status: "cancelled",
    startDate: "01 Jul 2024",
    endDate: "01 Ago 2024",
    daysRemaining: "Expirado",
    renewalType: "manual",
  },
  {
    id: "4",
    code: "#PX-9901",
    proxyIp: "188.90.12.33",
    country: "DE",
    quantity: 2,
    clientName: "Julia Martins",
    clientEmail: "ju.martins@tech.io",
    status: "active",
    startDate: "15 Ago 2024",
    endDate: "15 Set 2024",
    daysRemaining: "30+ dias",
    renewalType: "auto",
  },
];

const stats = [
  {
    label: "Assinaturas Ativas",
    value: "1,245",
    icon: CheckCircle,
    iconColor: "text-green-400",
    badge: "+12%",
    badgeColor: "text-green-400 bg-green-400/10 border-green-400/20",
    glowColor: "bg-primary/10 group-hover:bg-primary/20",
  },
  {
    label: "Vencendo em Breve",
    value: "42",
    icon: AlertTriangle,
    iconColor: "text-orange-400",
    badge: "7 dias",
    badgeColor: "text-orange-400 bg-orange-400/10 border-orange-400/20",
    glowColor: "bg-orange-500/10 group-hover:bg-orange-500/20",
  },
  {
    label: "Canceladas (Mês)",
    value: "15",
    icon: XCircle,
    iconColor: "text-red-500",
    badge: "+5%",
    badgeColor: "text-red-400 bg-red-400/10 border-red-400/20",
    glowColor: "bg-primary/10 group-hover:bg-primary/20",
  },
  {
    label: "Renovação Pendente",
    value: "8",
    icon: RefreshCw,
    iconColor: "text-blue-400",
    badge: null,
    badgeColor: "",
    glowColor: "bg-blue-500/10 group-hover:bg-blue-500/20",
  },
];

export default function AdminAssinaturas() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [renewalFilter, setRenewalFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Ativo
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            Pendente
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            Cancelado
          </span>
        );
      default:
        return null;
    }
  };

  const getDaysRemainingStyle = (status: string, daysRemaining: string) => {
    if (status === "cancelled") {
      return "text-white/30";
    }
    if (daysRemaining === "Vence hoje") {
      return "text-orange-400";
    }
    if (daysRemaining.includes("dias restantes")) {
      return "text-green-400";
    }
    return "text-white/40";
  };

  const filteredSubscriptions = mockSubscriptions.filter((sub) => {
    const matchesSearch =
      sub.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.clientEmail.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || sub.status === statusFilter;
    const matchesRenewal = renewalFilter === "all" || sub.renewalType === renewalFilter;
    return matchesSearch && matchesStatus && matchesRenewal;
  });

  return (
    <div className="flex flex-col gap-6 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-white/40">
        <span className="hover:text-primary transition-colors cursor-pointer">Painel</span>
        <ChevronRight className="w-4 h-4" />
        <span className="text-white font-medium">Gerenciamento de Assinaturas Proxy</span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight mb-2">
            Gerenciamento de Assinaturas Proxy
          </h2>
          <p className="text-white/50 max-w-2xl text-sm">
            Gerencie o ciclo de vida das assinaturas, monitore status de renovação e controle o
            acesso dos clientes aos serviços de proxy.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-[rgba(30,30,30,0.4)] backdrop-blur-xl border border-white/[0.08] rounded-xl p-5 relative overflow-hidden group"
          >
            <div
              className={`absolute -right-4 -top-4 w-24 h-24 rounded-full ${stat.glowColor} transition-all blur-xl`}
            />
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className="p-2 bg-white/5 rounded-lg border border-white/5">
                <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
              </div>
              {stat.badge && (
                <span
                  className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full border ${stat.badgeColor}`}
                >
                  {stat.badge}
                  {stat.badge.includes("%") && <TrendingUp className="w-2.5 h-2.5" />}
                </span>
              )}
            </div>
            <p className="text-white/50 text-xs font-medium uppercase tracking-wider mb-1">
              {stat.label}
            </p>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-[rgba(30,30,30,0.4)] backdrop-blur-xl border border-white/[0.08] p-4 rounded-xl flex flex-col lg:flex-row gap-4 justify-between items-end lg:items-center">
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto flex-1">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 w-5 h-5" />
            <Input
              type="text"
              placeholder="Buscar por código (ex: #PX-2024), nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/20 border-white/10 text-white text-sm rounded-lg pl-10 placeholder-white/30 focus:border-primary focus:ring-primary"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-black/20 border-white/10 text-white text-sm rounded-lg min-w-[140px]">
                <SelectValue placeholder="Status: Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status: Todos</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={renewalFilter} onValueChange={setRenewalFilter}>
              <SelectTrigger className="bg-black/20 border-white/10 text-white text-sm rounded-lg min-w-[160px]">
                <SelectValue placeholder="Renovação: Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Renovação: Todas</SelectItem>
                <SelectItem value="auto">Automática</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="p-2.5 text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 transition-colors"
            title="Exportar CSV"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            className="p-2.5 text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[rgba(30,30,30,0.4)] backdrop-blur-xl border border-white/[0.08] rounded-xl overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-white/80">
            <thead className="text-xs text-white/50 uppercase bg-black/20 border-b border-white/5">
              <tr>
                <th className="px-4 py-4 font-medium">Código do Proxy</th>
                <th className="px-4 py-4 font-medium">Proxy Adquirido</th>
                <th className="px-4 py-4 font-medium text-center">Quantidade</th>
                <th className="px-4 py-4 font-medium">Cliente</th>
                <th className="px-4 py-4 font-medium">Status da Assinatura</th>
                <th className="px-4 py-4 font-medium">Data de Início</th>
                <th className="px-4 py-4 font-medium">Data de Vencimento</th>
                <th className="px-4 py-4 font-medium">Renovação</th>
                <th className="px-4 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredSubscriptions.map((sub) => (
                <tr key={sub.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-4 py-4 font-medium text-primary">{sub.code}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs bg-white/5 px-1.5 py-0.5 rounded text-white/70">
                        {sub.proxyIp}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-white/50">
                        <Globe className="w-3.5 h-3.5" /> {sub.country}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="bg-white/5 px-2 py-1 rounded text-xs font-bold">
                      {sub.quantity}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className="text-white font-medium">{sub.clientName}</span>
                      <span className="text-white/40 text-xs">{sub.clientEmail}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">{getStatusBadge(sub.status)}</td>
                  <td className="px-4 py-4">
                    <span className="text-white">{sub.startDate}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span
                        className={`${
                          sub.status === "cancelled" ? "text-white/50 line-through" : "text-white"
                        }`}
                      >
                        {sub.endDate}
                      </span>
                      <span className={`text-xs ${getDaysRemainingStyle(sub.status, sub.daysRemaining)}`}>
                        {sub.daysRemaining}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-xs border border-white/10 px-2 py-1 rounded-md text-white/60">
                      {sub.renewalType === "auto" ? "Automática" : "Manual"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="text-white/40 hover:text-white p-1"
                        title="Ver Detalhes"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button
                        className="text-white/40 hover:text-primary p-1"
                        title="Editar"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                      <button
                        className="text-white/40 hover:text-red-500 p-1"
                        title="Suspender"
                      >
                        <Ban className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="border-t border-white/5 bg-black/20 p-4 flex items-center justify-between">
          <span className="text-xs text-white/40">
            Mostrando <span className="text-white">1-{filteredSubscriptions.length}</span> de{" "}
            <span className="text-white">1,245</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white disabled:opacity-30"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            {[1, 2, 3].map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1 rounded text-xs ${
                  currentPage === page
                    ? "bg-primary text-white font-bold"
                    : "hover:bg-white/10 text-white/60 hover:text-white"
                }`}
              >
                {page}
              </button>
            ))}
            <span className="text-white/40 px-1">...</span>
            <button
              className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white"
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
