import { Users, Receipt, Wallet, TrendingUp, Database, CheckCircle, Clock, AlertTriangle, Ban, User, Briefcase, Globe, MoreVertical } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

const statsCards = [
  {
    title: "Total de Clientes",
    value: "12.450",
    change: "+12%",
    icon: Users,
    iconBg: "bg-blue-500/20",
    iconColor: "text-blue-400",
  },
  {
    title: "Total de Transações",
    value: "8.320",
    change: "+5%",
    icon: Receipt,
    iconBg: "bg-purple-500/20",
    iconColor: "text-purple-400",
  },
  {
    title: "Saldo em Carteiras",
    value: "R$ 145.2k",
    change: "+22%",
    icon: Wallet,
    iconBg: "bg-primary/20",
    iconColor: "text-primary",
  },
];

const proxyMetrics = [
  { label: "Total Proxies", value: "5.000", icon: Database, color: "text-white" },
  { label: "Ativas", value: "4.200", icon: CheckCircle, color: "text-green-500" },
  { label: "Pendentes", value: "150", icon: Clock, color: "text-yellow-500" },
  { label: "Vencidas", value: "500", icon: AlertTriangle, color: "text-red-500" },
  { label: "Canceladas", value: "150", icon: Ban, color: "text-blue-400" },
];

const chartData = [
  { name: "01 Nov", value: 12000 },
  { name: "05 Nov", value: 18000 },
  { name: "10 Nov", value: 8500 },
  { name: "15 Nov", value: 24000 },
  { name: "20 Nov", value: 14000 },
  { name: "25 Nov", value: 28000 },
  { name: "30 Nov", value: 15000 },
];

const salesByProduct = [
  { name: "Perfis", sales: 1240, revenue: "R$ 45.2k", icon: User, color: "bg-blue-500" },
  { name: "BM", sales: 850, revenue: "R$ 32.8k", icon: Briefcase, color: "bg-purple-500" },
  { name: "Proxy", sales: 2100, revenue: "R$ 18.5k", icon: Database, color: "bg-primary" },
  { name: "Páginas", sales: 450, revenue: "R$ 12.1k", icon: Globe, color: "bg-cyan-500" },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {statsCards.map((card) => (
          <div 
            key={card.title}
            className="glass-panel rounded-xl p-4 relative overflow-hidden group"
          >
            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <card.icon className="size-14 text-white" />
            </div>

            <div className="flex flex-col gap-2 relative z-10">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 ${card.iconBg} rounded-lg ${card.iconColor}`}>
                  <card.icon className="size-4" />
                </div>
                <p className="text-white/60 text-xs font-medium">{card.title}</p>
              </div>
              <div className="flex items-end gap-2">
                <h3 className="text-2xl font-bold text-white tracking-tight">{card.value}</h3>
                <span className="flex items-center text-green-500 text-xs font-medium mb-0.5 bg-green-500/10 px-1.5 py-0.5 rounded">
                  <TrendingUp className="size-3 mr-0.5" />
                  {card.change}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Proxy Metrics */}
      <div className="glass-panel rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Database className="size-4 text-white/60" />
          <h3 className="text-sm font-semibold text-white">Métricas de Proxy</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {proxyMetrics.map((metric) => (
            <div 
              key={metric.label}
              className="bg-white/5 rounded-lg p-3 flex items-center gap-3"
            >
              <div className={`p-2 rounded-lg bg-white/10 ${metric.color}`}>
                <metric.icon className="size-4" />
              </div>
              <div>
                <p className="text-white/40 text-[10px] font-medium uppercase tracking-wider">
                  {metric.label}
                </p>
                <p className={`text-lg font-bold ${metric.color}`}>
                  {metric.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Movement Chart */}
      <div className="glass-panel rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Movimentação de Pagamentos</h3>
            <p className="text-white/40 text-xs">Análise financeira por período e tipo de serviço.</p>
          </div>

          <div className="flex items-center gap-2">
            <select className="bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-white/80">
              <option>Todos os Itens</option>
              <option>Proxies</option>
              <option>Assinaturas</option>
            </select>

            <div className="flex bg-white/5 rounded-md p-0.5">
              <button className="px-2 py-1 text-xs text-white/60 hover:text-white transition-colors">Dia</button>
              <button className="px-2 py-1 text-xs text-white/60 hover:text-white transition-colors">Semana</button>
              <button className="px-2 py-1 text-xs bg-primary/20 text-primary rounded">Mês</button>
              <button className="px-2 py-1 text-xs text-white/60 hover:text-white transition-colors">Ano</button>
            </div>
          </div>
        </div>

        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="20%">
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false}
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                tickFormatter={(value) => `R$ ${value / 1000}k`}
              />
              <Tooltip 
                contentStyle={{ 
                  background: 'rgba(0,0,0,0.9)', 
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                formatter={(value: number) => [`R$ ${(value / 1000).toFixed(1)}k`, 'Valor']}
                labelStyle={{ color: 'white' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={`hsl(var(--primary) / ${0.4 + (entry.value / 28000) * 0.6})`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sales Volume by Product */}
      <div className="glass-panel rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Volume de Vendas por Tipo de Produto</h3>
            <p className="text-white/40 text-xs">Desempenho comparativo de Perfis, BM, Proxy e Páginas.</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-white/5 rounded-md p-0.5">
              <button className="px-2 py-1 text-xs text-white/60 hover:text-white transition-colors">7D</button>
              <button className="px-2 py-1 text-xs bg-primary/20 text-primary rounded">30D</button>
              <button className="px-2 py-1 text-xs text-white/60 hover:text-white transition-colors">Total</button>
            </div>
            <button className="p-1 text-white/40 hover:text-white transition-colors">
              <MoreVertical className="size-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {salesByProduct.map((product) => (
            <div 
              key={product.name}
              className="bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 ${product.color} rounded-lg`}>
                  <product.icon className="size-3.5 text-white" />
                </div>
                <span className="text-white font-medium text-sm">{product.name}</span>
              </div>
              <p className="text-white/60 text-xs">{product.sales.toLocaleString()} vendas</p>
              <p className="text-white font-semibold text-lg">{product.revenue}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
