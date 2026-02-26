import { useNavigate } from "react-router-dom";
import logoFbflix from "@/assets/logo-fbflix.png";

export default function TermsOfService() {
  const navigate = useNavigate();

  return (
    <div className="bg-background min-h-screen text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
          >
            <span className="material-symbols-outlined text-foreground text-[20px]">arrow_back</span>
          </button>
          <div className="flex items-center gap-2">
            <img src={logoFbflix} alt="FBFLIX" className="w-7 h-7 object-contain" />
            <h1 className="text-lg font-bold">FBFLIX <span className="text-primary">2.0</span></h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Termos de Serviço</h1>
        <p className="text-muted-foreground text-sm mb-8">Última atualização: 26 de fevereiro de 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Aceitação dos Termos</h2>
            <p>
              Ao acessar e utilizar a plataforma <strong className="text-foreground">FBFLIX</strong> ("Plataforma", "nós" ou "nosso"), 
              você ("Usuário" ou "Cliente") concorda em estar vinculado a estes Termos de Serviço. 
              Caso não concorde com alguma disposição, não utilize a Plataforma.
            </p>
            <p className="mt-2">
              O uso continuado da Plataforma após eventuais atualizações constitui aceitação das alterações realizadas.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Descrição do Serviço</h2>
            <p>
              A FBFLIX é uma plataforma digital que fornece acesso a produtos e serviços digitais, 
              incluindo mas não limitado a: contas digitais, assinaturas, serviços de streaming e produtos relacionados. 
              Os serviços são disponibilizados conforme estoque e disponibilidade.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Cadastro e Conta</h2>
            <ul className="list-disc list-inside space-y-1.5">
              <li>O Usuário deve fornecer informações verdadeiras, completas e atualizadas no cadastro.</li>
              <li>Cada pessoa pode manter apenas uma conta na Plataforma.</li>
              <li>O Usuário é responsável por manter a confidencialidade de suas credenciais de acesso.</li>
              <li>É proibido compartilhar, vender ou transferir sua conta para terceiros.</li>
              <li>A FBFLIX reserva-se o direito de suspender ou encerrar contas que violem estes termos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Produtos e Entrega</h2>
            <ul className="list-disc list-inside space-y-1.5">
              <li>Os produtos digitais são entregues automaticamente após a confirmação do pagamento.</li>
              <li>Os dados de acesso do produto ficam disponíveis na seção "Meus Pedidos" da plataforma.</li>
              <li>Imagens e descrições são meramente ilustrativas e podem sofrer alterações sem aviso prévio.</li>
              <li>A disponibilidade dos produtos está sujeita ao estoque.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Pagamentos</h2>
            <ul className="list-disc list-inside space-y-1.5">
              <li>Os pagamentos são processados via PIX e outros métodos disponibilizados na plataforma.</li>
              <li>Os preços são exibidos em Reais (BRL) e podem ser alterados sem aviso prévio.</li>
              <li>Cupons de desconto podem ser utilizados conforme suas regras específicas de validade e uso.</li>
              <li>O saldo em carteira pode ser utilizado para compras na plataforma.</li>
            </ul>
          </section>

          <section className="p-5 rounded-2xl bg-card border border-primary/20">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">verified_user</span>
              6. Garantia de 7 Dias
            </h2>
            <p>
              Todos os produtos adquiridos na FBFLIX possuem <strong className="text-foreground">garantia de 7 (sete) dias corridos</strong>, 
              contados a partir da data de entrega (confirmação do pedido). Durante este período:
            </p>
            <ul className="list-disc list-inside mt-3 space-y-2">
              <li>
                <strong className="text-foreground">Cobertura:</strong> a garantia cobre defeitos no produto entregue, 
                como credenciais inválidas, produto diferente do anunciado ou impossibilidade de acesso ao serviço por falha nossa.
              </li>
              <li>
                <strong className="text-foreground">Solicitação:</strong> para acionar a garantia, o Usuário deve abrir um ticket 
                de suporte na plataforma dentro do prazo de 7 dias, descrevendo o problema detalhadamente.
              </li>
              <li>
                <strong className="text-foreground">Resolução:</strong> a equipe analisará a solicitação e poderá oferecer: 
                substituição do produto, crédito em carteira ou reembolso, conforme o caso.
              </li>
              <li>
                <strong className="text-foreground">Exclusões:</strong> a garantia NÃO cobre:
                <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
                  <li>Alterações realizadas pelo Usuário no produto após a entrega (troca de senhas, e-mails, etc.).</li>
                  <li>Uso indevido, compartilhamento ou violação dos termos do serviço original.</li>
                  <li>Problemas causados por bloqueio decorrente de atividades do Usuário.</li>
                  <li>Solicitações realizadas após o prazo de 7 dias.</li>
                </ul>
              </li>
              <li>
                <strong className="text-foreground">Prazo de análise:</strong> as solicitações de garantia serão analisadas 
                em até 48 horas úteis após a abertura do ticket.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Assinaturas</h2>
            <ul className="list-disc list-inside space-y-1.5">
              <li>Assinaturas são renováveis e podem ser canceladas a qualquer momento pelo Usuário.</li>
              <li>O cancelamento não gera reembolso proporcional do período já pago.</li>
              <li>O acesso ao serviço continua até o final do período de faturamento corrente.</li>
              <li>A renovação automática pode ser desativada nas configurações da assinatura.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Política de Reembolso</h2>
            <ul className="list-disc list-inside space-y-1.5">
              <li>Reembolsos são concedidos exclusivamente dentro do período de garantia de 7 dias.</li>
              <li>O reembolso pode ser realizado via crédito em carteira na plataforma ou estorno, conforme análise.</li>
              <li>Não serão concedidos reembolsos para produtos já utilizados ou alterados pelo Usuário.</li>
              <li>Fraudes ou tentativas de abuso resultarão na suspensão da conta e perda do direito a reembolso.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">9. Obrigações do Usuário</h2>
            <p>O Usuário se compromete a:</p>
            <ul className="list-disc list-inside mt-2 space-y-1.5">
              <li>Utilizar a plataforma e os produtos de forma legal e ética.</li>
              <li>Não revender, redistribuir ou compartilhar produtos adquiridos sem autorização.</li>
              <li>Não utilizar ferramentas automatizadas para acessar a plataforma.</li>
              <li>Manter seus dados cadastrais atualizados.</li>
              <li>Não realizar atividades que possam prejudicar a plataforma ou outros usuários.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">10. Propriedade Intelectual</h2>
            <p>
              Todo o conteúdo da plataforma FBFLIX, incluindo design, logotipos, textos, imagens e software, 
              é protegido por direitos autorais e propriedade intelectual. É proibida a reprodução, 
              distribuição ou uso não autorizado de qualquer conteúdo da plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">11. Limitação de Responsabilidade</h2>
            <ul className="list-disc list-inside space-y-1.5">
              <li>A FBFLIX não se responsabiliza por interrupções ou falhas de serviços de terceiros.</li>
              <li>Não garantimos disponibilidade ininterrupta da plataforma.</li>
              <li>A FBFLIX não se responsabiliza por perdas indiretas decorrentes do uso dos produtos.</li>
              <li>O Usuário é o único responsável pelo uso que faz dos produtos adquiridos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">12. Suspensão e Encerramento</h2>
            <p>A FBFLIX pode suspender ou encerrar a conta do Usuário nos seguintes casos:</p>
            <ul className="list-disc list-inside mt-2 space-y-1.5">
              <li>Violação destes Termos de Serviço.</li>
              <li>Atividades fraudulentas ou abusivas.</li>
              <li>Uso indevido do sistema de garantia ou suporte.</li>
              <li>Solicitação do próprio Usuário.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">13. Alterações nos Termos</h2>
            <p>
              Reservamo-nos o direito de modificar estes Termos de Serviço a qualquer momento. 
              Alterações significativas serão comunicadas por meio de notificação na plataforma. 
              O uso continuado após as alterações constitui aceitação dos novos termos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">14. Foro e Legislação Aplicável</h2>
            <p>
              Estes termos são regidos pelas leis da República Federativa do Brasil. 
              Fica eleito o foro da comarca de Campinas/SP para dirimir quaisquer controvérsias 
              decorrentes destes Termos de Serviço.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">15. Contato</h2>
            <div className="p-4 rounded-xl bg-card border border-border">
              <p className="text-foreground font-medium">FBFLIX</p>
              <p className="mt-1">E-mail: <span className="text-primary">equipefbflix@gmail.com</span></p>
              <p>Suporte: através da plataforma (seção Suporte)</p>
            </div>
          </section>
        </div>

        {/* Back button */}
        <div className="mt-10 pb-8 flex justify-center">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-medium text-sm transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
