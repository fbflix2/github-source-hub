import { useNavigate } from "react-router-dom";

const sidebarItems = [
  { icon: "home", label: "Home", active: true },
  { icon: "swap_horiz", label: "Trade" },
  { icon: "shopping_bag", label: "Loja" },
  { icon: "monitoring", label: "Charts" },
  { icon: "history", label: "Histórico" },
];

const transactions = [
  { name: "Pix Deposit", type: "Buy", typeColor: "bg-[#00ff88]/10 text-[#00ff88]", amount: "+450 FBX", amountColor: "text-[#00eeff]", status: "Success", statusDot: "bg-[#00ff88]", time: "2 min ago" },
  { name: "Swap FBX/ETH", type: "Sell", typeColor: "bg-[#ff4d4d]/10 text-[#ff4d4d]", amount: "-120 FBX", amountColor: "text-[#ff4d4d]", status: "Success", statusDot: "bg-[#00ff88]", time: "1 hour ago" },
  { name: "Shop Purchase", type: "Spend", typeColor: "bg-slate-400/10 text-slate-400", amount: "-35 FBX", amountColor: "text-[#ff4d4d]", status: "Processing", statusDot: "bg-[#00eeff]", time: "3 hours ago" },
];

export default function TokenFBX() {
  const navigate = useNavigate();

  return (
    <div className="flex h-screen overflow-hidden bg-[#0A0A0A]">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-[#00eeff]/10 bg-[#0A0A0A] flex-col z-50 hidden lg:flex">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00eeff] to-blue-600 flex items-center justify-center text-[#0A0A0A] shadow-lg shadow-[#00eeff]/20">
            <span className="material-symbols-outlined font-bold">token</span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-[#00eeff] text-lg font-extrabold tracking-tighter uppercase leading-none">FBX Token</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">FbFlix Ecosystem</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {sidebarItems.map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all ${
                item.active
                  ? "bg-[#00eeff]/10 text-[#00eeff] border border-[#00eeff]/20"
                  : "text-slate-400 hover:text-[#00eeff] hover:bg-[#00eeff]/5"
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="text-sm font-semibold">{item.label}</span>
            </div>
          ))}
          <div className="mt-8 pt-8 border-t border-[#00eeff]/5">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-[#00eeff] hover:bg-[#00eeff]/5 transition-all cursor-pointer">
              <span className="material-symbols-outlined">settings</span>
              <span className="text-sm font-semibold">Settings</span>
            </div>
          </div>
        </nav>

        <div className="p-4 m-4 rounded-xl bg-[#00eeff]/5 border border-[#00eeff]/10">
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2">Suporte Premium</p>
          <p className="text-xs text-slate-300 leading-relaxed">Precisa de ajuda com suas transações FBX?</p>
          <button
            onClick={() => navigate("/tickets")}
            className="mt-3 w-full py-2 bg-[#00eeff]/10 text-[#00eeff] text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-[#00eeff]/20 transition-all"
          >
            Abrir Ticket
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className="flex-1 flex flex-col min-w-0 bg-[#0A0A0A]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0, 238, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 238, 255, 0.03) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      >
        {/* Top Bar */}
        <header className="h-16 border-b border-[#00eeff]/10 flex items-center justify-between px-4 sm:px-8 bg-[#0A0A0A]/80 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-4">
            {/* Mobile back button */}
            <button
              onClick={() => navigate("/mercado")}
              className="lg:hidden text-slate-400 hover:text-[#00eeff] transition-colors"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="relative group hidden sm:block">
              <span className="material-symbols-outlined text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 text-lg group-focus-within:text-[#00eeff] transition-colors">
                search
              </span>
              <input
                className="bg-[#161b1c] border border-[#00eeff]/10 text-slate-200 text-sm rounded-lg pl-10 pr-4 py-2 w-64 focus:ring-[#00eeff] focus:border-[#00eeff] placeholder-slate-600 transition-all outline-none"
                placeholder="Search markets..."
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-3 px-4 py-2 bg-[#00eeff]/10 rounded-full border border-[#00eeff]/20 cursor-pointer hover:bg-[#00eeff]/20 transition-all">
              <div className="w-6 h-6 rounded-full bg-[#00eeff] flex items-center justify-center text-[#0A0A0A]">
                <span className="material-symbols-outlined text-[14px] font-bold">account_balance_wallet</span>
              </div>
              <span className="text-[#00eeff] font-bold text-sm tracking-tight">1.245,67 FBX</span>
            </div>
            <button className="p-2 text-slate-400 hover:text-[#00eeff] transition-colors">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <div className="h-8 w-[1px] bg-[#00eeff]/10 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-3 cursor-pointer">
              <div className="text-right">
                <p className="text-xs font-bold text-slate-100">Alex Rivers</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Verified Pro</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00eeff] to-blue-600 border-2 border-[#00eeff]/30 flex items-center justify-center text-[#0A0A0A]">
                <span className="material-symbols-outlined">person</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="grid grid-cols-12 gap-6">
            {/* Price Chart Card */}
            <div className="col-span-12 rounded-3xl relative overflow-hidden p-6 sm:p-8" style={{
              background: "rgba(22, 27, 28, 0.7)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(0, 238, 255, 0.1)",
            }}>
              <div className="absolute top-0 right-0 p-6 sm:p-8">
                <div className="flex items-center gap-2 px-3 py-1 bg-[#00ff88]/10 text-[#00ff88] rounded-full border border-[#00ff88]/20">
                  <span className="material-symbols-outlined text-xs">trending_up</span>
                  <span className="text-xs font-bold uppercase tracking-widest">+12.5%</span>
                </div>
              </div>
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-8">
                <div className="space-y-2">
                  <h2 className="text-slate-400 font-bold uppercase tracking-widest text-xs">FBX Price Live (7D)</h2>
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl sm:text-5xl font-extrabold text-slate-100 tracking-tight">$0.4224</span>
                    <span className="text-slate-500 font-medium">USD</span>
                  </div>
                  <div className="flex gap-4 mt-6">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Low</span>
                      <span className="text-[#ff4d4d] font-bold">$0.35</span>
                    </div>
                    <div className="w-[1px] bg-[#00eeff]/10 h-8" />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">High</span>
                      <span className="text-[#00ff88] font-bold">$0.48</span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 w-full h-[180px]">
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 40">
                    <defs>
                      <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#00eeff" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#00eeff" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0,35 Q10,10 20,30 T40,15 T60,35 T80,5 T100,20 V40 H0 Z" fill="url(#chartGradient)" />
                    <path d="M0,35 Q10,10 20,30 T40,15 T60,35 T80,5 T100,20" fill="none" stroke="#00eeff" strokeLinecap="round" strokeWidth="0.5" />
                    <circle cx="20" cy="30" fill="#ff4d4d" r="0.8" />
                    <circle cx="80" cy="5" fill="#00ff88" r="0.8" />
                  </svg>
                  <div className="flex justify-between mt-2 px-1">
                    {["Mon", "Wed", "Fri", "Sun"].map((d) => (
                      <span key={d} className="text-[10px] font-bold text-slate-600 uppercase">{d}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            {[
              { icon: "analytics", label: "Market Cap", value: "$12,504,820", change: "+5.2%", changeColor: "text-[#00ff88]", borderColor: "border-l-[#00eeff]/40", barColor: "bg-[#00eeff]", barBg: "bg-[#00eeff]/10", barWidth: "65%", iconBg: "text-[#00eeff]/60 bg-[#00eeff]/5" },
              { icon: "equalizer", label: "24h Volume", value: "$1,245,000", change: "-2.1%", changeColor: "text-[#ff4d4d]", borderColor: "border-l-[#ff4d4d]/40", barColor: "bg-[#ff4d4d]", barBg: "bg-[#ff4d4d]/10", barWidth: "42%", iconBg: "text-[#ff4d4d]/60 bg-[#ff4d4d]/5" },
              { icon: "groups", label: "Holders", value: "8,420", change: "+0.8%", changeColor: "text-[#00ff88]", borderColor: "border-l-[#00ff88]/40", barColor: "bg-[#00ff88]", barBg: "bg-[#00ff88]/10", barWidth: "88%", iconBg: "text-[#00ff88]/60 bg-[#00ff88]/5" },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`col-span-12 md:col-span-4 p-6 rounded-2xl border-l-4 ${stat.borderColor}`}
                style={{
                  background: "rgba(22, 27, 28, 0.7)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(0, 238, 255, 0.1)",
                  borderLeftWidth: "4px",
                }}
              >
                <div className="flex justify-between items-start mb-4">
                  <span className={`material-symbols-outlined p-2 rounded-lg ${stat.iconBg}`}>{stat.icon}</span>
                  <span className={`text-xs font-bold ${stat.changeColor}`}>{stat.change}</span>
                </div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">{stat.label}</p>
                <h3 className="text-2xl font-bold text-slate-100 tracking-tight">{stat.value}</h3>
                <div className={`mt-4 h-1 ${stat.barBg} rounded-full overflow-hidden`}>
                  <div className={`h-full ${stat.barColor}`} style={{ width: stat.barWidth }} />
                </div>
              </div>
            ))}

            {/* Transactions Table */}
            <div
              className="col-span-12 lg:col-span-8 rounded-2xl overflow-hidden"
              style={{
                background: "rgba(22, 27, 28, 0.7)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(0, 238, 255, 0.1)",
              }}
            >
              <div className="p-6 border-b border-[#00eeff]/10 flex justify-between items-center">
                <h4 className="font-bold text-slate-100 uppercase tracking-widest text-xs">Recent Transactions</h4>
                <button className="text-[#00eeff] text-[10px] font-bold uppercase hover:underline">View All</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#00eeff]/5 text-[10px] uppercase font-bold tracking-widest text-slate-500">
                    <tr>
                      <th className="px-6 py-4">Transaction</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Time</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {transactions.map((tx, i) => (
                      <tr
                        key={i}
                        className={`hover:bg-[#00eeff]/5 transition-colors ${i < transactions.length - 1 ? "border-b border-[#00eeff]/5" : ""}`}
                      >
                        <td className="px-6 py-4 text-slate-100 font-medium">{tx.name}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${tx.typeColor}`}>{tx.type}</span>
                        </td>
                        <td className={`px-6 py-4 font-bold ${tx.amountColor}`}>{tx.amount}</td>
                        <td className="px-6 py-4">
                          <span className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${tx.statusDot}`} />
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500">{tx.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CTA Cards */}
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
              {/* Recarregar com Pix */}
              <div
                className="p-[1px] rounded-2xl"
                style={{
                  background: "#00eeff",
                  boxShadow: "0 0 10px rgba(0, 238, 255, 0.3)",
                  border: "1px solid rgba(0, 238, 255, 0.5)",
                }}
              >
                <div className="bg-[#0A0A0A] p-6 rounded-[15px] h-full flex flex-col justify-between group cursor-pointer overflow-hidden relative">
                  <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-20 transition-opacity">
                    <span className="material-symbols-outlined text-9xl">qr_code_2</span>
                  </div>
                  <div className="relative z-10">
                    <h4 className="text-xl font-extrabold text-[#00eeff] tracking-tight mb-2">Recarregar com Pix</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mb-6">
                      Receba FBX instantaneamente em sua carteira com pagamentos via Pix.
                    </p>
                    <button className="w-full py-4 bg-[#00eeff] text-[#0A0A0A] font-extrabold rounded-xl uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all">
                      <span className="material-symbols-outlined">bolt</span>
                      Gerar QR Code
                    </button>
                  </div>
                </div>
              </div>

              {/* Vender FBX */}
              <div
                className="p-6 rounded-2xl flex flex-col justify-between group cursor-pointer transition-all hover:border-[#ff4d4d]/30"
                style={{
                  background: "rgba(22, 27, 28, 0.7)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(0, 238, 255, 0.1)",
                }}
              >
                <div>
                  <h4 className="text-xl font-extrabold text-slate-100 tracking-tight mb-2">Vender FBX</h4>
                  <p className="text-xs text-slate-500 leading-relaxed mb-6">
                    Converta seus FBX para Real (BRL) e receba via Pix em sua conta bancária.
                  </p>
                  <button className="w-full py-4 bg-[#161b1c] border border-slate-700 text-slate-300 font-extrabold rounded-xl uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-[#ff4d4d]/10 hover:border-[#ff4d4d]/40 hover:text-[#ff4d4d] transition-all">
                    <span className="material-symbols-outlined">account_balance</span>
                    Vender Tokens
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
