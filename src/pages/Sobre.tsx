import { NavLink } from "react-router-dom";
import logoFbflix from "@/assets/logo-fbflix.png";
import { Shield, Zap, Users, Headphones, Star, ChevronRight, Globe, Lock, Clock, CheckCircle2 } from "lucide-react";

const stats = [
  { value: "+3.500", label: "Clientes Ativos", icon: Users },
  { value: "99.9%", label: "Uptime Garantido", icon: Zap },
  { value: "24/7", label: "Suporte Dedicado", icon: Headphones },
  { value: "+10k", label: "Pedidos Entregues", icon: CheckCircle2 },
];

const services = [
  {
    icon: Globe,
    title: "Assinaturas Digitais",
    description: "Acesse os melhores serviços digitais do mercado com preços acessíveis e entrega instantânea após a confirmação do pagamento.",
  },
  {
    icon: Shield,
    title: "Garantia de 7 Dias",
    description: "Todos os produtos possuem garantia de 7 dias. Se houver qualquer problema, resolvemos ou devolvemos seu dinheiro.",
  },
  {
    icon: Lock,
    title: "Pagamento Seguro",
    description: "Transações processadas com criptografia de ponta a ponta via PIX e outros métodos seguros de pagamento.",
  },
  {
    icon: Clock,
    title: "Entrega Automática",
    description: "Sistema automatizado que entrega seu produto em segundos após a confirmação do pagamento, sem espera.",
  },
];

const testimonials = [
  { name: "Lucas M.", text: "Serviço excelente! Comprei minha assinatura e recebi na hora. Suporte muito atencioso.", rating: 5 },
  { name: "Ana P.", text: "Já sou cliente há mais de 6 meses. Preço justo, qualidade impecável e nunca tive problemas.", rating: 5 },
  { name: "Carlos R.", text: "A garantia de 7 dias me deu confiança para comprar. Recomendo para todos!", rating: 5 },
];

