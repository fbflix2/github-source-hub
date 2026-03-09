import { useState } from "react";

interface Props {
  onCreateOrder: (type: "buy" | "sell", quantity: number, pixKey?: string) => void;
  fbxBalance: number;
  brlBalance?: number;
  settings: Record<string, string>;
}

export function FbxTrading({ onCreateOrder, fbxBalance, brlBalance = 0, settings }: Props) {
  const [tradeTab, setTradeTab] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [loading, setLoading] = useState(false);

  const feeRate = Number(settings.fbx_p2p_fee || "0.05");
  const qty = Number(quantity) || 0;
  const fee = Math.round(qty * feeRate * 100) / 100;
  const net = Math.round((qty - fee) * 100) / 100;

  const maxBalance = tradeTab === "buy" ? brlBalance : fbxBalance;

  const handleSubmit = async () => {
    if (qty <= 0) return;
    if (tradeTab === "sell" && !pixKey.trim()) return;
    setLoading(true);
    try {
      await onCreateOrder(tradeTab, qty, tradeTab === "sell" ? pixKey : undefined);
      setQuantity("");
      if (tradeTab === "sell") setPixKey("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg p-3 flex flex-col gap-2" style={{ backgroundColor: "#111c1d", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="flex border-b border-white/5">
        <button
          onClick={() => { setTradeTab("buy"); setQuantity(""); }}
          className={`flex-1 pb-2 text-sm font-bold transition-colors ${
            tradeTab === "buy" ? "text-[#00eeff] border-b-2 border-[#00eeff]" : "text-slate-500 hover:text-white"
          }`}
        >
          Comprar FBX
        </button>
        <button
          onClick={() => { setTradeTab("sell"); setQuantity(""); }}
          className={`flex-1 pb-2 text-sm font-bold transition-colors ${
            tradeTab === "sell" ? "text-[#ff0055] border-b-2 border-[#ff0055]" : "text-slate-500 hover:text-white"
          }`}
        >
          Vender FBX
        </button>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Preço Fixo</label>
          <div className="relative">
            <input className="w-full bg-white/5 border-none text-white rounded-lg text-sm focus:ring-1 focus:ring-[#00eeff] py-2 px-3 pr-12" type="text" value="1,00" disabled />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">BRL</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
            {tradeTab === "buy" ? "Valor em R$" : "Quantidade FBX"}
          </label>
          <div className="relative">
            <input
              className="w-full bg-white/5 border-none text-white rounded-lg text-sm focus:ring-1 focus:ring-[#00eeff] py-2 px-3 pr-12"
              type="number"
              placeholder="0,00"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">
              {tradeTab === "buy" ? "BRL" : "FBX"}
            </span>
          </div>
          <p className="text-[10px] text-slate-500">
            Saldo disponível: {tradeTab === "buy"
              ? `R$ ${brlBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
              : `${fbxBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} FBX`}
          </p>
        </div>

        {/* Pix key for sell orders */}
        {tradeTab === "sell" && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Chave Pix (para receber)</label>
            <input
              className="w-full bg-white/5 border-none text-white rounded-lg text-sm focus:ring-1 focus:ring-[#00eeff] py-2 px-3"
              type="text"
              placeholder="CPF, e-mail, telefone ou chave aleatória"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
            />
          </div>
        )}

        <div className="flex justify-between gap-1">
          {["25%", "50%", "75%", "100%"].map((pct) => {
            const val = Math.floor(maxBalance * parseInt(pct) / 100 * 100) / 100;
            return (
              <button
                key={pct}
                className="flex-1 py-1 text-[10px] bg-white/5 rounded hover:bg-white/10 text-slate-300 font-bold"
                onClick={() => setQuantity(String(val))}
              >
                {pct}
              </button>
            );
          })}
        </div>

        <div className="space-y-1 text-xs font-medium text-slate-400 mt-1">
          <div className="flex justify-between">
            <span>{tradeTab === "buy" ? "Valor" : "Quantidade"}</span>
            <span className="text-white">
              {tradeTab === "buy" ? `R$ ${qty.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : `${qty.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} FBX`}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Taxa ({(feeRate * 100).toFixed(0)}%){tradeTab === "sell" ? " do vendedor" : ""}</span>
            <span className="text-[#ff0055]">-{fee.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between border-t border-white/10 pt-1 font-bold">
            <span className="text-slate-300">Você recebe</span>
            <span className="text-[#00ffaa]">
              {tradeTab === "buy"
                ? `${net.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} FBX`
                : `R$ ${net.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            </span>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || qty <= 0 || qty > maxBalance || (tradeTab === "sell" && !pixKey.trim())}
          className={`w-full py-2 font-black rounded-lg transition-all text-sm disabled:opacity-50 ${
            tradeTab === "buy"
              ? "bg-[#00ffaa] text-[#080d0d] shadow-[0_0_20px_rgba(0,255,170,0.2)] hover:opacity-90"
              : "bg-[#ff0055] text-white shadow-[0_0_20px_rgba(255,0,85,0.2)] hover:opacity-90"
          }`}
        >
          {loading
            ? "Processando..."
            : tradeTab === "buy"
              ? `COMPRAR ${net > 0 ? net.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "0"} FBX`
              : `VENDER ${qty > 0 ? qty.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "0"} FBX`}
        </button>

        <p className="text-[10px] text-slate-600 text-center">
          {tradeTab === "buy"
            ? "Conversão instantânea · 1 FBX = R$ 1,00"
            : "Ordem P2P · Escrow automático · 1 FBX = R$ 1,00"}
        </p>
      </div>
    </div>
  );
}
