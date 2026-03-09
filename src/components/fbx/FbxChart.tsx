import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, ComposedChart } from "recharts";

const timeframes = ["1H", "4H", "1D", "1S", "ALL"];

function generateChartData(points: number) {
  const now = new Date();
  const data = [];
  let price = 1.0;

  for (let i = points; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 3 * 60000);
    const volatility = (Math.random() - 0.48) * 0.02;
    price = Math.max(0.96, Math.min(1.04, price + volatility));
    const volume = Math.floor(Math.random() * 500 + 50);
    const open = price;
    const close = price + (Math.random() - 0.48) * 0.015;
    const high = Math.max(open, close) + Math.random() * 0.008;
    const low = Math.min(open, close) - Math.random() * 0.008;

    data.push({
      time: time.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      price: Number(close.toFixed(4)),
      open: Number(open.toFixed(4)),
      close: Number(close.toFixed(4)),
      high: Number(high.toFixed(4)),
      low: Number(low.toFixed(4)),
      volume,
      green: close >= open,
    });
  }
  return data;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="rounded-lg p-2.5 text-xs font-mono border" style={{ backgroundColor: "#0d1517", borderColor: "rgba(0,238,255,0.2)" }}>
      <p className="text-slate-400 mb-1">{label}</p>
      <div className="space-y-0.5">
        <p className="text-white">Preço: <span className="text-[#00eeff] font-bold">R$ {d?.price?.toFixed(4)}</span></p>
        <p className="text-slate-400">Alta: <span className="text-[#00ffaa]">{d?.high?.toFixed(4)}</span></p>
        <p className="text-slate-400">Baixa: <span className="text-[#ff0055]">{d?.low?.toFixed(4)}</span></p>
        <p className="text-slate-400">Vol: <span className="text-white">{d?.volume} FBX</span></p>
      </div>
    </div>
  );
};

export function FbxChart() {
  const [activeTimeframe, setActiveTimeframe] = useState("1H");

  const pointsMap: Record<string, number> = { "1H": 20, "4H": 40, "1D": 60, "1S": 80, ALL: 100 };
  const data = useMemo(() => generateChartData(pointsMap[activeTimeframe] || 20), [activeTimeframe]);

  const minPrice = Math.min(...data.map((d) => d.low)) - 0.005;
  const maxPrice = Math.max(...data.map((d) => d.high)) + 0.005;

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
        <div className="hidden sm:flex items-center gap-3 text-xs font-medium text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#00ffaa]" /> Preço fixo R$1,00
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ffaa] animate-pulse" />
            Ao Vivo
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Price chart */}
        <div className="flex-1 min-h-0 px-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 50, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00eeff" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#00eeff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="time"
                tick={{ fill: "#475569", fontSize: 10, fontFamily: "monospace" }}
                axisLine={{ stroke: "rgba(255,255,255,0.05)" }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[minPrice, maxPrice]}
                tick={{ fill: "#475569", fontSize: 10, fontFamily: "monospace" }}
                axisLine={{ stroke: "rgba(255,255,255,0.05)" }}
                tickLine={false}
                orientation="right"
                tickFormatter={(v) => `R$${v.toFixed(2)}`}
                width={55}
              />
              <Tooltip content={<CustomTooltip />} />

              {/* R$1.00 reference line */}
              <Area
                type="monotone"
                dataKey="price"
                stroke="#00eeff"
                strokeWidth={2}
                fill="url(#areaGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#00eeff", stroke: "#080d0d", strokeWidth: 2 }}
              />

              {/* Candle bodies as bars */}
              {data.map((entry, i) => (
                <g key={i} />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Volume bar */}
        <div className="h-16 px-1 border-t border-white/5">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 50, left: 0, bottom: 0 }}>
              <XAxis dataKey="time" hide />
              <YAxis hide />
              <Bar
                dataKey="volume"
                fill="#00eeff"
                opacity={0.3}
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-white/5 flex justify-between items-center text-[10px] uppercase font-bold tracking-widest text-slate-600" style={{ backgroundColor: "#080d0d" }}>
        <div className="flex gap-4">
          <span>Preço Base: <span className="text-[#00eeff]">R$ 1,00</span></span>
          <span>Variação: <span className="text-[#00ffaa]">±0,04%</span></span>
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
