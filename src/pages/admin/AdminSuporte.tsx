import { useState } from "react";
import { 
  MailOpen, 
  Clock, 
  CheckCircle, 
  Timer, 
  Bell, 
  RefreshCw,
  ArrowUp,
  ArrowDown
} from "lucide-react";

type Priority = "alta" | "media" | "baixa";
type Filter = "todos" | "novos" | "andamento" | "prioridade";

interface Ticket {
  id: string;
  priority: Priority;
  category: string;
  title: string;
  description: string;
  customerName: string;
  memberType: string;
  timeAgo: string;
  avatarGradient: string;
}

const mockTickets: Ticket[] = [
  {
    id: "#4828",
    priority: "alta",
    category: "Técnico",
    title: "Erro Crítico no Gateway",
    description: "Cliente reporta falha ao tentar renovar assinatura anual. Mensagem de erro 503 aparece no checkout e o valor não é debitado.",
    customerName: "Carlos Mendes",
    memberType: "Premium Member",
    timeAgo: "há 5m",
    avatarGradient: "from-purple-500 to-indigo-500"
  },
  {
    id: "#4825",
    priority: "media",
    category: "Conta",
    title: "Alteração de E-mail",
    description: "Usuário perdeu acesso ao e-mail antigo e deseja atualizar para um novo provedor. Documentação já foi enviada em anexo.",
    customerName: "Julia Santos",
    memberType: "Standard Member",
    timeAgo: "há 24m",
    avatarGradient: "from-green-500 to-emerald-500"
  },
  {
    id: "#4822",
    priority: "baixa",
    category: "Sugestão",
    title: "Sugestão de Novo Recurso",
    description: "Cliente sugere adicionar modo escuro automático baseado no sistema operacional para o app mobile.",
    customerName: "Roberto Almeida",
    memberType: "Trial User",
    timeAgo: "há 1h",
    avatarGradient: "from-blue-500 to-cyan-500"
  },
  {
    id: "#4819",
    priority: "alta",
    category: "Streaming",
    title: "Buffering constante",
    description: "Usuário com 500mbps de internet reportando travamentos em 1080p. Logs indicam perda de pacote na região sul.",
    customerName: "Ana Paula",
    memberType: "Premium Member",
    timeAgo: "há 2h",
    avatarGradient: "from-yellow-500 to-orange-500"
  }
];

const stats = [
  { 
    label: "Tickets Abertos", 
    value: "24", 
    change: "+12%", 
    isPositive: false, 
    icon: MailOpen, 
    iconColor: "text-primary",
    progressColor: "bg-primary",
    progressWidth: "65%"
  },
  { 
    label: "Em Espera", 
    value: "5", 
    change: "0%", 
    isPositive: null, 
    icon: Clock, 
    iconColor: "text-orange-400",
    progressColor: "bg-orange-400",
    progressWidth: "20%"
  },
  { 
    label: "Resolvidos Hoje", 
    value: "142", 
    change: "+5%", 
    isPositive: true, 
    icon: CheckCircle, 
    iconColor: "text-green-500",
    progressColor: "bg-green-500",
    progressWidth: "85%"
  },
  { 
    label: "Tempo Médio", 
    value: "14m", 
    change: "-2%", 
    isPositive: true, 
    icon: Timer, 
    iconColor: "text-blue-400",
    progressColor: "bg-blue-400",
    progressWidth: "45%"
  }
];

const getPriorityConfig = (priority: Priority) => {
  switch (priority) {
    case "alta":
      return {
        label: "Alta Urgência",
        bgColor: "bg-primary/20",
        textColor: "text-primary",
        borderColor: "border-primary/20",
        leftBorder: "border-l-primary"
      };
    case "media":
      return {
        label: "Média",
        bgColor: "bg-orange-500/20",
        textColor: "text-orange-500",
        borderColor: "border-orange-500/20",
        leftBorder: "border-l-orange-500"
      };
    case "baixa":
      return {
        label: "Baixa",
        bgColor: "bg-gray-500/20",
        textColor: "text-gray-400",
        borderColor: "border-gray-500/20",
        leftBorder: "border-l-gray-500"
      };
  }
};

const getActionButtons = (priority: Priority) => {
  switch (priority) {
    case "alta":
      return [
        { label: "Ver Histórico", isPrimary: false },
        { label: "Responder", isPrimary: true }
      ];
    case "media":
      return [
        { label: "Ver Histórico", isPrimary: false },
        { label: "Assumir", isPrimary: false }
      ];
    case "baixa":
      return [
        { label: "Arquivar", isPrimary: false },
        { label: "Responder", isPrimary: false }
      ];
  }
};