export default function Sobre() {
  return (
    <div className="bg-background min-h-screen text-foreground">
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "FBFLIX",
            url: "https://fbflix.com.br",
            description: "Plataforma líder em assinaturas digitais com mais de 3.500 clientes ativos no Brasil.",
            contactPoint: {
              "@type": "ContactPoint",
              email: "equipefbflix@gmail.com",
              contactType: "customer service",
              availableLanguage: "Portuguese",
            },
          }),
        }}
      />

      {/* ═══ NAVBAR ═══ */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <NavLink to="/sobre" className="flex items-center gap-2.5">
            <img src={logoFbflix} alt="FBFLIX - Assinaturas Digitais" className="h-8 w-auto object-contain" />
            <span className="text-lg font-bold tracking-tight">FBFLIX</span>
          </NavLink>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#servicos" className="hover:text-foreground transition-colors">Serviços</a>
            <a href="#sobre" className="hover:text-foreground transition-colors">Sobre</a>
            <a href="#depoimentos" className="hover:text-foreground transition-colors">Depoimentos</a>
            <NavLink to="/termos" className="hover:text-foreground transition-colors">Termos</NavLink>
            <NavLink to="/privacidade" className="hover:text-foreground transition-colors">Privacidade</NavLink>
          </nav>
          <NavLink
            to="/auth"
            className="px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Acessar Plataforma
          </NavLink>
        </div>
      </header>

      {/* ═══ HERO ═══ */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
        {/* Glow effects */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-primary/5 rounded-full blur-[80px] pointer-events-none" />

        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-semibold mb-6">
            <Zap className="size-3.5" />
            Plataforma líder em assinaturas digitais
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
            Seus serviços digitais{" "}
            <span className="text-primary">com segurança</span> e entrega instantânea
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Mais de <strong className="text-foreground">3.500 clientes</strong> confiam na FBFLIX para acessar
            os melhores serviços digitais do mercado. Pagamento seguro, entrega automática e garantia de 7 dias.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <NavLink
              to="/auth"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all"
            >
              Começar Agora
              <ChevronRight className="size-4" />
            </NavLink>
            <a
              href="#servicos"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full border border-border bg-card text-foreground font-semibold text-sm hover:bg-secondary transition-colors"
            >
              Conheça Nossos Serviços
            </a>
          </div>
        </div>
      </section>

      {/* ═══ STATS ═══ */}
      <section className="py-12 border-y border-border bg-card/50">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <stat.icon className="size-6 text-primary mx-auto mb-2" />
              <p className="text-2xl md:text-3xl font-extrabold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground font-medium mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ SERVIÇOS ═══ */}
      <section id="servicos" className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-primary text-xs font-bold uppercase tracking-widest mb-2">Nossos Serviços</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Por que escolher a FBFLIX?
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {services.map((svc) => (
              <div
                key={svc.title}
                className="group p-6 rounded-2xl border border-border bg-card hover:border-primary/30 transition-all hover:-translate-y-1"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <svc.icon className="size-5 text-primary" />
                </div>
                <h3 className="text-lg font-bold mb-2">{svc.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{svc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SOBRE ═══ */}
      <section id="sobre" className="py-20 md:py-28 bg-card/50 border-y border-border">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-primary text-xs font-bold uppercase tracking-widest mb-2">Quem Somos</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Uma empresa séria no mercado digital
            </h2>
          </div>
          <div className="text-muted-foreground text-sm md:text-base leading-relaxed space-y-4 max-w-3xl mx-auto">
            <p>
              A <strong className="text-foreground">FBFLIX</strong> é uma plataforma brasileira especializada na comercialização
              de assinaturas e serviços digitais. Desde nossa fundação, construímos uma reputação sólida baseada em
              <strong className="text-foreground"> transparência, segurança e atendimento de excelência</strong>.
            </p>
            <p>
              Com mais de <strong className="text-foreground">3.500 clientes ativos</strong> e milhares de pedidos entregues
              com sucesso, nos consolidamos como referência no segmento. Nosso sistema de entrega automatizada garante que
              você receba seu produto em segundos, e nossa garantia de 7 dias oferece total tranquilidade em cada compra.
            </p>
            <p>
              Investimos continuamente em tecnologia, segurança e suporte ao cliente para oferecer a melhor experiência
              possível. Todos os pagamentos são processados com criptografia e nossa plataforma opera com políticas
              rígidas de privacidade em conformidade com a <strong className="text-foreground">LGPD</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* ═══ DEPOIMENTOS ═══ */}
      <section id="depoimentos" className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-primary text-xs font-bold uppercase tracking-widest mb-2">Depoimentos</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              O que nossos clientes dizem
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="p-6 rounded-2xl border border-border bg-card"
              >
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="size-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">"{t.text}"</p>
                <p className="text-sm font-semibold text-foreground">{t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="py-20 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
            Pronto para começar?
          </h2>
          <p className="text-muted-foreground text-sm md:text-base mb-8 max-w-xl mx-auto">
            Junte-se a mais de 3.500 clientes satisfeitos e tenha acesso aos melhores serviços digitais do mercado.
          </p>
          <NavLink
            to="/auth"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all"
          >
            Criar Minha Conta Grátis
            <ChevronRight className="size-4" />
          </NavLink>
        </div>
      </section>

      {/* ═══ TERMOS & PRIVACIDADE ═══ */}
      <section id="termos" className="py-20 md:py-28 border-t border-border">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-primary text-xs font-bold uppercase tracking-widest mb-2">Legal</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Termos e Políticas
            </h2>
            <p className="text-muted-foreground text-sm mt-3 max-w-lg mx-auto">
              Transparência é um dos nossos valores fundamentais. Leia nossos termos e políticas completas abaixo.
            </p>
          </div>

          {/* Tabs-style links */}
          <div className="flex flex-col sm:flex-row gap-4 mb-10">
            <a
              href="#termos-de-servico"
              className="flex-1 p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors text-center"
            >
              <span className="text-sm font-bold text-foreground">📋 Termos de Serviço</span>
            </a>
            <a
              href="#politica-privacidade"
              className="flex-1 p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors text-center"
            >
              <span className="text-sm font-bold text-foreground">🔒 Política de Privacidade</span>
            </a>
          </div>

          {/* Termos de Serviço */}
          <div id="termos-de-servico" className="mb-16">
            <h3 className="text-2xl font-bold mb-2">Termos de Serviço</h3>
            <p className="text-muted-foreground text-xs mb-8">Última atualização: 26 de fevereiro de 2026</p>

            <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
              <div>
                <h4 className="text-base font-semibold text-foreground mb-2">1. Aceitação dos Termos</h4>
                <p>Ao acessar e utilizar a plataforma <strong className="text-foreground">FBFLIX</strong>, você concorda em estar vinculado a estes Termos de Serviço. Caso não concorde com alguma disposição, não utilize a Plataforma.</p>
              </div>
              <div>
                <h4 className="text-base font-semibold text-foreground mb-2">2. Descrição do Serviço</h4>
                <p>A FBFLIX é uma plataforma digital que fornece acesso a produtos e serviços digitais, incluindo assinaturas, serviços de streaming e produtos relacionados. Os serviços são disponibilizados conforme estoque e disponibilidade.</p>
              </div>
              <div>
                <h4 className="text-base font-semibold text-foreground mb-2">3. Cadastro e Conta</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>O Usuário deve fornecer informações verdadeiras, completas e atualizadas.</li>
                  <li>Cada pessoa pode manter apenas uma conta na Plataforma.</li>
                  <li>O Usuário é responsável por manter a confidencialidade de suas credenciais.</li>
                  <li>É proibido compartilhar, vender ou transferir sua conta para terceiros.</li>
                </ul>
              </div>
              <div>
                <h4 className="text-base font-semibold text-foreground mb-2">4. Produtos e Entrega</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>Os produtos digitais são entregues automaticamente após a confirmação do pagamento.</li>
                  <li>Os dados ficam disponíveis na seção "Meus Pedidos" da plataforma.</li>
                  <li>A disponibilidade dos produtos está sujeita ao estoque.</li>
                </ul>
              </div>
              <div>
                <h4 className="text-base font-semibold text-foreground mb-2">5. Pagamentos</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>Os pagamentos são processados via PIX e outros métodos disponibilizados.</li>
                  <li>Os preços são exibidos em Reais (BRL) e podem ser alterados sem aviso prévio.</li>
                  <li>O saldo em carteira pode ser utilizado para compras na plataforma.</li>
                </ul>
              </div>
              <div className="p-5 rounded-2xl border border-primary/20 bg-primary/5">
                <h4 className="text-base font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Shield className="size-4 text-primary" />
                  6. Garantia de 7 Dias
                </h4>
                <p>Todos os produtos possuem <strong className="text-foreground">garantia de 7 dias corridos</strong>. A garantia cobre defeitos no produto entregue. Para acionar, abra um ticket de suporte dentro do prazo. A equipe oferecerá substituição, crédito ou reembolso conforme o caso.</p>
              </div>
              <div>
                <h4 className="text-base font-semibold text-foreground mb-2">7. Assinaturas e Reembolso</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>Assinaturas podem ser canceladas a qualquer momento pelo Usuário.</li>
                  <li>O cancelamento não gera reembolso proporcional do período já pago.</li>
                  <li>Reembolsos são concedidos exclusivamente dentro do período de garantia de 7 dias.</li>
                </ul>
              </div>
              <div>
                <h4 className="text-base font-semibold text-foreground mb-2">8. Obrigações do Usuário</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>Utilizar a plataforma de forma legal e ética.</li>
                  <li>Não revender ou redistribuir produtos sem autorização.</li>
                  <li>Manter seus dados cadastrais atualizados.</li>
                </ul>
              </div>
              <div>
                <h4 className="text-base font-semibold text-foreground mb-2">9. Foro e Legislação</h4>
                <p>Estes termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de Campinas/SP para dirimir quaisquer controvérsias.</p>
              </div>
            </div>
          </div>

          {/* Política de Privacidade */}
          <div id="politica-privacidade">
            <h3 className="text-2xl font-bold mb-2">Política de Privacidade</h3>
            <p className="text-muted-foreground text-xs mb-8">Última atualização: 26 de fevereiro de 2026</p>

            <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
              <div>
                <h4 className="text-base font-semibold text-foreground mb-2">1. Introdução</h4>
                <p>A <strong className="text-foreground">FBFLIX</strong> valoriza a privacidade de seus usuários. Esta Política descreve como coletamos, usamos, armazenamos e protegemos suas informações pessoais quando você utiliza nossos serviços.</p>
              </div>
              <div>
                <h4 className="text-base font-semibold text-foreground mb-2">2. Dados que Coletamos</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong className="text-foreground">Dados de Cadastro:</strong> nome, e-mail, telefone, CPF, data de nascimento, CEP e endereço.</li>
                  <li><strong className="text-foreground">Dados de Pagamento:</strong> transações via PIX processadas por intermediadores seguros.</li>
                  <li><strong className="text-foreground">Dados de Navegação:</strong> IP, navegador, páginas visitadas e cookies.</li>
                  <li><strong className="text-foreground">Dados de Uso:</strong> histórico de pedidos, assinaturas e interações.</li>
                </ul>
              </div>
              <div>
                <h4 className="text-base font-semibold text-foreground mb-2">3. Como Usamos seus Dados</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>Criar e gerenciar sua conta na plataforma.</li>
                  <li>Processar pedidos, pagamentos e assinaturas.</li>
                  <li>Fornecer suporte técnico e melhorar a experiência.</li>
                  <li>Garantir a segurança e prevenir fraudes.</li>
                  <li>Cumprir obrigações legais e regulatórias.</li>
                </ul>
              </div>
              <div>
                <h4 className="text-base font-semibold text-foreground mb-2">4. Compartilhamento e Segurança</h4>
                <p>Não vendemos suas informações pessoais. Dados podem ser compartilhados com processadores de pagamento e provedores de infraestrutura. Adotamos criptografia, RBAC e RLS para proteção de dados.</p>
              </div>
              <div>
                <h4 className="text-base font-semibold text-foreground mb-2">5. Seus Direitos (LGPD)</h4>
                <p>Conforme a Lei nº 13.709/2018, você pode acessar, corrigir, solicitar exclusão ou portabilidade de seus dados a qualquer momento entrando em contato pelo suporte.</p>
              </div>
              <div>
                <h4 className="text-base font-semibold text-foreground mb-2">6. Contato</h4>
                <div className="p-4 rounded-xl bg-card border border-border">
                  <p className="text-foreground font-medium">FBFLIX</p>
                  <p className="mt-1">E-mail: <span className="text-primary">equipefbflix@gmail.com</span></p>
                  <p>Suporte: através da plataforma (seção Suporte)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="py-10 border-t border-border bg-card/30">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <img src={logoFbflix} alt="FBFLIX" className="h-7 w-auto object-contain" />
              <span className="text-sm font-bold">FBFLIX</span>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-xs text-muted-foreground">
              <a href="#servicos" className="hover:text-foreground transition-colors">Serviços</a>
              <a href="#sobre" className="hover:text-foreground transition-colors">Sobre</a>
              <NavLink to="/termos" className="hover:text-foreground transition-colors">Termos de Serviço</NavLink>
              <NavLink to="/privacidade" className="hover:text-foreground transition-colors">Política de Privacidade</NavLink>
              <NavLink to="/auth" className="hover:text-foreground transition-colors">Login</NavLink>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} FBFLIX. Todos os direitos reservados. CNPJ: 40.122.096/0001-85
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
