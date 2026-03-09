import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useFbxActions } from "@/hooks/useFbx";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fbxBalance: number;
}

export function FbxTransferModal({ open, onOpenChange, fbxBalance }: Props) {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const actions = useFbxActions();

  const val = Number(amount) || 0;

  const handleTransfer = async () => {
    if (val <= 0 || !email) return;
    setLoading(true);
    try {
      await actions.transfer(email, val);
      toast({ title: "Transferência concluída!", description: `${val} FBX enviados para ${email}` });
      setEmail("");
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
          <DialogTitle className="text-[#00eeff]">Transferir FBX</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-xs text-slate-400">
            Envie FBX para outro usuário da plataforma gratuitamente.
          </p>
          <div>
            <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest block mb-1">E-mail do destinatário</label>
            <input
              className="w-full bg-white/5 border border-white/10 text-white rounded-lg text-sm focus:ring-1 focus:ring-[#00eeff] py-2 px-3"
              type="email"
              placeholder="usuario@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest block mb-1">Quantidade FBX</label>
            <input
              className="w-full bg-white/5 border border-white/10 text-white rounded-lg text-sm focus:ring-1 focus:ring-[#00eeff] py-2 px-3"
              type="number"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-[10px] text-slate-500 mt-1">Saldo: {fbxBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} FBX</p>
          </div>

          <button
            onClick={handleTransfer}
            disabled={loading || val <= 0 || val > fbxBalance || !email}
            className="w-full py-2.5 font-black rounded-lg bg-[#00eeff] text-[#080d0d] hover:opacity-90 transition-all disabled:opacity-50 text-sm"
          >
            {loading ? "Processando..." : `ENVIAR ${val > 0 ? val.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "0"} FBX`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