export default function AdminSuporte() {
  const [activeFilter, setActiveFilter] = useState<Filter>("todos");

  const filters = [
    { id: "todos" as Filter, label: "Todos" },
    { id: "novos" as Filter, label: "Novos" },
    { id: "andamento" as Filter, label: "Em Andamento" },
    { id: "prioridade" as Filter, label: "Alta Prioridade" }
  ];

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] -mx-6 -mt-6 p-4 lg:p-8 gap-8 relative">
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] mix-blend-screen" />
        <div className="absolute top-[40%] left-[20%] w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[100px] mix-blend-screen opacity-50" />
      </div>

      <div className="relative z-10 flex flex-col gap-8 max-w-[1600px] mx-auto w-full">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-1">
              Dashboard de Atendimento
            </h1>
            <p className="text-gray-400 text-sm font-medium tracking-wide uppercase">
              FBFLIX 2.0 <span className="mx-2 text-primary">•</span> Painel Administrativo
            </p>
          </div>
        </header>

        {/* Stats Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <div 
              key={index}
              className="bg-gradient-to-br from-white/5 to-white/[0.01] backdrop-blur-lg border border-white/5 rounded-2xl p-6 flex flex-col gap-2 relative overflow-hidden group hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-300 hover:shadow-[0_10px_40px_-10px_rgba(249,6,6,0.15)]"
            >
              {index === 0 && (
                <div className="absolute right-[-10px] top-[-10px] w-20 h-20 bg-primary/10 rounded-full blur-xl group-hover:bg-primary/20 transition-all" />
              )}
              <div className="flex items-center justify-between">
                <p className="text-gray-400 text-sm font-medium">{stat.label}</p>
                <stat.icon className={`size-5 ${stat.iconColor}`} />
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <h3 className="text-3xl font-bold text-white">{stat.value}</h3>
                {stat.isPositive !== null && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    stat.isPositive 
                      ? "text-green-500 bg-green-500/10" 
                      : stat.change !== "0%" 
                        ? "text-red-500 bg-red-500/10"
                        : "text-gray-500 bg-gray-800"
                  }`}>
                    {stat.isPositive !== null && stat.change !== "0%" && (
                      stat.isPositive ? <ArrowDown className="size-2.5" /> : <ArrowUp className="size-2.5" />
                    )}
                    {stat.change}
                  </span>
                )}
                {stat.isPositive === null && (
                  <span className="text-xs font-bold text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                    {stat.change}
                  </span>
                )}
              </div>
              <div className="w-full bg-gray-800 h-1 rounded-full mt-3 overflow-hidden">
                <div 
                  className={`${stat.progressColor} h-full rounded-full`} 
                  style={{ width: stat.progressWidth }}
                />
              </div>
            </div>
          ))}
        </section>

        {/* Tickets Queue */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              Fila de Atendimento
              <span className="text-sm font-normal text-gray-500 bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                24 total
              </span>
            </h2>
            <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/10">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeFilter === filter.id
                      ? "bg-white/10 text-white font-semibold shadow-sm"
                      : "text-gray-400 hover:bg-white/5"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ticket Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {mockTickets.map((ticket) => {
              const priorityConfig = getPriorityConfig(ticket.priority);
              const actionButtons = getActionButtons(ticket.priority);
              
              return (
                <div 
                  key={ticket.id}
                  className={`bg-gradient-to-br from-white/5 to-white/[0.01] backdrop-blur-lg border border-white/5 rounded-2xl p-5 flex flex-col gap-4 border-l-4 ${priorityConfig.leftBorder} relative hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-300 hover:shadow-[0_10px_40px_-10px_rgba(249,6,6,0.15)] ${ticket.priority === "baixa" ? "opacity-90 hover:opacity-100" : ""}`}
                >
                  {/* Header */}
                  <div className="flex justify-between items-start">
                    <div className="flex gap-2">
                      <span className={`px-2 py-1 rounded-md ${priorityConfig.bgColor} ${priorityConfig.textColor} text-[10px] font-bold border ${priorityConfig.borderColor} uppercase tracking-wide`}>
                        {priorityConfig.label}
                      </span>
                      <span className="px-2 py-1 rounded-md bg-white/5 text-gray-400 text-[10px] font-medium border border-white/5">
                        {ticket.category}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">{ticket.id} • {ticket.timeAgo}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-grow">
                    <h3 className="text-lg font-bold text-white leading-tight mb-1 line-clamp-1">
                      {ticket.title}
                    </h3>
                    <p className="text-sm text-gray-400 line-clamp-3">
                      {ticket.description}
                    </p>
                  </div>

                  {/* Customer Info */}
                  <div className="flex items-center gap-3 border-t border-white/5 pt-4 mt-auto">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${ticket.avatarGradient}`} />
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-white">{ticket.customerName}</span>
                      <span className="text-[10px] text-gray-500">{ticket.memberType}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-2">
                    {actionButtons.map((btn, idx) => (
                      <button
                        key={idx}
                        className={`flex-1 text-xs font-medium py-2.5 rounded-lg transition-colors ${
                          btn.isPrimary
                            ? "bg-primary text-white font-bold hover:bg-red-700 shadow-lg shadow-primary/20"
                            : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load More */}
          <div className="flex justify-center mt-6">
            <button className="flex items-center gap-2 px-8 py-4 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-semibold text-gray-300 transition-all border border-white/5 hover:border-white/10 hover:shadow-lg">
              <RefreshCw className="size-5" />
              Carregar mais tickets
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
