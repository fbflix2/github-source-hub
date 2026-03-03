import { useState } from "react";

const timeframes = ["1H", "4H", "1D", "1S", "ALL"];

const orderBookSells = [
  { price: "4,215", qty: "1.250", total: "5.268,7" },
  { price: "4,212", qty: "4.102", total: "17.277,6" },
  { price: "4,209", qty: "0.511", total: "2.150,8" },
];

const orderBookBuys = [
  { price: "4,205", qty: "3.882", total: "16.323,8" },
  { price: "4,202", qty: "1.100", total: "4.622,2" },
  { price: "4,198", qty: "12.550", total: "52.684,9" },
];

const recentTrades = [
  { price: "4,208", size: "125,0", time: "14:24:12", green: true },
  { price: "4,205", size: "45,2", time: "14:23:58", green: false },
  { price: "4,207", size: "1.240,5", time: "14:23:45", green: true },
  { price: "4,210", size: "300,0", time: "14:23:22", green: true },
  { price: "4,202", size: "12,5", time: "14:23:10", green: false },
  { price: "4,200", size: "890,1", time: "14:22:55", green: false },
];

export default function TokenFBX() {
  const [activeTimeframe, setActiveTimeframe] = useState("1H");
  const [tradeTab, setTradeTab] = useState<"buy" | "sell">("buy");

  return (
    <div className="flex flex-col gap-4 -mt-2">
      {/* Stats Header */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* FBX / BRL */}
        <div
          className="rounded-xl p-4 flex flex-col justify-between"
          style={{
            background: "linear-gradient(135deg, rgba(0,238,255,0.08) 0%, rgba(188,19,254,0.08) 100%)",
            border: "1px solid rgba(255,255,255,0.05)",
            backgroundColor: "#111c1d",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">FBX / BRL</span>
            <span className="bg-[#00ffaa]/20 text-[#00ffaa] px-2 py-0.5 rounded text-[10px] font-bold">+15,42%</span>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-black text-white">R$ 4,2069</h3>
            <span className="text-slate-500 text-sm font-mono">≈ 0,00012 BTC</span>
          </div>
        </div>

        {/* 24h Alta / Baixa */}
        <div className="rounded-xl p-4" style={{ backgroundColor: "#111c1d", border: "1px solid rgba(255,255,255,0.05)" }}>
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-2">Alta / Baixa 24h</span>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-sm">
              <span className="text-[#00ffaa] font-mono">R$ 4,85</span>
              <span className="text-[#ff0055] font-mono">R$ 3,12</span>
            </div>
            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div className="bg-[#00eeff] h-full rounded-full" style={{ width: "72%" }} />
            </div>
          </div>
        </div>

        {/* Volume 24h */}
        <div className="rounded-xl p-4" style={{ backgroundColor: "#111c1d", border: "1px solid rgba(255,255,255,0.05)" }}>
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-2">Volume 24h</span>
          <h3 className="text-xl font-bold text-white">R$ 12.450.890</h3>
          <span className="text-slate-500 text-xs">2.964.120 FBX</span>
        </div>

        {/* Cap. de Mercado */}
        <div className="rounded-xl p-4" style={{ backgroundColor: "#111c1d", border: "1px solid rgba(255,255,255,0.05)" }}>
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-2">Cap. de Mercado</span>
          <h3 className="text-xl font-bold text-white">R$ 500.240.000</h3>
          <span className="text-[#00eeff] text-xs font-bold">Rank #142</span>
        </div>
      </div>

      {/* Chart Area */}
      <div className="rounded-xl overflow-hidden flex flex-col" style={{ backgroundColor: "#111c1d", border: "1px solid rgba(255,255,255,0.05)" }}>
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5" style={{ backgroundColor: "rgba(8,13,13,0.5)" }}>
          <div className="flex items-center gap-2">
            <div className="flex bg-white/5 rounded-lg p-1">
              {timeframes.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setActiveTimeframe(tf)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                    activeTimeframe === tf
                      ? "text-[#00eeff] bg-[#00eeff]/20"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
            <div className="h-6 w-px bg-white/10 mx-2" />
            <button className="p-1.5 rounded hover:bg-white/5 text-[#00eeff]">
              <span className="material-symbols-outlined text-xl">candlestick_chart</span>
            </button>
            <button className="p-1.5 rounded hover:bg-white/5 text-slate-400">
              <span className="material-symbols-outlined text-xl">show_chart</span>
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#00ffaa]" /> MA(7): 4,12</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#bc13fe]" /> MA(25): 3,85</span>
            </div>
            <button className="p-1.5 rounded hover:bg-white/5 text-slate-400">
              <span className="material-symbols-outlined text-xl">settings</span>
            </button>
            <button className="p-1.5 rounded hover:bg-white/5 text-slate-400">
              <span className="material-symbols-outlined text-xl">fullscreen</span>
            </button>
          </div>
        </div>

        {/* Chart */}
        <div
          className="relative overflow-hidden"
          style={{
            height: "320px",
            backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        >
          <svg className="w-full h-full absolute inset-0 opacity-80" preserveAspectRatio="none" viewBox="0 0 1000 320">
            <defs>
              <linearGradient id="chartGrad2" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#00eeff" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#00eeff" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Candles */}
            {/* Green cluster left */}
            <line stroke="#00ffaa" strokeWidth="1.5" x1="106" x2="106" y1="200" y2="280" />
            <rect fill="#00ffaa" height="50" rx="2" width="14" x="100" y="210" />
            <line stroke="#00ffaa" strokeWidth="1.5" x1="126" x2="126" y1="170" y2="270" />
            <rect fill="#00ffaa" height="70" rx="2" width="14" x="120" y="180" />
            <line stroke="#00ffaa" strokeWidth="1.5" x1="146" x2="146" y1="130" y2="260" />
            <rect fill="#00ffaa" height="90" rx="2" width="14" x="140" y="145" />

            {/* Red dip */}
            <line stroke="#ff0055" strokeWidth="1.5" x1="226" x2="226" y1="140" y2="290" />
            <rect fill="#ff0055" height="80" rx="2" width="14" x="220" y="160" />
            <line stroke="#ff0055" strokeWidth="1.5" x1="246" x2="246" y1="170" y2="300" />
            <rect fill="#ff0055" height="90" rx="2" width="14" x="240" y="190" />

            {/* Recovery */}
            <line stroke="#00ffaa" strokeWidth="1.5" x1="346" x2="346" y1="160" y2="280" />
            <rect fill="#00ffaa" height="60" rx="2" width="14" x="340" y="180" />
            <line stroke="#00ffaa" strokeWidth="1.5" x1="366" x2="366" y1="140" y2="260" />
            <rect fill="#00ffaa" height="70" rx="2" width="14" x="360" y="155" />
            <line stroke="#00ffaa" strokeWidth="1.5" x1="386" x2="386" y1="120" y2="240" />
            <rect fill="#00ffaa" height="80" rx="2" width="14" x="380" y="130" />

            {/* Consolidation */}
            <line stroke="#ff0055" strokeWidth="1.5" x1="466" x2="466" y1="110" y2="200" />
            <rect fill="#ff0055" height="40" rx="2" width="14" x="460" y="130" />
            <line stroke="#00ffaa" strokeWidth="1.5" x1="486" x2="486" y1="100" y2="190" />
            <rect fill="#00ffaa" height="50" rx="2" width="14" x="480" y="115" />

            {/* Bull run right */}
            <line stroke="#00ffaa" strokeWidth="1.5" x1="566" x2="566" y1="90" y2="200" />
            <rect fill="#00ffaa" height="60" rx="2" width="14" x="560" y="105" />
            <line stroke="#00ffaa" strokeWidth="1.5" x1="586" x2="586" y1="70" y2="170" />
            <rect fill="#00ffaa" height="70" rx="2" width="14" x="580" y="80" />
            <line stroke="#00ffaa" strokeWidth="1.5" x1="606" x2="606" y1="50" y2="150" />
            <rect fill="#00ffaa" height="80" rx="2" width="14" x="600" y="55" />
            <line stroke="#00ffaa" strokeWidth="1.5" x1="626" x2="626" y1="40" y2="130" />
            <rect fill="#00ffaa" height="65" rx="2" width="14" x="620" y="45" />

            {/* Small red correction */}
            <line stroke="#ff0055" strokeWidth="1.5" x1="706" x2="706" y1="50" y2="120" />
            <rect fill="#ff0055" height="35" rx="2" width="14" x="700" y="65" />

            {/* Final candles */}
            <line stroke="#00ffaa" strokeWidth="1.5" x1="766" x2="766" y1="45" y2="110" />
            <rect fill="#00ffaa" height="40" rx="2" width="14" x="760" y="50" />
            <line stroke="#00ffaa" strokeWidth="1.5" x1="786" x2="786" y1="35" y2="100" />
            <rect fill="#00ffaa" height="45" rx="2" width="14" x="780" y="38" />

            {/* MA Lines */}
            <path d="M60,260 Q200,200 350,160 T600,60 T900,35" fill="none" stroke="#00eeff" strokeWidth="1.5" opacity="0.5" />
            <path d="M60,280 Q250,240 450,180 T750,80 T900,60" fill="none" stroke="#bc13fe" strokeWidth="1.5" opacity="0.5" />

            {/* Area fill */}
            <path d="M60,260 Q200,200 350,160 T600,60 T900,35 V320 H60 Z" fill="url(#chartGrad2)" />
          </svg>

          {/* Y-Axis */}
          <div className="absolute right-0 inset-y-0 w-16 bg-[#080d0d]/80 border-l border-white/5 flex flex-col justify-between py-6 text-[10px] text-slate-500 font-mono text-right pr-2">
            <span>R$5,00</span>
            <span>R$4,75</span>
            <span>R$4,50</span>
            <span className="text-[#00eeff] font-bold bg-[#00eeff]/10 py-1 rounded">R$4,20</span>
            <span>R$4,00</span>
            <span>R$3,75</span>
            <span>R$3,50</span>
            <span>R$3,00</span>
          </div>

          {/* X-Axis */}
          <div className="absolute bottom-0 inset-x-0 h-7 bg-[#080d0d]/80 border-t border-white/5 flex items-center justify-between px-8 text-[10px] text-slate-500 font-mono">
            <span>12:00</span><span>13:00</span><span>14:00</span><span>15:00</span><span>16:00</span><span>17:00</span><span>18:00</span><span>19:00</span>
          </div>
        </div>

        {/* Chart Footer */}
        <div className="px-4 py-2 border-t border-white/5 flex justify-between items-center text-[10px] uppercase font-bold tracking-widest text-slate-600" style={{ backgroundColor: "#080d0d" }}>
          <div className="flex gap-4">
            <span>RSI(14): <span className="text-[#00ffaa]">64,2</span></span>
            <span>MACD(12,26,9): <span className="text-[#00eeff]">0,024</span></span>
          </div>
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ffaa] animate-pulse" />
              Mercado Ao Vivo
            </span>
            <span className="hidden sm:inline">Hora do Servidor: 14:24:55</span>
          </div>
        </div>
      </div>

      {/* Bottom Panels: Order Book + Trading + Recent Trades */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Order Book */}
        <div className="rounded-xl overflow-hidden flex flex-col" style={{ backgroundColor: "#111c1d", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Livro de Ofertas</h4>
            <div className="flex gap-1">
              <span className="material-symbols-outlined text-[#ff0055] text-lg cursor-pointer">menu_open</span>
              <span className="material-symbols-outlined text-[#00ffaa] text-lg cursor-pointer">menu_open</span>
            </div>
          </div>
          <div className="flex-1 p-4 flex flex-col gap-1 text-xs font-mono">
            {/* Sells */}
            {orderBookSells.map((row, i) => (
              <div key={i} className="flex justify-between relative py-0.5 hover:bg-white/5">
                <div className="absolute right-0 inset-y-0 bg-[#ff0055]/10" style={{ width: `${[45, 78, 12][i]}%` }} />
                <span className="text-[#ff0055] relative z-10">{row.price}</span>
                <span className="text-slate-300 relative z-10">{row.qty}</span>
                <span className="text-slate-500 relative z-10">{row.total}</span>
              </div>
            ))}
            {/* Spread */}
            <div className="my-2 py-1 border-y border-white/5 flex justify-center gap-4 text-sm font-bold">
              <span className="text-white">R$ 4,207</span>
              <span className="text-slate-500 text-[10px]">Spread: 0,002 (0,05%)</span>
            </div>
            {/* Buys */}
            {orderBookBuys.map((row, i) => (
              <div key={i} className="flex justify-between relative py-0.5 hover:bg-white/5">
                <div className="absolute right-0 inset-y-0 bg-[#00ffaa]/10" style={{ width: `${[62, 24, 95][i]}%` }} />
                <span className="text-[#00ffaa] relative z-10">{row.price}</span>
                <span className="text-slate-300 relative z-10">{row.qty}</span>
                <span className="text-slate-500 relative z-10">{row.total}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Trading Terminal */}
        <div className="rounded-xl p-4 flex flex-col gap-4" style={{ backgroundColor: "#111c1d", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex border-b border-white/5">
            <button
              onClick={() => setTradeTab("buy")}
              className={`flex-1 pb-2 text-sm font-bold transition-colors ${
                tradeTab === "buy" ? "text-[#00eeff] border-b-2 border-[#00eeff]" : "text-slate-500 hover:text-white"
              }`}
            >
              Comprar
            </button>
            <button
              onClick={() => setTradeTab("sell")}
              className={`flex-1 pb-2 text-sm font-bold transition-colors ${
                tradeTab === "sell" ? "text-[#ff0055] border-b-2 border-[#ff0055]" : "text-slate-500 hover:text-white"
              }`}
            >
              Vender
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Tipo</label>
              <select className="bg-white/5 border-none text-white rounded-lg text-sm focus:ring-1 focus:ring-[#00eeff] py-2 px-3">
                <option>Ordem Limitada</option>
                <option>Ordem a Mercado</option>
                <option>Stop Limit</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Preço</label>
              <div className="relative">
                <input
                  className="w-full bg-white/5 border-none text-white rounded-lg text-sm focus:ring-1 focus:ring-[#00eeff] py-2 px-3 pr-12"
                  type="number"
                  defaultValue="4.2069"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">BRL</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Quantidade</label>
              <div className="relative">
                <input
                  className="w-full bg-white/5 border-none text-white rounded-lg text-sm focus:ring-1 focus:ring-[#00eeff] py-2 px-3 pr-12"
                  type="number"
                  placeholder="0,00"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">FBX</span>
              </div>
            </div>
            <div className="flex justify-between gap-1">
              {["25%", "50%", "75%", "100%"].map((pct) => (
                <button key={pct} className="flex-1 py-1 text-[10px] bg-white/5 rounded hover:bg-white/10 text-slate-300 font-bold">
                  {pct}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs font-medium text-slate-400 mt-1">
              <span>Total</span>
              <span className="text-white">R$ 0,00</span>
            </div>
            <button
              className={`w-full py-3 font-black rounded-lg transition-all mt-1 ${
                tradeTab === "buy"
                  ? "bg-[#00ffaa] text-[#080d0d] shadow-[0_0_20px_rgba(0,255,170,0.2)] hover:opacity-90"
                  : "bg-[#ff0055] text-white shadow-[0_0_20px_rgba(255,0,85,0.2)] hover:opacity-90"
              }`}
            >
              {tradeTab === "buy" ? "COMPRAR FBX" : "VENDER FBX"}
            </button>
          </div>
        </div>

        {/* Recent Trades */}
        <div className="rounded-xl overflow-hidden flex flex-col" style={{ backgroundColor: "#111c1d", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="px-4 py-3 border-b border-white/5">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Negociações Recentes</h4>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[300px]">
            <table className="w-full text-xs font-mono">
              <thead className="sticky top-0 text-[10px] text-slate-500 text-left uppercase" style={{ backgroundColor: "#111c1d" }}>
                <tr>
                  <th className="px-4 py-2 font-bold">Preço</th>
                  <th className="px-4 py-2 font-bold text-right">Qtd</th>
                  <th className="px-4 py-2 font-bold text-right">Hora</th>
                </tr>
              </thead>
              <tbody>
                {recentTrades.map((t, i) => (
                  <tr key={i} className="hover:bg-white/5 border-b border-white/5">
                    <td className={`px-4 py-1.5 ${t.green ? "text-[#00ffaa]" : "text-[#ff0055]"}`}>{t.price}</td>
                    <td className="px-4 py-1.5 text-right text-slate-300">{t.size}</td>
                    <td className="px-4 py-1.5 text-right text-slate-500">{t.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
