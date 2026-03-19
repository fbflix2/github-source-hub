import { useState } from "react";

const MaterialIcon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

interface PricingModalProps {
  open: boolean;
  onClose: () => void;
}

const plans = [
  {
    name: "Starter",
    price: "9,99",
    bms: "Até 3 BMs",
    features: ["Monitoramento 24/7", "Backup diário", "Alertas por email", "Suporte via chat"],
    popular: false,
  },
  {
    name: "Profissional",
    price: "24,99",
    bms: "Até 15 BMs",
    features: ["Tudo do Starter", "Anti-phishing avançado", "Backup em tempo real", "Suporte prioritário", "Relatórios semanais"],
    popular: true,
  },
  {
    name: "Enterprise",
    price: "49,99",
    bms: "Até 50 BMs",
    features: ["Tudo do Profissional", "API dedicada", "Gerente de conta", "SLA 99.99%", "Auditoria completa", "Onboarding VIP"],
    popular: false,
  },
];

export default function PricingModal({ open, onClose }: PricingModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-3xl bg-[#14171b] border border-[#ffb4aa]/20 rounded-2xl p-6 animate-scale-in overflow-y-auto max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 right-3 text-[#c6c6c7]/50 hover:text-white transition-colors">
          <MaterialIcon name="close" className="!text-xl" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-2">
            <MaterialIcon name="local_offer" className="!text-sm" />
            Oferta Especial
          </div>
          <h2 className="text-xl font-black text-[#e0e2ea]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Escolha seu <span className="text-[#ffb4aa]">Plano de Proteção</span>
          </h2>
          <p className="text-[11px] text-[#c6c6c7]/60 mt-1">Todos os planos incluem 7 dias grátis. Cancele quando quiser.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {plans.map(plan => (
            <div
              key={plan.name}
              className={`relative rounded-xl p-4 border flex flex-col ${
                plan.popular
                  ? "bg-gradient-to-b from-[#ffb4aa]/10 to-[#1c2025] border-[#ffb4aa]/40 shadow-lg shadow-[#ffb4aa]/10"
                  : "bg-[#1c2025] border-[#5d3f3b]/20"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[#ffb4aa] text-[#410001] text-[9px] font-bold uppercase tracking-wider rounded-full">
                  Mais Popular
                </div>
              )}
              <h3 className="text-sm font-bold text-[#e0e2ea] mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{plan.name}</h3>
              <p className="text-[10px] text-[#c6c6c7]/60 mb-3">{plan.bms}</p>
              <div className="mb-4">
                <span className="text-2xl font-black text-[#e0e2ea]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>R$ {plan.price}</span>
                <span className="text-[10px] text-[#c6c6c7]/50">/mês</span>
              </div>
              <ul className="space-y-1.5 mb-4 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-[10px] text-[#c6c6c7]/80">
                    <MaterialIcon name="check" className="!text-xs text-emerald-400" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                className={`w-full py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 ${
                  plan.popular
                    ? "bg-[#ffb4aa] text-[#410001] hover:bg-[#ffdad5]"
                    : "bg-white/10 text-[#e0e2ea] hover:bg-white/20"
                }`}
              >
                Começar Agora
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-[9px] text-[#c6c6c7]/40 mt-4">
          Pagamento seguro via PIX ou cartão. Sem taxas ocultas.
        </p>
      </div>
    </div>
  );
}
