import { useState } from "react";

interface Props {
  onCreateOrder: (type: "buy" | "sell", quantity: number, pixKey?: string) => void;
  fbxBalance: number;
  settings: Record<string, string>;
}

export function FbxTrading({ onCreateOrder, fbxBalance, settings }: Props) {
  const [tradeTab, setTradeTab] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [loading, setLoading] = useState(false);

  const feeRate = Number(settings.fbx_p2p_fee || "0.06");
  const qty = Number(quantity) || 0;
  const fee = Math.round(qty * feeRate * 100) / 100;
  const total = Math.round((qty + (tradeTab === "buy" ? 0 : 0)) * 100) / 100;

  const handleSubmit = async () => {
    if (qty <= 0) return;
    setLoading(true);
    try {
      await onCreateOrder(tradeTab, qty, tradeTab === "sell" ? pixKey : undefined);
      setQuantity("");
      setPixKey("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg p-3 flex flex-col gap-2" style={{ backgroundColor: "#111c1d", border: "1px solid rgba(255,255,255,0.05)" }}>
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
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Preço</label>
          <div className="relative">
            <input className="w-full bg-white/5 border-none text-white rounded-lg text-sm focus:ring-1 focus:ring-[#00eeff] py-2 px-3 pr-12" type="text" value="1,00" disabled />
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
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">FBX</span>
          </div>
        </div>

        {tradeTab === "sell" && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Sua Chave Pix</label>
            <input
              className="w-full bg-white/5 border-none text-white rounded-lg text-sm focus:ring-1 focus:ring-[#00eeff] py-2 px-3"
              type="text"
              placeholder="CPF, e-mail ou telefone"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
            />
          </div>
        )}

        <div className="flex justify-between gap-1">
          {["25%", "50%", "75%", "100%"].map((pct) => {
            const val = tradeTab === "sell" ? Math.floor(fbxBalance * parseInt(pct) / 100) : 0;
            return (
              <button
                key={pct}
                className="flex-1 py-1 text-[10px] bg-white/5 rounded hover:bg-white/10 text-slate-300 font-bold"
                onClick={() => tradeTab === "sell" && setQuantity(String(val))}
              >
                {pct}
              </button>
            );
          })}
        </div>

        <div className="space-y-1 text-xs font-medium text-slate-400 mt-1">
          <div className="flex justify-between">
            <span>Total BRL</span>
            <span className="text-white">R$ {qty.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between">
            <span>Taxa P2P ({(feeRate * 100).toFixed(0)}%)</span>
            <span className="text-[#ff0055]">-{fee.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} FBX</span>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || qty <= 0 || (tradeTab === "sell" && !pixKey)}
          className={`w-full py-2 font-black rounded-lg transition-all text-sm disabled:opacity-50 ${
            tradeTab === "buy"
              ? "bg-[#00ffaa] text-[#080d0d] shadow-[0_0_20px_rgba(0,255,170,0.2)] hover:opacity-90"
              : "bg-[#ff0055] text-white shadow-[0_0_20px_rgba(255,0,85,0.2)] hover:opacity-90"
          }`}
        >
          {loading ? "Processando..." : tradeTab === "buy" ? "COMPRAR FBX" : "VENDER FBX"}
        </button>

        {tradeTab === "sell" && (
          <p className="text-[10px] text-slate-600 text-center">
            Seus FBX ficarão em escrow até o comprador confirmar o Pix
          </p>
        )}
      </div>
    </div>
  );
}
