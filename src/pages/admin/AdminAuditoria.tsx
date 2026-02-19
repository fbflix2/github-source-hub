import { useNavigate } from "react-router-dom";
import { 
  ShoppingBag, 
  Wallet, 
  TrendingUp, 
  ShoppingCart, 
  Tag, 
  BarChart3,
  History
} from "lucide-react";

const stats = [
  {
    label: "Custo Total de Compras",
    value: "R$ 12.450,00",
    badge: "Saída",
    badgeColor: "text-red-400 bg-red-400/10 border-red-400/20",
    icon: ShoppingBag,
    iconBg: "bg-white/5 border-white/10",
    iconColor: "text-gray-300",
    subtitle: "Últimos 30 dias",
    highlighted: false
  },
  {
    label: "Receita Total de Vendas",
    value: "R$ 45.200,00",
    badge: "Entrada",
    badgeColor: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    icon: Wallet,
    iconBg: "bg-white/5 border-white/10",
    iconColor: "text-gray-300",
    subtitle: "Últimos 30 dias",
    highlighted: false
  },
  {
    label: "Lucro Bruto",
    value: "R$ 32.750,00",
    badge: "+26.5% vs mês anterior",
    badgeColor: "text-primary bg-primary/10 border-primary/20",
    icon: TrendingUp,
    iconBg: "bg-primary/20 border-primary/30",
    iconColor: "text-primary",
    subtitle: "Margem líquida estimada: 72%",
    highlighted: true
  }
];

export default function AdminAuditoria() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] -mx-6 -mt-6 p-6 lg:p-12 gap-10 relative">
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] mix-blend-screen opacity-40" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] mix-blend-screen opacity-30" />
        <div className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[150px] mix-blend-screen opacity-20" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col gap-10">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
              Visão Geral da <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">Auditoria</span>
            </h1>
            <p className="text-gray-400 text-lg font-light max-w-lg">
              Resumo financeiro de Perfis, BMs e Páginas.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => navigate("/admin/auditoria/nova-compra")}
              className="group flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white shadow-lg bg-white/5 backdrop-blur-lg border border-white/10 hover:bg-primary/15 hover:border-primary/40 hover:-translate-y-0.5 transition-all"
            >
              <ShoppingCart className="size-5 group-hover:text-primary transition-colors" />
              Nova Compra
            </button>
            <button className="group flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white shadow-lg bg-white/5 backdrop-blur-lg border border-white/10 hover:bg-primary/15 hover:border-primary/40 hover:-translate-y-0.5 transition-all">
              <Tag className="size-5 group-hover:text-primary transition-colors" />
              Nova Venda
            </button>
            <button 
              onClick={() => navigate("/admin/auditoria/balanco")}
              className="group flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white shadow-lg bg-white/5 backdrop-blur-lg border border-white/10 hover:bg-primary/15 hover:border-primary/40 hover:-translate-y-0.5 transition-all"
            >
              <BarChart3 className="size-5 group-hover:text-primary transition-colors" />
              Ver Detalhes do Balanço
            </button>
          </div>
        </header>

        {/* Metrics Dashboard */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, index) => (
            <div 
              key={index}
              className={`bg-white/[0.03] backdrop-blur-2xl border rounded-2xl p-8 relative overflow-hidden group transition-all duration-500 ${
                stat.highlighted 
                  ? "border-primary/30 shadow-[0_0_40px_-10px_rgba(249,6,6,0.15)]" 
                  : "border-white/10"
              }`}
            >
              {/* Gradient overlay for highlighted card */}
              {stat.highlighted && (
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-50" />
              )}
              
              {/* Glow effect */}
              <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl transition-all duration-500 ${
                stat.highlighted 
                  ? "bg-primary/20 group-hover:bg-primary/30" 
                  : "bg-primary/10 group-hover:bg-primary/20"
              }`} />

              <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <div className={`p-3 rounded-xl border ${stat.iconBg}`}>
                    <stat.icon className={`size-6 ${stat.iconColor}`} />
                  </div>
                  <span className={`flex items-center text-xs font-semibold px-2 py-1 rounded-md border ${stat.badgeColor}`}>
                    {stat.badge}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <h3 className={`text-sm font-medium uppercase tracking-wider ${stat.highlighted ? "text-gray-300 font-bold" : "text-gray-400"}`}>
                    {stat.label}
                  </h3>
                  <div className="flex items-baseline gap-2">
                    <span className={`tracking-tight ${
                      stat.highlighted 
                        ? "text-4xl lg:text-5xl font-black text-white drop-shadow-lg" 
                        : "text-3xl lg:text-4xl font-bold text-white"
                    }`}>
                      {stat.value}
                    </span>
                  </div>
                  <p className={`text-xs mt-2 ${stat.highlighted ? "text-gray-400 font-medium" : "text-gray-500 font-mono opacity-60"}`}>
                    {stat.highlighted ? (
                      <>Margem líquida estimada: <span className="text-white">72%</span></>
                    ) : (
                      stat.subtitle
                    )}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Quick Recent Activity */}
        <div className="w-full bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 opacity-80 hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <History className="size-5 text-gray-400" />
            </div>
            <div>
              <p className="text-sm text-white font-medium">Última atualização do sistema</p>
              <p className="text-xs text-gray-500">Há 15 minutos • Sincronizado automaticamente</p>
            </div>
          </div>
          <div className="h-1 flex-1 w-full sm:w-auto bg-white/5 rounded-full max-w-xs mx-4 overflow-hidden">
            <div className="h-full bg-primary w-[85%] rounded-full shadow-[0_0_10px_rgba(249,6,6,0.5)]" />
          </div>
          <span className="text-xs font-mono text-gray-400">85% da Meta Mensal</span>
        </div>
      </div>

      {/* Bottom aesthetic glow */}
      <div className="fixed bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50 pointer-events-none" />
    </div>
  );
}
