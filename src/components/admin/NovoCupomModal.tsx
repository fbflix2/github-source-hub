import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Tag, Percent, Users, Calendar as CalendarIcon, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface NovoCupomModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NovoCupomModal({ open, onOpenChange }: NovoCupomModalProps) {
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState("");
  const [limit, setLimit] = useState("");
  const [expiresAt, setExpiresAt] = useState<Date | undefined>();
  const [isActive, setIsActive] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement coupon creation
    console.log({ code, discount, limit, expiresAt, isActive });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-transparent border-0 p-0 max-w-[480px] shadow-none">
        <div className="flex flex-col gap-6">
          {/* Main Form Card */}
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative">
            <DialogHeader className="mb-8">
              <DialogTitle className="flex items-center gap-3 text-2xl font-bold text-white tracking-tight">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(249,6,6,0.4)]">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                Novo Cupom
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              {/* Código do Cupom */}
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-white/50 uppercase tracking-widest pl-1">
                  Código do Cupom
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Tag className="w-5 h-5 text-white/30 group-focus-within:text-white/80 transition-colors" />
                  </div>
                  <Input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="EX: BLACKFRIDAY10"
                    className="w-full pl-12 pr-4 py-4 h-auto rounded-2xl bg-black/40 border border-white/10 text-white placeholder:text-white/20 focus:border-primary/50 focus-visible:ring-1 focus-visible:ring-primary/50 focus:bg-black/60 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Desconto e Limite */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-bold text-white/50 uppercase tracking-widest pl-1">
                    Desconto (%)
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Percent className="w-5 h-5 text-white/30 group-focus-within:text-white/80 transition-colors" />
                    </div>
                    <Input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      placeholder="20"
                      min="1"
                      max="100"
                      className="w-full pl-12 pr-4 py-4 h-auto rounded-2xl bg-black/40 border border-white/10 text-white placeholder:text-white/20 focus:border-primary/50 focus-visible:ring-1 focus-visible:ring-primary/50 focus:bg-black/60 transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-bold text-white/50 uppercase tracking-widest pl-1">
                    Limite
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Users className="w-5 h-5 text-white/30 group-focus-within:text-white/80 transition-colors" />
                    </div>
                    <Input
                      type="number"
                      value={limit}
                      onChange={(e) => setLimit(e.target.value)}
                      placeholder="100"
                      min="1"
                      className="w-full pl-12 pr-4 py-4 h-auto rounded-2xl bg-black/40 border border-white/10 text-white placeholder:text-white/20 focus:border-primary/50 focus-visible:ring-1 focus-visible:ring-primary/50 focus:bg-black/60 transition-all font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Expira em */}
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-white/50 uppercase tracking-widest pl-1">
                  Expira em
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full pl-12 pr-4 py-4 h-auto rounded-2xl bg-black/40 border border-white/10 text-left font-medium hover:bg-black/60 hover:border-primary/50 transition-all justify-start",
                        !expiresAt && "text-white/20"
                      )}
                    >
                      <CalendarIcon className="absolute left-4 w-5 h-5 text-white/30" />
                      {expiresAt ? (
                        format(expiresAt, "dd/MM/yyyy", { locale: ptBR })
                      ) : (
                        <span>mm/dd/yyyy</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-neutral-900 border-white/10" align="start">
                    <Calendar
                      mode="single"
                      selected={expiresAt}
                      onSelect={setExpiresAt}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Ativar Cupom */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-black/20 border border-white/5">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">Ativar Cupom</span>
                  <span className="text-xs text-white/40">Disponível imediatamente</span>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="mt-4 w-full bg-primary hover:bg-red-600 text-white font-bold py-4 px-6 h-auto rounded-2xl shadow-[0_0_20px_rgba(249,6,6,0.4)] hover:shadow-[0_0_30px_rgba(249,6,6,0.6)] transition-all flex items-center justify-center gap-2 group"
              >
                <span>CRIAR CUPOM</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </form>
          </div>

          {/* Pro Tip Card */}
          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/5 p-6 rounded-3xl relative overflow-hidden">
            <div className="absolute left-0 top-6 bottom-6 w-1 bg-primary rounded-r-full shadow-[0_0_10px_rgba(249,6,6,0.5)]" />
            <div className="pl-4">
              <h4 className="text-white font-bold mb-2 text-sm">Dica Pro:</h4>
              <p className="text-white/60 text-sm leading-relaxed">
                Cupons sem data de expiração ficarão ativos indefinidamente até serem desativados manualmente.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
