import { useFbxTransactions } from "@/hooks/useFbx";

const typeLabels: Record<string, string> = {
  recharge: "Recarga",
  transfer_in: "Recebido",
  transfer_out: "Enviado",
  p2p_buy: "Compra P2P",
  p2p_sell: "Venda P2P",
  purchase: "Compra",
  fee: "Taxa",
  refund: "Reembolso",
};

export function FbxRecentTrades() {
  const { data: transactions = [] } = useFbxTransactions();

  return (
    <div className="rounded-lg overflow-hidden flex flex-col" style={{ backgroundColor: "#111c1d", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div className="px-3 py-2 border-b border-white/5">
        <h4 className="text-sm font-bold text-white uppercase tracking-wider">Negociações Recentes</h4>
      </div>
      <div className="flex-1 overflow-y-auto max-h-[220px]">
        {transactions.length === 0 ? (
          <div className="text-center text-slate-500 py-6 text-xs">
            Nenhuma transação FBX ainda
          </div>
        ) : (
          <table className="w-full text-xs font-mono">
            <thead className="sticky top-0 text-[10px] text-slate-500 text-left uppercase" style={{ backgroundColor: "#111c1d" }}>
              <tr>
                <th className="px-3 py-1.5 font-bold">Tipo</th>
                <th className="px-3 py-1.5 font-bold text-right">Qtd</th>
                <th className="px-3 py-1.5 font-bold text-right">Hora</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t: any) => {
                const isPositive = Number(t.net_amount) > 0;
                const time = new Date(t.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                return (
                  <tr key={t.id} className="hover:bg-white/5 border-b border-white/5">
                    <td className={`px-3 py-1 ${isPositive ? "text-[#00ffaa]" : "text-[#ff0055]"}`}>
                      {typeLabels[t.type] || t.type}
                    </td>
                    <td className="px-3 py-1 text-right text-slate-300">
                      {isPositive ? "+" : ""}{Number(t.net_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-1 text-right text-slate-500">{time}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
