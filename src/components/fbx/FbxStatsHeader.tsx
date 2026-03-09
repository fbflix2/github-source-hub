interface Props {
  fbxBalance: number;
  brlBalance: number;
  onRecharge: () => void;
  onTransfer: () => void;
}

export function FbxStatsHeader({ fbxBalance, brlBalance, onRecharge, onTransfer }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
      {/* FBX / BRL */}
      <div
        className="rounded-lg p-2.5 flex flex-col justify-between"
        style={{
          background: "linear-gradient(135deg, rgba(0,238,255,0.08) 0%, rgba(188,19,254,0.08) 100%)",
          border: "1px solid rgba(255,255,255,0.05)",
          backgroundColor: "#111c1d",
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">FBX / BRL</span>
          <span className="bg-[#00ffaa]/20 text-[#00ffaa] px-2 py-0.5 rounded text-[10px] font-bold">FIXO</span>
        </div>
        <div className="flex items-baseline gap-2">
          <h3 className="text-xl font-black text-white">R$ 1,00</h3>
          <span className="text-slate-500 text-sm font-mono">1 FBX = 1 BRL</span>
        </div>
      </div>

      {/* Saldo FBX */}
      <div className="rounded-lg p-2.5" style={{ backgroundColor: "#111c1d", border: "1px solid rgba(255,255,255,0.05)" }}>
        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-1">Seu Saldo FBX</span>
        <h3 className="text-lg font-bold text-[#00eeff]">{fbxBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} FBX</h3>
        <div className="flex gap-1 mt-1">
          <button onClick={onRecharge} className="text-[10px] px-2 py-0.5 rounded bg-[#00ffaa]/20 text-[#00ffaa] font-bold hover:bg-[#00ffaa]/30 transition-colors">
            Recarregar
          </button>
          <button onClick={onTransfer} className="text-[10px] px-2 py-0.5 rounded bg-[#00eeff]/20 text-[#00eeff] font-bold hover:bg-[#00eeff]/30 transition-colors">
            Transferir
          </button>
        </div>
      </div>

      {/* Saldo BRL */}
      <div className="rounded-lg p-2.5" style={{ backgroundColor: "#111c1d", border: "1px solid rgba(255,255,255,0.05)" }}>
        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-1">Saldo BRL</span>
        <h3 className="text-lg font-bold text-white">R$ {brlBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</h3>
        <span className="text-slate-500 text-xs">Disponível para conversão</span>
      </div>

      {/* Info */}
      <div className="rounded-lg p-2.5" style={{ backgroundColor: "#111c1d", border: "1px solid rgba(255,255,255,0.05)" }}>
        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-1">Mercado P2P</span>
        <h3 className="text-lg font-bold text-white">Ativo</h3>
        <span className="text-[#00eeff] text-xs font-bold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ffaa] animate-pulse" />
          Operações em tempo real
        </span>
      </div>
    </div>
  );
}
