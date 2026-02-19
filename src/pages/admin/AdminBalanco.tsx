import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft,
  ShoppingCart,
  Wallet,
  TrendingUp,
  Percent,
  Tag,
  Timer,
  Download,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Search,
  ArrowUp,
  ArrowDown
} from "lucide-react";

const stats = [
  { label: "Custo Total Compras", value: "R$ 18.350", badge: "+12%", badgeColor: "text-red-400 bg-red-400/10", icon: ShoppingCart, iconBg: "bg-primary/10 border-primary/20", iconColor: "text-primary", isUp: true },
  { label: "Receita Total Vendas", value: "R$ 62.100", badge: "+8%", badgeColor: "text-emerald-400 bg-emerald-400/10", icon: Wallet, iconBg: "bg-emerald-500/10 border-emerald-500/20", iconColor: "text-emerald-500", isUp: true },
  { label: "Lucro Líquido", value: "R$ 43.750", badge: "Margin 70.4%", badgeColor: "text-white bg-white/20", icon: Wallet, iconBg: "bg-white/10 border-white/20", iconColor: "text-white", highlighted: true },
  { label: "Margem Média", value: "70.4%", badge: "+2.1%", badgeColor: "text-emerald-400 bg-emerald-400/10", icon: Percent, iconBg: "bg-white/5 border-white/10", iconColor: "text-gray-300", isUp: true },
  { label: "Custo Médio / Item", value: "R$ 85,00", badge: "-5%", badgeColor: "text-red-400 bg-red-400/10", icon: Tag, iconBg: "bg-white/5 border-white/10", iconColor: "text-gray-300", isUp: false },
  { label: "Tempo Médio Venda", value: "4.2 Dias", badge: "Rápido", badgeColor: "text-emerald-400 bg-emerald-400/10", icon: Timer, iconBg: "bg-white/5 border-white/10", iconColor: "text-gray-300" }
];

const recentTransactions = [
  { title: "Venda BM #902", date: "24/02", partner: "Agência Alpha", value: "+R$ 2.200", isPositive: true },
  { title: "Compra Lote #11", date: "23/02", partner: "Fornecedor X", value: "-R$ 1.200", isPositive: false },
  { title: "Venda Página 5k", date: "22/02", partner: "John Doe", value: "+R$ 350", isPositive: true },
  { title: "Venda BM Ilimitada", date: "21/02", partner: "E-com Drop", value: "+R$ 1.800", isPositive: true },
  { title: "Compra Docs", date: "20/02", partner: "Supplier Elite", value: "-R$ 250", isPositive: false }
];

const tableData = [
  { type: "VENDA", item: "Perfil BM Verificada #902", partner: "Agência Alpha", date: "24/02/2024", price: "R$ 1.500,00", qty: 2, cost: "R$ 800,00", revenue: "R$ 3.000,00", profit: "+R$ 2.200" },
  { type: "COMPRA", item: "Lote Perfis Farmados (x10)", partner: "Fornecedor X", date: "23/02/2024", price: "R$ 120,00", qty: 10, cost: "-R$ 1.200,00", revenue: "-", profit: "-" },
  { type: "VENDA", item: "Página Restaurada 5k", partner: "Cliente Final John", date: "22/02/2024", price: "R$ 450,00", qty: 1, cost: "R$ 100,00", revenue: "R$ 450,00", profit: "+R$ 350" },
  { type: "VENDA", item: "BM Ilimitada com Pixel", partner: "E-commerce Dropship", date: "21/02/2024", price: "R$ 2.000,00", qty: 1, cost: "R$ 200,00", revenue: "R$ 2.000,00", profit: "+R$ 1.800" }
];

const chartFilters = ["Lucro", "Custos", "Receitas"];
const timeFilters = ["7 Dias", "Mês Atual", "Ano Atual", "Personalizado"];

