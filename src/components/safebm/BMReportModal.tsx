 import { useState } from "react";
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "sonner";
 
 interface BMReportModalProps {
   vault: {
     id: string;
     bm_name: string;
   } | null;
   open: boolean;
   onOpenChange: (open: boolean) => void;
   onSuccess: () => void;
 }
 
 export function BMReportModal({ vault, open, onOpenChange, onSuccess }: BMReportModalProps) {
   const [step, setStep] = useState<"initial" | "form" | "success">("initial");
   const [reason, setReason] = useState<"fallen" | "restricted" | "">("");
   const [newBmName, setNewBmName] = useState("");
   const [loading, setLoading] = useState(false);
 
   if (!vault) return null;
 
   const handleReport = () => {
     if (!reason) return;
     setStep("form");
   };
 
   const handleSubmit = async () => {
     if (!newBmName.trim()) {
       toast.error("Por favor, informe o nome da nova BM");
       return;
     }
 
     setLoading(true);
     try {
       const { data, error } = await supabase.functions.invoke("admin-fix-duplicate", {
         body: {
           action: "configure_vault",
           vault_id: vault.id,
           bm_name: newBmName.trim(),
           bm_link: "https://business.facebook.com", // Reset link to trigger re-config
         },
       });
 
       if (error || data?.error) throw new Error(data?.error || error?.message);
 
       // Also clear backup_link and tracking if any
       await supabase
         .from("safe_bm_vaults" as any)
         .update({
           backup_link: null,
           bm_tracking_id: null,
           status: "pending"
         })
         .eq("id", vault.id);
 
       setStep("success");
       onSuccess();
     } catch (err: any) {
       toast.error("Erro ao processar: " + err.message);
     } finally {
       setLoading(false);
     }
   };
 
   const handleClose = () => {
     onOpenChange(false);
     // Reset state for next time
     setTimeout(() => {
       setStep("initial");
       setReason("");
       setNewBmName("");
     }, 300);
   };
 
   return (
     <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
       <DialogContent className="sm:max-w-[425px] bg-[#1c2025] border-[#ffb4aa]/20 text-white p-6 rounded-3xl">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2 text-[#ffb4aa] text-xl font-bold">
             <ShieldAlert className="w-5 h-5" />
             Reportar Problema na BM
           </DialogTitle>
           <DialogDescription className="text-[#c6c6c7] text-xs">
             Cofre: <span className="text-white font-bold">{vault.bm_name}</span>
           </DialogDescription>
         </DialogHeader>
 
         {step === "initial" && (
           <div className="py-4 space-y-4">
             <p className="text-sm font-medium">O que aconteceu com sua Business Manager?</p>
             <div className="grid gap-3">
               <button
                 onClick={() => setReason("fallen")}
                 className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                   reason === "fallen" ? "bg-[#ffb4aa]/10 border-[#ffb4aa]" : "bg-[#262a30] border-white/5 hover:border-[#ffb4aa]/30"
                 }`}
               >
                 <div className="flex items-center gap-3">
                   <AlertCircle className={`w-5 h-5 ${reason === "fallen" ? "text-[#ffb4aa]" : "text-[#c6c6c7]"}`} />
                   <div className="text-left">
                     <p className="font-bold text-sm">A BM Caiu</p>
                     <p className="text-[11px] text-[#c6c6c7]/60">O link de acesso não funciona mais</p>
                   </div>
                 </div>
               </button>
 
               <button
                 onClick={() => setReason("restricted")}
                 className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                   reason === "restricted" ? "bg-[#ffb4aa]/10 border-[#ffb4aa]" : "bg-[#262a30] border-white/5 hover:border-[#ffb4aa]/30"
                 }`}
               >
                 <div className="flex items-center gap-3">
                   <ShieldAlert className={`w-5 h-5 ${reason === "restricted" ? "text-amber-400" : "text-[#c6c6c7]"}`} />
                   <div className="text-left">
                     <p className="font-bold text-sm">A BM Restringiu</p>
                     <p className="text-[11px] text-[#c6c6c7]/60">O Facebook limitou as funções da BM</p>
                   </div>
                 </div>
               </button>
             </div>
             <Button
               onClick={handleReport}
               disabled={!reason}
               className="w-full h-12 rounded-2xl bg-[#ffb4aa] hover:bg-[#ffb4aa]/90 text-[#410001] font-bold transition-all"
             >
               Continuar
             </Button>
           </div>
         )}
 
         {step === "form" && (
           <div className="py-4 space-y-4">
             <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
               <p className="text-xs text-amber-400 leading-relaxed font-medium">
                 Você pode substituir esta BM por uma nova dentro da mesma assinatura. 
                 Por favor, informe o nome da nova BM que você irá enviar.
               </p>
             </div>
             <div className="space-y-2">
               <Label htmlFor="newBmName" className="text-xs font-bold text-[#c6c6c7] uppercase tracking-wider">Nome da Nova BM</Label>
               <Input
                 id="newBmName"
                 value={newBmName}
                 onChange={(e) => setNewBmName(e.target.value)}
                 placeholder="Ex: Minha Nova BM 01"
                 className="h-12 rounded-2xl bg-[#0a0e13] border-[#ffb4aa]/20 focus:border-[#ffb4aa] text-sm"
               />
             </div>
             <Button
               onClick={handleSubmit}
               disabled={loading || !newBmName.trim()}
               className="w-full h-12 rounded-2xl bg-[#ffb4aa] hover:bg-[#ffb4aa]/90 text-[#410001] font-bold transition-all"
             >
               {loading ? (
                 <div className="flex items-center gap-2">
                   <div className="w-4 h-4 border-2 border-[#410001] border-t-transparent rounded-full animate-spin" />
                   Processando...
                 </div>
               ) : "Confirmar Substituição"}
             </Button>
             <button 
               onClick={() => setStep("initial")} 
               className="w-full text-center text-xs text-[#c6c6c7]/60 hover:text-[#c6c6c7] transition-colors"
             >
               Voltar
             </button>
           </div>
         )}
 
         {step === "success" && (
           <div className="py-8 flex flex-col items-center justify-center text-center space-y-4 animate-fade-in">
             <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center border-2 border-emerald-500/20">
               <CheckCircle2 className="w-10 h-10 text-emerald-500" />
             </div>
             <div>
               <p className="font-bold text-xl text-white">Solicitação Enviada!</p>
               <p className="text-sm text-[#c6c6c7] mt-2 leading-relaxed">
                 O cofre foi liberado para substituição. <br />
                 Agora você deve enviar o novo convite na tela de configuração.
               </p>
             </div>
             <Button
               onClick={handleClose}
               className="w-full h-12 rounded-2xl bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold"
             >
               Entendi
             </Button>
           </div>
         )}
       </DialogContent>
     </Dialog>
   );
 }