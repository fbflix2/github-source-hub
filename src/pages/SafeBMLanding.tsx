import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, DollarSign, Zap, Check, ChevronDown } from "lucide-react";
import heroVault from "@/assets/safebm-hero-vault.jpg";
import specialistImg from "@/assets/safebm-specialist.jpg";

const faqs = [
  {
    q: "Como funciona a blindagem?",
    a: 'Nós utilizamos o sistema de "Acesso Parceiro" de forma estratégica através de contas business de alta confiança (Trust Score alto). Se o seu perfil cair, a nossa conexão permanece ativa, permitindo-nos adicionar um novo perfil seu à BM.',
  },
  {
    q: "Preciso passar minha senha?",
    a: "Jamais. Todo o processo é feito via link de convite ou ID da BM. Sua segurança e privacidade são nossa prioridade absoluta.",
  },
  {
    q: "O que acontece se minha BM for banida permanentemente?",
    a: "A blindagem protege contra a perda de acesso por bloqueio de perfil. Se a Business Manager em si for banida pelo Facebook por violação de políticas, a blindagem não a \"desbane\", mas garante que você tenha tido tempo de backup de dados antes do ocorrido.",
  },
  {
    q: "Existe carência para usar o suporte?",
    a: "Não. A partir do momento que a blindagem é confirmada, você já está sob nossa proteção.",
  },
  {
    q: "Posso blindar quantas BMs eu quiser?",
    a: "Sim! O valor de R$ 9,99 é unitário por BM ativa no sistema. Grandes agências costumam blindar toda a sua carteira de clientes.",
  },
];

