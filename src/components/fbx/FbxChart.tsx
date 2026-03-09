import { useState } from "react";

const timeframes = ["1H", "4H", "1D", "1S", "ALL"];

export function FbxChart() {
  const [activeTimeframe, setActiveTimeframe] = useState("1H");

  return (
    <div className="rounded-lg overflow-hidden flex flex-col flex-1 min-h-0" style={{ backgroundColor: "#111c1d", border: "1px solid rgba(255,255,255,0.05)" }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5" style={{ backgroundColor: "rgba(8,13,13,0.5)" }}>
        <div className="flex items-center gap-2">
          <div className="flex bg-white/5 rounded-lg p-1">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => setActiveTimeframe(tf)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                  activeTimeframe === tf ? "text-[#00eeff] bg-[#00eeff]/20" : "text-slate-400 hover:text-white"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#00ffaa]" /> Preço fixo R$1,00</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#bc13fe]" /> Demanda simulada</span>
        </div>
      </div>

      {/* Chart */}
      <div
        className="relative overflow-hidden flex-1 min-h-0"
        style={{
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
          {/* Simulated candles around R$1.00 line */}
          {Array.from({ length: 30 }).map((_, i) => {
            const x = 60 + i * 30;
            const baseY = 160;
            const rand = Math.sin(i * 0.7 + Date.now() / 100000) * 15;
            const h = 20 + Math.abs(rand);
            const green = rand > -3;
            return (
              <g key={i}>
                <line stroke={green ? "#00ffaa" : "#ff0055"} strokeWidth="1.5" x1={x} x2={x} y1={baseY - h / 2 - 5} y2={baseY + h / 2 + 5} />
                <rect fill={green ? "#00ffaa" : "#ff0055"} height={h} rx="2" width="10" x={x - 5} y={baseY - h / 2} />
              </g>
            );
          })}
          {/* R$1.00 line */}
          <line stroke="#00eeff" strokeWidth="1" strokeDasharray="5,5" x1="0" x2="1000" y1="160" y2="160" opacity="0.5" />
          <text fill="#00eeff" x="920" y="155" fontSize="11" fontWeight="bold" opacity="0.7">R$1,00</text>
          {/* Area fill */}
          <path d="M60,160 Q200,150 400,165 T700,155 T900,160 V320 H60 Z" fill="url(#chartGrad2)" />
        </svg>

        {/* Y-Axis */}
        <div className="absolute right-0 inset-y-0 w-16 bg-[#080d0d]/80 border-l border-white/5 flex flex-col justify-between py-6 text-[10px] text-slate-500 font-mono text-right pr-2">
          <span>R$1,10</span>
          <span>R$1,05</span>
          <span className="text-[#00eeff] font-bold bg-[#00eeff]/10 py-1 rounded">R$1,00</span>
          <span>R$0,95</span>
          <span>R$0,90</span>
        </div>

        {/* X-Axis */}
        <div className="absolute bottom-0 inset-x-0 h-7 bg-[#080d0d]/80 border-t border-white/5 flex items-center justify-between px-8 text-[10px] text-slate-500 font-mono">
          <span>12:00</span><span>13:00</span><span>14:00</span><span>15:00</span><span>16:00</span><span>17:00</span><span>18:00</span><span>19:00</span>
        </div>
      </div>

      {/* Chart Footer */}
      <div className="px-3 py-1.5 border-t border-white/5 flex justify-between items-center text-[10px] uppercase font-bold tracking-widest text-slate-600" style={{ backgroundColor: "#080d0d" }}>
        <div className="flex gap-4">
          <span>RSI(14): <span className="text-[#00ffaa]">50,0</span></span>
          <span>MACD(12,26,9): <span className="text-[#00eeff]">0,001</span></span>
        </div>
        <div className="flex gap-4">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ffaa] animate-pulse" />
            Mercado P2P Ativo
          </span>
        </div>
      </div>
    </div>
  );
}
