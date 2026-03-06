import { ArrowLeft, Info, CreditCard, Ticket, Trophy, Gavel, DollarSign, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const ComoFunciona = () => {
  const navigate = useNavigate();

  const steps = [
    {
      icon: CreditCard,
      title: "1. Recarregue seu saldo",
      description: "Acesse a loja e adicione créditos à sua conta. Qualquer método de pagamento é válido para esta etapa.",
    },
    {
      icon: Ticket,
      title: "2. Receba números da sorte",
      description: (
        <>
          O sistema converte automaticamente o valor da recarga.{" "}
          <strong className="text-foreground">A cada R$ 20,00</strong>, você ganha 1 ticket exclusivo.
        </>
      ),
    },
    {
      icon: Trophy,
      title: "3. Concorra ao sorteio",
      description: "Fique atento às datas! O sorteio ocorre automaticamente e os vencedores são notificados no painel.",
    },
  ];

  const regulations = [
    {
      number: "01",
      title: "Período da Promoção",
      content: (
        <>
          A promoção é válida para recargas efetuadas entre as 00:00 do dia{" "}
          <strong className="text-foreground">01/01/2026</strong> até as 23:59 do dia{" "}
          <strong className="text-foreground">31/01/2026</strong> (horário de Brasília). Recargas fora deste período não gerarão números da sorte.
        </>
      ),
    },
    {
      number: "02",
      title: "Valores Qualificatórios",
      content: (
        <>
          São elegíveis todas as recargas de saldo na plataforma. O valor mínimo para gerar 1 (um) número da sorte é de{" "}
          <strong className="text-primary">R$ 20,00</strong>. Valores fracionados são acumulativos apenas dentro da mesma transação.
        </>
      ),
    },
    {
      number: "03",
      title: "Quantidade de Números",
      isList: true,
      items: [
        "R$ 20,00 = 1 Número da Sorte",
        "R$ 50,00 = 3 Números da Sorte (Bônus)",
        "R$ 100,00 = 7 Números da Sorte (Super Bônus)",
      ],
    },
    {
      number: "04",
      title: "Sorteio e Apuração",
      content: (
        <>
          O sorteio será realizado com base na extração da Loteria Federal do dia{" "}
          <strong className="text-foreground">05/02/2026</strong>. O resultado oficial será divulgado nesta mesma página e nas redes sociais oficiais em até 24 horas após a apuração.
        </>
      ),
    },
    {
      number: "05",
      title: "Critérios de Elegibilidade",
      content:
        "Participação exclusiva para pessoas físicas, maiores de 18 anos, residentes no Brasil, com cadastro ativo e regular na plataforma. Contas suspensas ou banidas no momento do sorteio serão desclassificadas automaticamente.",
    },
    {
      number: "06",
      title: "Entrega do Prêmio",
      content:
        "Os ganhadores serão contatados via e-mail e notificação no painel do usuário. O prêmio será creditado na carteira ou enviado conforme descrito na premiação específica em até 30 dias úteis.",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2 animate-fade-in-up">
        <div className="flex items-center gap-2 text-primary text-sm font-bold uppercase tracking-wider mb-2">
          <Info className="w-4 h-4" />
          <span>Central de Promoções</span>
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold text-foreground leading-tight tracking-tight">
          Como Funciona a <span className="text-primary">Recarga Premiada</span>
        </h1>
        <p className="text-muted-foreground text-lg font-normal max-w-2xl mt-2">
          Entenda cada etapa para participar, acumular números da sorte e concorrer a prêmios incríveis toda semana.
        </p>
      </div>

      {/* Steps and Preview Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Steps */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {steps.map((step, index) => (
            <div
              key={index}
              className="glass-panel bg-card p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center gap-5 hover:border-primary/30 transition-colors group border border-border"
            >
              <div className="size-14 rounded-full bg-muted border border-border flex items-center justify-center shrink-0 group-hover:bg-primary/20 group-hover:border-primary/50 transition-all">
                <step.icon className="w-7 h-7 text-primary" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-foreground text-xl font-bold">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Preview Card */}
        <div className="lg:col-span-5 h-full">
          <div className="glass-panel bg-card rounded-2xl p-6 h-full min-h-[300px] flex flex-col justify-between relative overflow-hidden border border-border">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/80 z-10" />
            <div className="relative z-20">
              <span className="bg-primary/20 text-primary text-xs font-bold px-3 py-1 rounded-full border border-primary/20 uppercase">
                Preview
              </span>
              <h3 className="text-foreground text-lg font-bold mt-3">Visualização do Processo</h3>
            </div>
            <div className="absolute inset-0 flex items-center justify-center opacity-60">
              <div
                className="relative w-full h-full"
                style={{ background: "radial-gradient(circle at center, hsl(var(--muted)) 0%, transparent 70%)" }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-4">
                  <DollarSign className="w-16 h-16 text-muted-foreground animate-pulse" />
                  <ArrowLeft className="w-10 h-10 text-muted-foreground rotate-180" />
                  <Star className="w-16 h-16 text-yellow-500 animate-bounce" />
                </div>
              </div>
            </div>
            <div className="relative z-20 mt-auto">
              <p className="text-muted-foreground text-sm italic">
                "Animação ilustrativa: Ao confirmar a recarga, suas moedas se transformam magicamente em tickets dourados que voam para a urna virtual do sorteio."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Regulation Section */}
      <section className="glass-panel bg-card rounded-3xl p-6 md:p-10 border border-border border-t-4 border-t-primary">
        <div className="flex items-center gap-3 mb-8">
          <Gavel className="w-8 h-8 text-primary" />
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">Regulamento Completo</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          {/* Left Column */}
          <div className="space-y-8">
            {regulations.slice(0, 3).map((reg, index) => (
              <div key={index}>
                <h4 className="text-foreground font-bold text-lg mb-2 flex items-center gap-2">
                  <span className="size-6 rounded-full bg-muted flex items-center justify-center text-xs text-foreground">
                    {reg.number}
                  </span>
                  {reg.title}
                </h4>
                {reg.isList ? (
                  <ul className="text-muted-foreground text-sm leading-relaxed pl-8 list-disc list-inside space-y-1">
                    {reg.items?.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-sm leading-relaxed pl-8">{reg.content}</p>
                )}
              </div>
            ))}
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            {regulations.slice(3).map((reg, index) => (
              <div key={index}>
                <h4 className="text-foreground font-bold text-lg mb-2 flex items-center gap-2">
                  <span className="size-6 rounded-full bg-muted flex items-center justify-center text-xs text-foreground">
                    {reg.number}
                  </span>
                  {reg.title}
                </h4>
                <p className="text-muted-foreground text-sm leading-relaxed pl-8">{reg.content}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Certificado de Autorização SECAP/ME Nº 00.0000/2026. Consulte o regulamento completo em PDF clicando{" "}
            <a className="text-primary hover:underline cursor-pointer" href="#">
              aqui
            </a>
            .
          </p>
        </div>
      </section>

      {/* Back Button */}
      <div className="flex justify-center pb-8">
        <Button
          onClick={() => navigate("/parceria")}
          className="group relative flex items-center justify-center gap-3 px-8 py-6 bg-primary hover:bg-red-700 text-primary-foreground rounded-xl shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all duration-300 transform hover:-translate-y-1"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-base font-bold tracking-wide">Voltar para Ganhe Aqui</span>
        </Button>
      </div>
    </div>
  );
};

export default ComoFunciona;
