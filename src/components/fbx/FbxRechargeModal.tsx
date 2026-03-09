import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useFbxActions } from "@/hooks/useFbx";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  brlBalance: number;
  feeRate: number;
}

export function FbxRechargeModal({ open, onOpenChange, brlBalance, feeRate }: Props) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const actions = useFbxActions();

  const val = Number(amount) || 0;
  const fee = Math.round(val * feeRate * 100) / 100;
  const net = Math.round((val - fee) * 100) / 100;

  const handleRecharge = async () => {
    if (val <= 0) return;
    setLoading(true);
    try {
      const res = await actions.recharge(val);
      toast({ title: "Recarga concluída!", description: `Você recebeu ${res.fbx_received} FBX` });
      setAmount("");
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111c1d] border-white/10 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-[#00eeff]">Recarregar FBX</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-xs text-slate-400">
            Converta seu saldo BRL em FBX. Taxa de conversão: <span className="text-[#00eeff] font-bold">{(feeRate * 100).toFixed(0)}%</span>
          </p>
          <div>
            <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest block mb-1">Valor em R$</label>
            <input
              className="w-full bg-white/5 border border-white/10 text-white rounded-lg text-sm focus:ring-1 focus:ring-[#00eeff] py-2 px-3"
              type="number"
              placeholder="100,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-[10px] text-slate-500 mt-1">Saldo disponível: R$ {brlBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </div>

          <div className="bg-white/5 rounded-lg p-3 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Valor</span>
              <span className="text-white">R$ {val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Taxa ({(feeRate * 100).toFixed(0)}%)</span>
              <span className="text-[#ff0055]">-R$ {fee.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-1 font-bold">
              <span className="text-slate-300">Você recebe</span>
              <span className="text-[#00ffaa]">{net.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} FBX</span>
            </div>
          </div>

          <button
            onClick={handleRecharge}
            disabled={loading || val <= 0 || val > brlBalance}
            className="w-full py-2.5 font-black rounded-lg bg-[#00ffaa] text-[#080d0d] hover:opacity-90 transition-all disabled:opacity-50 text-sm"
          >
            {loading ? "Processando..." : `RECARREGAR ${net > 0 ? net.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "0"} FBX`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
