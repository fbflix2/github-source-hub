interface Order {
  id: string;
  type: string;
  quantity: number;
  status: string;
  user_id: string;
  pix_key?: string;
}

interface Props {
  sellOrders: Order[];
  buyOrders: Order[];
  onMatch: (orderId: string) => void;
}

export function FbxOrderBook({ sellOrders, buyOrders, onMatch }: Props) {
  return (
    <div className="rounded-lg overflow-hidden flex flex-col" style={{ backgroundColor: "#111c1d", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="px-3 py-2 border-b border-white/5 flex justify-between items-center">
        <h4 className="text-sm font-bold text-white uppercase tracking-wider">Livro de Ofertas</h4>
        <span className="text-[10px] text-slate-500 font-mono">{sellOrders.length + buyOrders.length} ordens</span>
      </div>
      <div className="flex-1 p-2.5 flex flex-col gap-0.5 text-xs font-mono overflow-y-auto max-h-[220px]">
        {/* Sell orders (asks) */}
        {sellOrders.length === 0 && buyOrders.length === 0 && (
          <div className="text-center text-slate-500 py-4 text-xs">
            Nenhuma ordem aberta.<br />Crie a primeira ordem!
          </div>
        )}
        {sellOrders.map((order) => (
          <div key={order.id} className="flex justify-between relative py-1 hover:bg-white/5 cursor-pointer group" onClick={() => onMatch(order.id)}>
            <div className="absolute right-0 inset-y-0 bg-[#ff0055]/10" style={{ width: `${Math.min(100, order.quantity)}%` }} />
            <span className="text-[#ff0055] relative z-10">R$ 1,00</span>
            <span className="text-slate-300 relative z-10">{Number(order.quantity).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            <span className="text-slate-500 relative z-10 group-hover:text-[#00ffaa] transition-colors">
              Aceitar
            </span>
          </div>
        ))}

        {/* Spread */}
        <div className="my-1 py-1 border-y border-white/5 flex justify-center gap-4 text-xs font-bold">
          <span className="text-white">R$ 1,00</span>
          <span className="text-slate-500 text-[10px]">Preço Fixo</span>
        </div>

        {/* Buy orders (bids) */}
        {buyOrders.map((order) => (
          <div key={order.id} className="flex justify-between relative py-1 hover:bg-white/5 cursor-pointer group" onClick={() => onMatch(order.id)}>
            <div className="absolute right-0 inset-y-0 bg-[#00ffaa]/10" style={{ width: `${Math.min(100, order.quantity)}%` }} />
            <span className="text-[#00ffaa] relative z-10">R$ 1,00</span>
            <span className="text-slate-300 relative z-10">{Number(order.quantity).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            <span className="text-slate-500 relative z-10 group-hover:text-[#00eeff] transition-colors">
              Aceitar
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
