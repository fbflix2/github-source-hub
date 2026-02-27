import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2, Copy, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NewClientModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function NewClientModal({ open, onClose, onCreated }: NewClientModalProps) {
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    phone: "",
    cpf: "",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setForm({ email: "", full_name: "", phone: "", cpf: "" });
    setResult(null);
    setCopied(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!form.email.trim()) {
      toast.error("Email é obrigatório.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-clients", {
        body: {
          clients: [
            {
              email: form.email.trim(),
              full_name: form.full_name.trim() || undefined,
              phone: form.phone.trim() || undefined,
              cpf: form.cpf.trim() || undefined,
            },
          ],
        },
      });

      if (error) throw new Error(error.message);

      if (data.failed > 0) {
        toast.error(data.errors?.[0] || "Erro ao criar cliente.");
      } else {
        const cred = data.credentials?.[0];
        if (cred) {
          setResult({ email: cred.email, password: cred.password });
        }
        toast.success("Cliente criado com sucesso!");
        onCreated();
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar cliente.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(`Email: ${result.email}\nSenha: ${result.password}`);
    setCopied(true);
    toast.success("Credenciais copiadas!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#1a0a0a] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Novo Cliente
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-2">
              <Label className="text-white/70 text-sm">Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="cliente@email.com"
                className="bg-white/5 border-white/10 text-white placeholder-white/30"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label className="text-white/70 text-sm">Nome Completo</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="João Silva"
                className="bg-white/5 border-white/10 text-white placeholder-white/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label className="text-white/70 text-sm">Telefone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                  className="bg-white/5 border-white/10 text-white placeholder-white/30"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-white/70 text-sm">CPF</Label>
                <Input
                  value={form.cpf}
                  onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                  className="bg-white/5 border-white/10 text-white placeholder-white/30"
                />
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-primary hover:bg-primary/80 text-white font-bold py-3 h-auto rounded-xl mt-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Criar Cliente
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 items-center py-4">
            <CheckCircle className="w-12 h-12 text-green-400" />
            <p className="text-lg font-bold">Cliente Criado!</p>

            <div className="w-full bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-white/50">Email:</span>
                <span className="text-white font-medium">{result.email}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-white/50">Senha:</span>
                <span className="text-white font-mono font-bold">{result.password}</span>
              </div>
            </div>

            <Button
              onClick={handleCopy}
              variant="outline"
              className="w-full border-white/10 text-white/70 hover:text-white hover:bg-white/10 rounded-xl"
            >
              {copied ? <CheckCircle className="w-4 h-4 mr-2 text-green-400" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? "Copiado!" : "Copiar Credenciais"}
            </Button>

            <Button variant="ghost" onClick={handleClose} className="text-white/40 hover:text-white">
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
