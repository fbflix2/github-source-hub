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
    <div className="max-w-7xl mx-auto h-[calc(100vh-80px)] overflow-hidden">

      {/* Sidebar + Main grid */}
      <div className="flex gap-4 h-full py-3">
        {/* Compact Sidebar */}
        <aside className="w-48 flex-shrink-0 hidden lg:flex flex-col gap-1.5 rounded-2xl p-3 border border-[#00eeff]/10 bg-[#0A0A0A]">
          <div className="flex items-center gap-2 px-3 py-2.5 mb-2 rounded-xl bg-[#00eeff]/5 border border-[#00eeff]/15">
            <div className="w-7 h-7 rounded-lg bg-[#00eeff]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-sm text-[#00eeff]">account_balance_wallet</span>
            </div>
            <span className="text-[#00eeff] text-sm font-bold tracking-tight">1.245,67 FBX</span>
          </div>
          {sidebarItems.map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm ${
                item.active
                  ? "bg-[#00eeff]/10 text-[#00eeff] border border-[#00eeff]/20"
                  : "text-slate-400 hover:text-[#00eeff] hover:bg-[#00eeff]/5"
              }`}
            >
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
              <span className="font-semibold text-xs">{item.label}</span>
            </div>
          ))}
          <div className="mt-4 pt-3 border-t border-[#00eeff]/5">
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-400 hover:text-[#00eeff] hover:bg-[#00eeff]/5 transition-all cursor-pointer">
              <span className="material-symbols-outlined text-lg">settings</span>
              <span className="font-semibold text-xs">Settings</span>
            </div>
          </div>
          <div className="mt-auto p-3 rounded-lg bg-[#00eeff]/5 border border-[#00eeff]/10 mt-4">
            <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-1">Suporte</p>
            <p className="text-[11px] text-slate-300 leading-relaxed">Precisa de ajuda?</p>
            <button
              onClick={() => navigate("/tickets")}
              className="mt-2 w-full py-1.5 bg-[#00eeff]/10 text-[#00eeff] text-[9px] font-bold uppercase tracking-wider rounded-md hover:bg-[#00eeff]/20 transition-all"
            >
              Abrir Ticket
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div
          className="flex-1 min-w-0 space-y-3 rounded-2xl p-4 border border-[#00eeff]/10 overflow-hidden"
          style={{
            background: "#0A0A0A",
            backgroundImage:
              "linear-gradient(rgba(0, 238, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 238, 255, 0.03) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        >
          {/* Price Chart */}
          <div
            className="rounded-xl p-4 relative overflow-hidden"
            style={{
              background: "rgba(22, 27, 28, 0.7)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(0, 238, 255, 0.1)",
            }}
          >
            <div className="absolute top-4 right-4">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#00ff88]/10 text-[#00ff88] rounded-full border border-[#00ff88]/20">
                <span className="material-symbols-outlined text-[10px]">trending_up</span>
                <span className="text-[10px] font-bold uppercase tracking-widest">+12.5%</span>
              </div>
            </div>
            <div className="flex flex-col md:flex-row justify-between items-end gap-6">
              <div className="space-y-1">
                <h2 className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">FBX Price Live (7D)</h2>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-100 tracking-tight">$0.4224</span>
                  <span className="text-slate-500 text-sm font-medium">USD</span>
                </div>
                <div className="flex gap-4 mt-3">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Low</span>
                    <span className="text-[#ff4d4d] font-bold text-sm">$0.35</span>
                  </div>
                  <div className="w-[1px] bg-[#00eeff]/10 h-7" />
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">High</span>
                    <span className="text-[#00ff88] font-bold text-sm">$0.48</span>
                  </div>
                </div>
              </div>
              <div className="flex-1 w-full h-[100px]">
                <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 40">
                  <defs>
                    <linearGradient id="chartGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#00eeff" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#00eeff" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,35 Q10,10 20,30 T40,15 T60,35 T80,5 T100,20 V40 H0 Z" fill="url(#chartGrad)" />
                  <path d="M0,35 Q10,10 20,30 T40,15 T60,35 T80,5 T100,20" fill="none" stroke="#00eeff" strokeLinecap="round" strokeWidth="0.5" />
                  <circle cx="20" cy="30" fill="#ff4d4d" r="0.8" />
                  <circle cx="80" cy="5" fill="#00ff88" r="0.8" />
                </svg>
                <div className="flex justify-between mt-1 px-1">
                  {["Mon", "Wed", "Fri", "Sun"].map((d) => (
                    <span key={d} className="text-[9px] font-bold text-slate-600 uppercase">{d}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { icon: "analytics", label: "Market Cap", value: "$12,504,820", change: "+5.2%", changeColor: "text-[#00ff88]", borderColor: "border-l-[#00eeff]/40", barColor: "bg-[#00eeff]", barBg: "bg-[#00eeff]/10", barWidth: "65%", iconBg: "text-[#00eeff]/60 bg-[#00eeff]/5" },
              { icon: "equalizer", label: "24h Volume", value: "$1,245,000", change: "-2.1%", changeColor: "text-[#ff4d4d]", borderColor: "border-l-[#ff4d4d]/40", barColor: "bg-[#ff4d4d]", barBg: "bg-[#ff4d4d]/10", barWidth: "42%", iconBg: "text-[#ff4d4d]/60 bg-[#ff4d4d]/5" },
              { icon: "groups", label: "Holders", value: "8,420", change: "+0.8%", changeColor: "text-[#00ff88]", borderColor: "border-l-[#00ff88]/40", barColor: "bg-[#00ff88]", barBg: "bg-[#00ff88]/10", barWidth: "88%", iconBg: "text-[#00ff88]/60 bg-[#00ff88]/5" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="p-3 rounded-xl border-l-4"
                style={{
                  background: "rgba(22, 27, 28, 0.7)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(0, 238, 255, 0.1)",
                  borderLeftWidth: "4px",
                  borderLeftColor: stat.label === "Market Cap" ? "rgba(0,238,255,0.4)" : stat.label === "24h Volume" ? "rgba(255,77,77,0.4)" : "rgba(0,255,136,0.4)",
                }}
              >
                <div className="flex justify-between items-start mb-3">
                  <span className={`material-symbols-outlined p-1.5 rounded-md text-base ${stat.iconBg}`}>{stat.icon}</span>
                  <span className={`text-[10px] font-bold ${stat.changeColor}`}>{stat.change}</span>
                </div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">{stat.label}</p>
                <h3 className="text-xl font-bold text-slate-100 tracking-tight">{stat.value}</h3>
                <div className={`mt-3 h-1 ${stat.barBg} rounded-full overflow-hidden`}>
                  <div className={`h-full ${stat.barColor}`} style={{ width: stat.barWidth }} />
                </div>
              </div>
            ))}
          </div>

          {/* Transactions + CTAs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Transactions Table */}
            <div
              className="lg:col-span-8 rounded-xl overflow-hidden"
              style={{
                background: "rgba(22, 27, 28, 0.7)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(0, 238, 255, 0.1)",
              }}
            >
              <div className="px-4 py-3 border-b border-[#00eeff]/10 flex justify-between items-center">
                <h4 className="font-bold text-slate-100 uppercase tracking-widest text-[10px]">Recent Transactions</h4>
                <button className="text-[#00eeff] text-[9px] font-bold uppercase hover:underline">View All</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#00eeff]/5 text-[9px] uppercase font-bold tracking-widest text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5">Transaction</th>
                      <th className="px-4 py-2.5">Type</th>
                      <th className="px-4 py-2.5">Amount</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Time</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {transactions.map((tx, i) => (
                      <tr
                        key={i}
                        className={`hover:bg-[#00eeff]/5 transition-colors ${i < transactions.length - 1 ? "border-b border-[#00eeff]/5" : ""}`}
                      >
                        <td className="px-4 py-3 text-slate-100 font-medium">{tx.name}</td>
                        <td className="px-4 py-3">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${tx.typeColor}`}>{tx.type}</span>
                        </td>
                        <td className={`px-4 py-3 font-bold ${tx.amountColor}`}>{tx.amount}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${tx.statusDot}`} />
                            <span className="text-slate-300">{tx.status}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{tx.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CTAs */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              {/* Recarregar com Pix */}
              <div
                className="p-[1px] rounded-xl"
                style={{
                  background: "#00eeff",
                  boxShadow: "0 0 10px rgba(0, 238, 255, 0.3)",
                }}
              >
                <div className="bg-[#0A0A0A] p-4 rounded-[11px] group cursor-pointer overflow-hidden relative">
                  <div className="absolute -right-3 -bottom-3 opacity-5 group-hover:opacity-20 transition-opacity">
                    <span className="material-symbols-outlined text-7xl">qr_code_2</span>
                  </div>
                  <div className="relative z-10">
                    <h4 className="text-base font-extrabold text-[#00eeff] tracking-tight mb-1">Recarregar com Pix</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                      Receba FBX instantaneamente em sua carteira com pagamentos via Pix.
                    </p>
                    <button className="w-full py-3 bg-[#00eeff] text-[#0A0A0A] font-extrabold rounded-lg uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all">
                      <span className="material-symbols-outlined text-base">bolt</span>
                      Gerar QR Code
                    </button>
                  </div>
                </div>
              </div>

              {/* Vender FBX */}
              <div
                className="p-4 rounded-xl group cursor-pointer transition-all hover:border-[#ff4d4d]/30"
                style={{
                  background: "rgba(22, 27, 28, 0.7)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(0, 238, 255, 0.1)",
                }}
              >
                <h4 className="text-base font-extrabold text-slate-100 tracking-tight mb-1">Vender FBX</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed mb-4">
                  Converta seus FBX para Real (BRL) e receba via Pix.
                </p>
                <button className="w-full py-3 bg-[#161b1c] border border-slate-700 text-slate-300 font-extrabold rounded-lg uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-[#ff4d4d]/10 hover:border-[#ff4d4d]/40 hover:text-[#ff4d4d] transition-all">
                  <span className="material-symbols-outlined text-base">account_balance</span>
                  Vender Tokens
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