export default function AdminBalanco() {
  const navigate = useNavigate();
  const [activeChartFilter, setActiveChartFilter] = useState("Lucro");
  const [activeTimeFilter, setActiveTimeFilter] = useState("7 Dias");
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] -mx-6 -mt-6 p-4 lg:p-6 gap-6 relative">
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] mix-blend-screen opacity-40" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] mix-blend-screen opacity-30" />
      </div>

      <div className="relative z-10 w-full max-w-[1600px] mx-auto flex flex-col gap-6">
        {/* Header */}
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 pb-2 border-b border-white/5">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate("/admin/auditoria")}
              className="p-2.5 rounded-full bg-white/5 backdrop-blur-lg border border-white/10 text-gray-400 hover:text-white hover:bg-primary/15 hover:border-primary/40 transition-all group"
            >
              <ArrowLeft className="size-5 group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                Balanço Financeiro <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-white">Consolidado</span>
              </h1>
              <p className="text-gray-400 text-xs font-light mt-1">
                Auditoria integrada de Perfis, BMs e Páginas.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            {/* Type Filter */}
            <div className="flex items-center gap-2 bg-black/30 border border-white/10 px-3 py-1.5 rounded-lg text-sm cursor-pointer hover:border-primary/50 transition-colors">
              <span className="text-gray-400 text-xs uppercase font-medium">Tipo:</span>
              <span className="font-medium text-white">Todos os Itens</span>
              <ChevronDown className="size-4 text-gray-400" />
            </div>

            {/* Time Filters */}
            <div className="flex bg-black/40 p-1 rounded-lg border border-white/5 overflow-hidden">
              {timeFilters.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveTimeFilter(filter)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    activeTimeFilter === filter
                      ? "bg-white/10 text-white shadow-sm"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Export Button */}
            <button className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium text-white shadow-lg bg-white/5 backdrop-blur-lg border border-primary/30 hover:bg-primary/10 transition-all ml-auto xl:ml-0">
              <Download className="size-4" />
              Exportar Relatório
            </button>
          </div>
        </header>

        {/* Stats Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {stats.map((stat, index) => (
            <div 
              key={index}
              className={`bg-white/[0.03] backdrop-blur-2xl border rounded-xl p-4 relative overflow-hidden group hover:border-white/20 transition-colors ${
                stat.highlighted ? "border-primary/30 bg-primary/5" : "border-white/10"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className={`p-1.5 rounded-md border ${stat.iconBg}`}>
                  <stat.icon className={`size-4 ${stat.iconColor}`} />
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${stat.badgeColor}`}>
                  {stat.isUp !== undefined && (
                    stat.isUp ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                  )}
                  {stat.badge}
                </span>
              </div>
              <h3 className="text-gray-400 text-[10px] font-medium uppercase tracking-wider">{stat.label}</h3>
              <div className={`text-xl mt-0.5 ${stat.highlighted ? "font-black" : "font-bold"} text-white`}>
                {stat.value}
              </div>
            </div>
          ))}
        </section>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Left Column - Charts */}
          <div className="xl:col-span-3 flex flex-col gap-6">
            {/* Evolution Chart */}
            <section className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <BarChart3 className="size-5 text-primary" />
                  Evolução Financeira
                </h2>
                <div className="flex gap-2 bg-black/30 p-1 rounded-lg">
                  {chartFilters.map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setActiveChartFilter(filter)}
                      className={`px-3 py-1 rounded-md text-xs transition-all ${
                        activeChartFilter === filter
                          ? "bg-white/10 border border-white/20 text-white"
                          : "text-gray-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart Placeholder */}
              <div className="w-full h-52 relative">
                <div className="absolute inset-0 flex flex-col justify-between text-[10px] text-gray-600 font-mono pr-2">
                  {["R$ 60k", "R$ 45k", "R$ 30k", "R$ 15k", "R$ 0"].map((label, i) => (
                    <div key={i} className="w-full border-b border-white/5 pb-1 text-right pr-2">{label}</div>
                  ))}
                </div>
                <svg className="absolute inset-0 w-full h-full pt-4 pb-4 ml-8" preserveAspectRatio="none" viewBox="0 0 1000 100" style={{ width: "calc(100% - 2rem)" }}>
                  <defs>
                    <linearGradient id="gradientProfit" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#fff" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="gradientCost" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#f90606" stopOpacity="0.1" />
                      <stop offset="100%" stopColor="#f90606" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,50 L1000,50" fill="none" opacity="0.2" stroke="#666" strokeDasharray="4 4" strokeWidth="1" />
                  <path d="M0,90 Q150,80 300,75 T600,65 T1000,70" fill="url(#gradientCost)" opacity="0.7" stroke="#f90606" strokeWidth="2" />
                  <path d="M0,70 Q250,30 500,20 T1000,30" fill="url(#gradientProfit)" stroke="white" strokeWidth="3" style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,0.15))" }} />
                  <circle cx="500" cy="20" fill="#000" r="4" stroke="white" strokeWidth="2" />
                </svg>
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-gray-500 font-mono ml-8">
                {["01 Fev", "05 Fev", "10 Fev", "15 Fev", "20 Fev", "25 Fev", "Hoje"].map((label, i) => (
                  <span key={i}>{label}</span>
                ))}
              </div>
            </section>

            {/* Sub Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Costs vs Revenue */}
              <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-6 flex flex-col">
                <h3 className="text-sm font-semibold text-white mb-4">Custos vs Receitas</h3>
                <div className="flex-grow flex items-end justify-between gap-2 h-40 pt-4">
                  {[
                    { label: "BMs", cost: 30, revenue: 60 },
                    { label: "Perfis", cost: 45, revenue: 85 },
                    { label: "Págs", cost: 20, revenue: 40 },
                    { label: "Outros", cost: 15, revenue: 25 }
                  ].map((item) => (
                    <div key={item.label} className="flex flex-col gap-1 items-center w-full">
                      <div className="flex gap-1 items-end h-full">
                        <div className="w-3 bg-primary/80 rounded-t-sm" style={{ height: `${item.cost}%` }} />
                        <div className="w-3 bg-white/80 rounded-t-sm" style={{ height: `${item.revenue}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-500">{item.label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center gap-4 mt-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-primary/80 rounded-full" />
                    <span className="text-[10px] text-gray-400">Custos</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-white/80 rounded-full" />
                    <span className="text-[10px] text-gray-400">Receitas</span>
                  </div>
                </div>
              </div>

              {/* Profit by Item */}
              <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-6 flex flex-col">
                <h3 className="text-sm font-semibold text-white mb-2">Lucro por Item</h3>
                <div className="flex flex-row items-center justify-around h-full">
                  <div className="relative w-32 h-32">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" fill="none" r="15.915" stroke="#333" strokeWidth="3" />
                      <circle cx="18" cy="18" fill="none" r="15.915" stroke="#f90606" strokeDasharray="40, 100" strokeDashoffset="0" strokeWidth="3" className="transition-all hover:stroke-[4]" />
                      <circle cx="18" cy="18" fill="none" r="15.915" stroke="#ffffff" strokeDasharray="30, 100" strokeDashoffset="-40" strokeWidth="3" className="transition-all hover:stroke-[4]" />
                      <circle cx="18" cy="18" fill="none" r="15.915" stroke="#666666" strokeDasharray="20, 100" strokeDashoffset="-70" strokeWidth="3" className="transition-all hover:stroke-[4]" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <span className="text-xs text-gray-400">Total</span>
                      <span className="text-sm font-bold text-white">100%</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 text-xs">
                    {[
                      { color: "bg-primary", label: "Perfis (40%)" },
                      { color: "bg-white", label: "BMs (30%)" },
                      { color: "bg-gray-500", label: "Páginas (20%)" },
                      { color: "bg-gray-800", label: "Outros (10%)" }
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${item.color}`} />
                        <span className="text-gray-300">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="xl:col-span-1 flex flex-col gap-6">
            {/* Forecast */}
            <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-6 bg-gradient-to-b from-white/5 to-transparent border-t">
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Previsão Próximo Mês</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white">R$ 52k</span>
                <span className="text-sm font-medium text-emerald-400 flex items-center">
                  <ArrowUp className="size-4" /> 15%
                </span>
              </div>
              <div className="mt-4 h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-white w-[75%] rounded-full" />
              </div>
              <p className="text-[10px] text-gray-500 mt-2">Baseado no histórico de crescimento dos últimos 3 meses.</p>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-0 overflow-hidden flex-grow flex flex-col">
              <div className="p-4 border-b border-white/5 bg-white/5">
                <h3 className="text-sm font-semibold text-white">Lançamentos Recentes</h3>
              </div>
              <div className="flex-grow overflow-y-auto max-h-[400px]">
                <ul className="divide-y divide-white/5">
                  {recentTransactions.map((tx, idx) => (
                    <li key={idx} className="p-4 hover:bg-white/5 transition-colors cursor-pointer flex justify-between items-center group">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-white group-hover:text-primary transition-colors">{tx.title}</span>
                        <span className="text-[10px] text-gray-500">{tx.date} • {tx.partner}</span>
                      </div>
                      <span className={`text-xs font-bold ${tx.isPositive ? "text-emerald-400" : "text-red-400"}`}>
                        {tx.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-3 text-center border-t border-white/5">
                <button className="text-xs text-primary hover:text-white transition-colors">Ver todos</button>
              </div>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <section className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-lg font-semibold text-white">Detalhes de Transações</h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 size-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar item, cliente..."
                className="w-full pl-10 pr-4 py-2 text-sm rounded-lg bg-black/30 border border-white/10 text-white placeholder-gray-600 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-400">
              <thead className="bg-white/5 text-xs uppercase font-semibold text-white">
                <tr>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Item</th>
                  <th className="px-6 py-4">Fornecedor/Cliente</th>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4 text-right">Preço Unit.</th>
                  <th className="px-6 py-4 text-center">Qtd</th>
                  <th className="px-6 py-4 text-right text-red-300">Custo Total</th>
                  <th className="px-6 py-4 text-right text-gray-300">Receita Total</th>
                  <th className="px-6 py-4 text-right">Lucro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tableData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wide ${
                        row.type === "VENDA" 
                          ? "bg-white/10 text-white border border-white/20" 
                          : "bg-primary/10 text-red-400 border border-red-500/20"
                      }`}>
                        {row.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-white group-hover:text-primary transition-colors">{row.item}</td>
                    <td className="px-6 py-4">{row.partner}</td>
                    <td className="px-6 py-4">{row.date}</td>
                    <td className="px-6 py-4 text-right">{row.price}</td>
                    <td className="px-6 py-4 text-center">{row.qty}</td>
                    <td className={`px-6 py-4 text-right ${row.type === "COMPRA" ? "font-medium text-red-400" : "text-red-400/70"}`}>{row.cost}</td>
                    <td className="px-6 py-4 text-right font-medium text-white">{row.revenue}</td>
                    <td className={`px-6 py-4 text-right font-bold ${row.profit.startsWith("+") ? "text-emerald-400" : "text-gray-600"}`}>{row.profit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between p-4 border-t border-white/5">
            <span className="text-xs text-gray-500">Mostrando 1-4 de 124 transações</span>
            <div className="flex gap-2">
              <button className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 disabled:opacity-50 transition-colors">
                <ChevronLeft className="size-4" />
              </button>
              <button className="px-3 py-1 rounded-lg bg-primary text-white text-xs font-medium">1</button>
              <button className="px-3 py-1 rounded-lg hover:bg-white/10 text-gray-400 text-xs font-medium transition-colors">2</button>
              <button className="px-3 py-1 rounded-lg hover:bg-white/10 text-gray-400 text-xs font-medium transition-colors">3</button>
              <span className="text-gray-600 self-center">...</span>
              <button className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 transition-colors">
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Bottom aesthetic glow */}
      <div className="fixed bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50 pointer-events-none" />
    </div>
  );
}
