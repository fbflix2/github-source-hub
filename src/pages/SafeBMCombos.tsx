import { Link, useNavigate } from "react-router-dom";
import { Shield, Check, Crown, Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SAFE_BM_PRODUCT_ID = "e5118c63-ed52-4f4e-8983-f44c1ba0d17b";

type Plan = {
  id: string;
  name: string;
  tagline: string;
  bms: number;
  monthly: number;
  perBm: number;
  originalPerBm: number;
  discount: string;
  highlight?: boolean;
  icon: JSX.Element;
  features: string[];
  gradient: string;
  border: string;
};

const plans: Plan[] = [
  {
    id: "essencial",
    name: "Combo Essencial",
    tagline: "Para gestores iniciantes e contas individuais",
    bms: 10,
    monthly: 89.9,
    perBm: 8.99,
    originalPerBm: 9.99,
    discount: "10% OFF",
    icon: <Shield className="size-7" />,
    gradient: "from-[#00F0FF]/20 to-[#00F0FF]/5",
    border: "border-[#00F0FF]/30",
    features: [
      "Até 10 BMs protegidas",
      "Acesso parceiro redundante",
      "Recuperação de acesso em até 24h",
      "Suporte prioritário via WhatsApp",
      "Proteção de pixels e páginas",
    ],
  },
  {
    id: "pro",
    name: "Combo Pro",
    tagline: "Para agências e gestores em escala",
    bms: 25,
    monthly: 199.9,
    perBm: 7.99,
    originalPerBm: 9.99,
    discount: "20% OFF",
    highlight: true,
    icon: <Sparkles className="size-7" />,
    gradient: "from-[#BC13FE]/30 to-[#00F0FF]/10",
    border: "border-[#BC13FE]/50",
    features: [
      "Até 25 BMs protegidas",
      "Tudo do Essencial",
      "Acesso parceiro redundante premium",
      "Recuperação prioritária (até 12h)",
      "Gerente de conta dedicado",
      "Relatório mensal de saúde das BMs",
    ],
  },
  {
    id: "enterprise",
    name: "Combo Enterprise",
    tagline: "Para grandes operações e carteiras de clientes",
    bms: 50,
    monthly: 349.9,
    perBm: 6.99,
    originalPerBm: 9.99,
    discount: "30% OFF",
    icon: <Crown className="size-7" />,
    gradient: "from-[#E11D48]/20 to-[#BC13FE]/10",
    border: "border-[#E11D48]/40",
    features: [
      "Até 50 BMs protegidas",
      "Tudo do Pro",
      "SLA de recuperação em até 6h",
      "Suporte 24/7 com canal exclusivo",
      "Auditoria trimestral de risco",
      "Onboarding personalizado",
    ],
  },
];

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function SafeBMCombos() {
  const navigate = useNavigate();

  const handleCheckout = async (plan: Plan) => {
    const url = `/checkout?product=${SAFE_BM_PRODUCT_ID}&qty=${plan.bms}`;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      sessionStorage.setItem("product_redirect", url);
      navigate("/auth");
      return;
    }
    navigate(url);
  };

  return (
    <div className="bg-[#0A0A0A] text-white font-sans min-h-screen selection:bg-[#BC13FE] selection:text-white">
      <div className="lg:scale-[0.8] lg:origin-top">
      {/* HERO */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#00F0FF]/10 rounded-full blur-[120px] -z-10 translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#BC13FE]/10 rounded-full blur-[120px] -z-10 -translate-x-1/2 translate-y-1/2" />

        <div className="max-w-6xl mx-auto px-6 md:px-12 text-center">
          <span className="inline-block py-1 px-4 rounded-full bg-[#00F0FF]/20 text-[#00F0FF] text-sm font-bold tracking-wider mb-6 border border-[#00F0FF]/30">
            COMBOS DE PROTEÇÃO SAFE BM
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold leading-[1.1] mb-6">
            Blinde sua operação com{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] to-[#BC13FE]">
              economia de até 30%
            </span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Quanto mais BMs você proteger, menor o custo por BM. Escolha o combo
            ideal para o tamanho da sua operação e durma tranquilo.
          </p>
        </div>
      </section>

      {/* PLANS */}
      <section className="pb-24">
        <div className="max-w-7xl mx-auto px-6 md:px-12 grid lg:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-gradient-to-b ${plan.gradient} backdrop-blur-xl border ${plan.border} rounded-3xl p-8 flex flex-col ${
                plan.highlight ? "lg:-translate-y-4 lg:scale-105 shadow-[0_0_60px_rgba(188,19,254,0.25)]" : ""
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-[#BC13FE] to-[#00F0FF] text-white text-xs font-bold tracking-wider px-4 py-1.5 rounded-full">
                    MAIS POPULAR
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 mb-2">
                <div className={`w-12 h-12 rounded-xl bg-white/5 border ${plan.border} flex items-center justify-center text-white`}>
                  {plan.icon}
                </div>
                <span className="px-3 py-1 rounded-full bg-green-500/15 text-green-400 text-xs font-bold border border-green-500/30">
                  {plan.discount}
                </span>
              </div>

              <h3 className="text-2xl font-bold mt-2">{plan.name}</h3>
              <p className="text-sm text-gray-400 mb-6">{plan.tagline}</p>

              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl md:text-5xl font-extrabold text-white">
                    {fmt(plan.monthly)}
                  </span>
                  <span className="text-gray-400 text-sm">/mês</span>
                </div>
                <div className="mt-2 text-sm text-gray-400">
                  <span className="line-through text-gray-600 mr-2">
                    {fmt(plan.originalPerBm)}
                  </span>
                  <span className="text-white font-semibold">
                    {fmt(plan.perBm)}
                  </span>{" "}
                  por BM • até {plan.bms} BMs
                </div>
              </div>

              <ul className="space-y-3 mb-8 flex-grow">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5">
                      <Check className="size-3 text-green-400" />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(plan)}
                className={`w-full py-4 rounded-xl font-bold text-base transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 ${
                  plan.highlight
                    ? "bg-gradient-to-r from-[#BC13FE] to-[#00F0FF] text-white shadow-[0_0_30px_rgba(188,19,254,0.4)]"
                    : "bg-white/10 hover:bg-white/15 text-white border border-white/15"
                }`}
              >
                Contratar agora <ArrowRight className="size-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="max-w-3xl mx-auto px-6 mt-16 text-center">
          <p className="text-gray-400 mb-4">
            Precisa de mais de 50 BMs ou um plano sob medida?
          </p>
          <Link
            to="/suporte"
            className="inline-flex items-center gap-2 text-[#00F0FF] hover:text-white font-bold transition-colors"
          >
            Fale com nosso time comercial <ArrowRight className="size-4" />
          </Link>
          <p className="mt-10 text-xs text-gray-500">
            Cobrança recorrente mensal. Cancele quando quiser pelo painel. Saiba mais em{" "}
            <Link to="/saiba-mais-safebm" className="underline hover:text-white">
              como funciona o Safe BM
            </Link>
            .
          </p>
        </div>
      </section>
      </div>
    </div>
  );
}