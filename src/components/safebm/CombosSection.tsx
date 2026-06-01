import { Link, useNavigate } from "react-router-dom";
import { Shield, Sparkles, Crown, Check, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SAFE_BM_PRODUCT_ID = "e5118c63-ed52-4f4e-8983-f44c1ba0d17b";

export const safeBmCombos = [
  {
    id: "essencial",
    name: "Combo Essencial",
    tagline: "Para gestores iniciantes",
    bms: 10,
    monthly: 89.9,
    perBm: 8.99,
    originalPerBm: 9.99,
    discount: "10% OFF",
    icon: Shield,
    gradient: "from-[#00F0FF]/20 to-[#00F0FF]/5",
    border: "border-[#00F0FF]/30",
    features: [
      "Até 10 BMs protegidas",
      "Acesso parceiro redundante",
      "Recuperação em até 24h",
      "Suporte via WhatsApp",
    ],
  },
  {
    id: "pro",
    name: "Combo Pro",
    tagline: "Para agências em escala",
    bms: 25,
    monthly: 199.9,
    perBm: 7.99,
    originalPerBm: 9.99,
    discount: "20% OFF",
    highlight: true,
    icon: Sparkles,
    gradient: "from-[#BC13FE]/30 to-[#00F0FF]/10",
    border: "border-[#BC13FE]/50",
    features: [
      "Até 25 BMs protegidas",
      "Tudo do Essencial",
      "Recuperação prioritária (12h)",
      "Gerente de conta dedicado",
      "Relatório mensal das BMs",
    ],
  },
  {
    id: "enterprise",
    name: "Combo Enterprise",
    tagline: "Para grandes operações",
    bms: 50,
    monthly: 349.9,
    perBm: 6.99,
    originalPerBm: 9.99,
    discount: "30% OFF",
    icon: Crown,
    gradient: "from-[#E11D48]/20 to-[#BC13FE]/10",
    border: "border-[#E11D48]/40",
    features: [
      "Até 50 BMs protegidas",
      "Tudo do Pro",
      "SLA de recuperação em 6h",
      "Suporte 24/7 exclusivo",
      "Auditoria trimestral de risco",
    ],
  },
];

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  variant?: "dark" | "light";
  title?: string;
  subtitle?: string;
  showFooter?: boolean;
}

export default function SafeBmCombosSection({
  variant = "dark",
  title = "Combos de Proteção Safe BM",
  subtitle = "Quanto mais BMs você proteger, menor o custo por BM.",
  showFooter = true,
}: Props) {
  const navigate = useNavigate();

  const handleCheckout = async (bms: number) => {
    const url = `/checkout?product=${SAFE_BM_PRODUCT_ID}&qty=${bms}`;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      sessionStorage.setItem("product_redirect", url);
      navigate("/auth");
      return;
    }
    navigate(url);
  };

  const isDark = variant === "dark";

  return (
    <section className={`py-16 ${isDark ? "bg-[#0A0A0A] text-white" : ""}`}>
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="text-center mb-10">
          <span className="inline-block py-1 px-4 rounded-full bg-[#00F0FF]/20 text-[#00F0FF] text-xs font-bold tracking-wider mb-4 border border-[#00F0FF]/30">
            ECONOMIA DE ATÉ 30%
          </span>
          <h2 className={`text-3xl md:text-4xl font-extrabold mb-3 ${isDark ? "" : "text-foreground"}`}>{title}</h2>
          <p className={isDark ? "text-gray-400" : "text-muted-foreground"}>{subtitle}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {safeBmCombos.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.id}
                className={`relative bg-gradient-to-b ${plan.gradient} ${isDark ? "" : "bg-card"} backdrop-blur-xl border ${plan.border} rounded-3xl p-6 flex flex-col ${
                  plan.highlight ? "md:-translate-y-2 md:scale-[1.03] shadow-[0_0_40px_rgba(188,19,254,0.25)]" : ""
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-[#BC13FE] to-[#00F0FF] text-white text-[10px] font-bold tracking-wider px-3 py-1 rounded-full">
                      MAIS POPULAR
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-11 h-11 rounded-xl bg-white/5 border ${plan.border} flex items-center justify-center`}>
                    <Icon className="size-6 text-white" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-green-500/15 text-green-400 text-[10px] font-bold border border-green-500/30">
                    {plan.discount}
                  </span>
                </div>

                <h3 className={`text-xl font-bold mt-2 ${isDark ? "text-white" : "text-foreground"}`}>{plan.name}</h3>
                <p className={`text-xs mb-5 ${isDark ? "text-gray-400" : "text-muted-foreground"}`}>{plan.tagline}</p>

                <div className="mb-5">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-3xl md:text-4xl font-extrabold ${isDark ? "text-white" : "text-foreground"}`}>
                      {fmt(plan.monthly)}
                    </span>
                    <span className={`text-xs ${isDark ? "text-gray-400" : "text-muted-foreground"}`}>/mês</span>
                  </div>
                  <div className={`mt-1 text-xs ${isDark ? "text-gray-400" : "text-muted-foreground"}`}>
                    <span className="line-through opacity-60 mr-1">{fmt(plan.originalPerBm)}</span>
                    <span className={`font-semibold ${isDark ? "text-white" : "text-foreground"}`}>{fmt(plan.perBm)}</span> / BM • até {plan.bms} BMs
                  </div>
                </div>

                <ul className="space-y-2 mb-6 flex-grow">
                  {plan.features.map((f, i) => (
                    <li key={i} className={`flex items-start gap-2 text-xs ${isDark ? "text-gray-300" : "text-foreground/80"}`}>
                      <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5">
                        <Check className="size-2.5 text-green-400" />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCheckout(plan.bms)}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 ${
                    plan.highlight
                      ? "bg-gradient-to-r from-[#BC13FE] to-[#00F0FF] text-white shadow-[0_0_20px_rgba(188,19,254,0.4)]"
                      : isDark
                        ? "bg-white/10 hover:bg-white/15 text-white border border-white/15"
                        : "bg-primary text-primary-foreground hover:opacity-90"
                  }`}
                >
                  Contratar agora <ArrowRight className="size-4" />
                </button>
              </div>
            );
          })}
        </div>

        {showFooter && (
          <div className="text-center mt-10">
            <Link
              to="/safe-bm/combos"
              className="inline-flex items-center gap-2 text-[#00F0FF] hover:underline font-bold text-sm"
            >
              Ver todos os detalhes dos combos <ArrowRight className="size-4" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}