const testimonials = [
  {
    text: '"Minha BM caiu na sexta-feira à noite com lançamento rodando. No sábado de manhã a FBFlix já tinha restaurado meu acesso parceiro e o ROI foi salvo. Vale cada centavo."',
    name: "Ricardo S.",
    role: "Gestor de Tráfego",
    gradientDir: "from-[#00F0FF] to-[#BC13FE]",
    borderColor: "border-[#00F0FF]",
  },
  {
    text: '"Fazia tempo que não dormia tão tranquila. O serviço é invisível quando você não precisa e indispensável quando o Facebook resolve implicar com a conta."',
    name: "Marina L.",
    role: "Dona de Infoproduto",
    gradientDir: "from-[#BC13FE] to-[#00F0FF]",
    borderColor: "border-[#BC13FE]",
  },
  {
    text: '"A estrutura de contingência deles é de outro planeta. O custo é ridículo perto do prejuízo de ter uma operação parada por 1 dia sequer."',
    name: "André M.",
    role: "Afiliado Black",
    gradientDir: "from-[#00F0FF] to-[#BC13FE]",
    borderColor: "border-[#00F0FF]",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-6 text-left font-bold flex justify-between items-center hover:bg-white/5 transition-colors"
      >
        {q}
        <ChevronDown className={`size-5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-6 pb-6 text-gray-400">
          {a}
        </div>
      )}
    </div>
  );
}

export default function SafeBMLanding() {
  const navigate = useNavigate();
  const BM_SAFE_CHECKOUT = "/checkout?product=e5118c63-ed52-4f4e-8983-f44c1ba0d17b&qty=1";
  return (
    <div className="bg-[#0A0A0A] text-white font-sans min-h-screen selection:bg-[#BC13FE] selection:text-white">

      {/* ═══════ HERO ═══════ */}
      <section className="relative pt-20 pb-20 overflow-hidden min-h-screen flex items-center">
        {/* Decorative Gradients */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#00F0FF]/10 rounded-full blur-[120px] -z-10 translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#BC13FE]/10 rounded-full blur-[120px] -z-10 -translate-x-1/2 translate-y-1/2" />

        <div className="max-w-7xl mx-auto px-8 md:px-12 grid lg:grid-cols-2 gap-12 items-center">
          <div className="z-10 text-center lg:text-left">
            <span className="inline-block py-1 px-4 rounded-full bg-[#00F0FF]/20 text-[#00F0FF] text-sm font-bold tracking-wider mb-6 border border-[#00F0FF]/30">
              TECNOLOGIA ANTIBLOCK 2025
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold leading-[1.1] mb-6">
              Não perca sua{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] to-[#BC13FE]">
                BM nunca mais!
              </span>
            </h1>
            <p className="text-xl text-gray-400 mb-10 max-w-lg mx-auto lg:mx-0">
              Proteção total por apenas{" "}
              <span className="text-white font-bold">R$ 9,99/mês</span>.
              Recupere o acesso ao seu faturamento em menos de 24h.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <a
                href="#oferta"
                className="bg-[#E11D48] hover:scale-105 active:scale-95 transition-all text-white px-10 py-5 rounded-xl font-bold text-xl shadow-[0_0_30px_rgba(225,29,72,0.3)] text-center"
              >
                PROTEGER MINHA BM AGORA
              </a>
            </div>
            <div className="mt-8 flex items-center justify-center lg:justify-start gap-4 text-sm text-gray-500">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full bg-gray-700 border-2 border-[#0A0A0A]" />
                <div className="w-8 h-8 rounded-full bg-gray-600 border-2 border-[#0A0A0A]" />
                <div className="w-8 h-8 rounded-full bg-gray-500 border-2 border-[#0A0A0A]" />
              </div>
              <span>+146 BMs protegidas esta semana</span>
            </div>
          </div>

          {/* Vault Image */}
          <div className="relative flex justify-center">
            <div className="relative w-full h-[300px] md:h-[500px]">
              <div className="absolute inset-0 bg-gradient-to-br from-[#00F0FF]/20 to-[#BC13FE]/20 rounded-3xl blur-2xl" />
              <img
                alt="Cofre Blindado"
                className="w-full h-full object-cover rounded-3xl border border-white/10 shadow-2xl animate-[pulse-glow_3s_infinite] opacity-80"
                src={heroVault}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent rounded-3xl" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ PAIN POINTS ═══════ */}
      <section className="py-24 bg-black/50">
        <div className="max-w-7xl mx-auto px-8 md:px-12">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Por que os grandes players não dormem preocupados?
            </h2>
            <p className="text-gray-400">
              O amadorismo custa caro. A blindagem é o seu seguro de vida digital.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <AlertTriangle className="size-8" />,
                title: "Perfil bloqueado = perda total",
                desc: "Se o seu perfil de administrador cair hoje, você perde o acesso a tudo. Sem volta, sem choro.",
              },
              {
                icon: <DollarSign className="size-8" />,
                title: "Milhares em ads jogados fora",
                desc: "A inteligência do pixel e o histórico de conta são seus maiores ativos. Não deixe o Mark levar eles de você.",
              },
              {
                icon: <Zap className="size-8" />,
                title: "Sem backup = pânico total",
                desc: 'Viver com o medo constante do "Check-point" impede você de escalar sua operação com segurança.',
              },
            ].map((c, i) => (
              <div
                key={i}
                className="bg-white/[0.03] backdrop-blur-xl border border-white/10 p-8 rounded-2xl hover:border-[#00F0FF]/50 transition-colors"
              >
                <div className="w-14 h-14 bg-red-500/10 rounded-lg flex items-center justify-center mb-6 text-red-500">
                  {c.icon}
                </div>
                <h3 className="text-xl font-bold mb-4">{c.title}</h3>
                <p className="text-gray-400 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ BENEFITS ═══════ */}
      <section className="py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-8 md:px-12 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl font-extrabold mb-8 leading-tight">
              Sua infraestrutura blindada por especialistas
            </h2>
            <ul className="space-y-6">
              {[
                {
                  title: "Acesso parceiro salvo com segurança",
                  desc: "Configuramos um nó redundante de acesso que o Facebook não detecta como atividade suspeita.",
                },
                {
                  title: "Novo link de convite em até 24h",
                  desc: "Caiu? Nossa equipe gera um novo acesso administrativo para você em tempo recorde.",
                },
                {
                  title: "Protege pixels, contas e páginas",
                  desc: "Toda a hierarquia da sua Business Manager fica sob o guarda-chuva da FBFlix.",
                },
                {
                  title: "Baixo custo recorrente",
                  desc: "Menos do que um café por semana para garantir que sua empresa não pare de vender.",
                },
              ].map((b, i) => (
                <li key={i} className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center mt-1">
                    <Check className="size-4 text-[#0A0A0A]" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold">{b.title}</h4>
                    <p className="text-gray-400">{b.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-[#BC13FE]/20 blur-[80px]" />
            <img
              alt="Time de Especialistas FBFLIX"
              className="relative z-10 rounded-2xl border border-white/10 w-full object-cover aspect-video"
              src={specialistImg}
            />
          </div>
        </div>
      </section>

      {/* ═══════ OFFER ═══════ */}
      <section className="py-24 bg-gradient-to-b from-[#0A0A0A] to-[#0F172A]" id="oferta">
        <div className="max-w-4xl mx-auto px-8 md:px-12 text-center">
          <div className="mb-12">
            <h2 className="text-4xl md:text-5xl font-black mb-4">Escolha sua tranquilidade</h2>
            <p className="text-gray-400">O plano perfeito para quem leva o tráfego pago a sério.</p>
          </div>
          <div className="relative bg-[#161616] border-2 border-[#00F0FF] rounded-[2rem] p-10 md:p-16 shadow-[0_0_50px_rgba(0,240,255,0.1)]">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#00F0FF] text-[#0A0A0A] px-8 py-2 rounded-full font-bold uppercase tracking-tighter text-sm">
              Plano Anual / Recorrente
            </div>
            <div className="mb-8">
              <span className="text-6xl md:text-8xl font-black text-white">R$ 9,99</span>
              <span className="text-xl text-gray-500">/mês por BM</span>
            </div>
            <div className="space-y-4 mb-10 text-lg">
              <p className="text-white">
                <span className="text-[#00F0FF]">●</span> Mínimo 3 meses (R$ 29,97 na carteira FBFlix)
              </p>
              <p className="text-white">
                <span className="text-[#00F0FF]">●</span> Monitoramento 24/7 de integridade
              </p>
              <p className="text-white">
                <span className="text-[#00F0FF]">●</span> Suporte prioritário via WhatsApp
              </p>
              <div className="inline-block mt-4 bg-green-500/10 text-green-400 px-4 py-1 rounded-lg text-sm font-semibold border border-green-500/20">
                Selo: Sem fidelidade, cancele quando quiser
              </div>
            </div>
            <Link
              to="/suporte"
              className="block w-full bg-[#E11D48] hover:bg-rose-700 transition-colors py-6 rounded-2xl text-2xl font-bold mb-6 text-white"
            >
              ATIVAR BLINDAGEM AGORA
            </Link>
            <p className="text-sm text-gray-500 italic">
              Pague com PIX ou Cartão. Ativação imediata após a confirmação.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════ SOCIAL PROOF ═══════ */}
      <section className="py-24 bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto px-8 md:px-12">
          <h2 className="text-3xl font-bold text-center mb-16">Quem usa, recomenda</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className={`bg-white/[0.03] backdrop-blur-xl border border-white/10 p-8 rounded-xl border-l-4 ${t.borderColor}`}
              >
                <p className="text-gray-300 italic mb-6">{t.text}</p>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${t.gradientDir}`} />
                  <div>
                    <p className="font-bold">{t.name}</p>
                    <p className="text-xs text-gray-500 uppercase">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ FAQ ═══════ */}
      <section className="py-24 bg-black/30">
        <div className="max-w-3xl mx-auto px-8 md:px-12">
          <h2 className="text-3xl font-bold text-center mb-12">Dúvidas Frequentes</h2>
          <div className="space-y-4">
            {faqs.map((f, i) => (
              <FAQItem key={i} q={f.q} a={f.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ FOOTER CTA ═══════ */}
      <footer className="py-12 border-t border-white/10 text-center">
        <div className="max-w-7xl mx-auto px-8 md:px-12">
          <div className="mb-8">
            <h3 className="text-2xl font-bold mb-4">Pronto para blindar seu faturamento?</h3>
            <p className="text-gray-400 mb-8">
              Não espere o bloqueio chegar para tomar uma atitude. O seguro é feito enquanto tudo está bem.
            </p>
            <a
              href="#oferta"
              className="inline-block bg-white text-[#0A0A0A] px-12 py-4 rounded-full font-extrabold hover:bg-[#00F0FF] transition-colors uppercase tracking-widest text-sm"
            >
              Ativar BM Blindada Agora
            </a>
          </div>
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-600">
            <p>© 2025 FBFlix Security Division. Todos os direitos reservados.</p>
            <div className="flex gap-6">
              <Link to="/termos" className="hover:text-white transition-colors">Termos de Uso</Link>
              <Link to="/privacidade" className="hover:text-white transition-colors">Política de Privacidade</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
