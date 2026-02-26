import { useNavigate } from "react-router-dom";

export default function PrivacyPolicy() {
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
            <span className="material-symbols-outlined text-primary text-2xl">play_circle</span>
            <h1 className="text-lg font-bold">FBFLIX <span className="text-primary">2.0</span></h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Política de Privacidade</h1>
        <p className="text-muted-foreground text-sm mb-8">Última atualização: 26 de fevereiro de 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Introdução</h2>
            <p>
              A <strong className="text-foreground">FBFLIX</strong> ("nós", "nosso" ou "Plataforma") valoriza a privacidade de seus usuários ("você" ou "Usuário"). 
              Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações pessoais 
              quando você utiliza nossos serviços e plataforma digital.
            </p>
            <p className="mt-2">
              Ao utilizar a FBFLIX, você concorda com as práticas descritas nesta política. 
              Recomendamos a leitura atenta deste documento.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Dados que Coletamos</h2>
            <p>Podemos coletar os seguintes tipos de informações:</p>
            <ul className="list-disc list-inside mt-2 space-y-1.5">
              <li><strong className="text-foreground">Dados de Cadastro:</strong> nome completo, endereço de e-mail, telefone, CPF, data de nascimento, CEP e endereço.</li>
              <li><strong className="text-foreground">Dados de Autenticação:</strong> credenciais de login (e-mail e senha criptografada).</li>
              <li><strong className="text-foreground">Dados de Pagamento:</strong> informações de transações via PIX e outros métodos de pagamento, processados por intermediadores seguros (ex.: MercadoPago).</li>
              <li><strong className="text-foreground">Dados de Navegação:</strong> endereço IP, tipo de navegador, páginas visitadas, horários de acesso e cookies.</li>
              <li><strong className="text-foreground">Dados de Suporte:</strong> mensagens enviadas via tickets de suporte e anexos.</li>
              <li><strong className="text-foreground">Dados de Uso:</strong> histórico de pedidos, assinaturas, preferências e interações com a plataforma.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Como Usamos seus Dados</h2>
            <p>Utilizamos suas informações para:</p>
            <ul className="list-disc list-inside mt-2 space-y-1.5">
              <li>Criar e gerenciar sua conta na plataforma.</li>
              <li>Processar pedidos, pagamentos e assinaturas.</li>
              <li>Fornecer suporte técnico e atendimento ao cliente.</li>
              <li>Enviar notificações sobre pedidos, atualizações e promoções.</li>
              <li>Melhorar a experiência do usuário e funcionalidades da plataforma.</li>
              <li>Garantir a segurança da plataforma e prevenir fraudes.</li>
              <li>Cumprir obrigações legais e regulatórias.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Compartilhamento de Dados</h2>
            <p>Não vendemos suas informações pessoais. Podemos compartilhar dados com:</p>
            <ul className="list-disc list-inside mt-2 space-y-1.5">
              <li><strong className="text-foreground">Processadores de pagamento:</strong> para efetuar transações financeiras de forma segura.</li>
              <li><strong className="text-foreground">Provedores de infraestrutura:</strong> serviços de hospedagem e banco de dados para operar a plataforma.</li>
              <li><strong className="text-foreground">Autoridades competentes:</strong> quando exigido por lei ou ordem judicial.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Armazenamento e Segurança</h2>
            <p>
              Seus dados são armazenados em servidores seguros com criptografia. Adotamos medidas técnicas e organizacionais 
              para proteger suas informações contra acesso não autorizado, perda, alteração ou destruição, incluindo:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1.5">
              <li>Criptografia de senhas e dados sensíveis.</li>
              <li>Controle de acesso baseado em funções (RBAC).</li>
              <li>Políticas de segurança em nível de linha (RLS) no banco de dados.</li>
              <li>Monitoramento contínuo de acessos e atividades.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Cookies</h2>
            <p>
              Utilizamos cookies e tecnologias semelhantes para manter sua sessão ativa, lembrar suas preferências 
              e melhorar a experiência na plataforma. Você pode gerenciar cookies nas configurações do seu navegador, 
              mas isso pode afetar a funcionalidade do serviço.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Seus Direitos (LGPD)</h2>
            <p>De acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem direito a:</p>
            <ul className="list-disc list-inside mt-2 space-y-1.5">
              <li>Confirmar a existência de tratamento de seus dados pessoais.</li>
              <li>Acessar, corrigir ou atualizar seus dados.</li>
              <li>Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários.</li>
              <li>Revogar o consentimento a qualquer momento.</li>
              <li>Solicitar a portabilidade dos dados.</li>
              <li>Ser informado sobre com quem seus dados são compartilhados.</li>
            </ul>
            <p className="mt-2">
              Para exercer esses direitos, entre em contato conosco através do suporte da plataforma ou pelo e-mail indicado abaixo.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Retenção de Dados</h2>
            <p>
              Mantemos seus dados pessoais enquanto sua conta estiver ativa ou conforme necessário para 
              prestar nossos serviços. Dados podem ser retidos por períodos adicionais para cumprimento 
              de obrigações legais, resolução de disputas ou conforme permitido por lei.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">9. Menores de Idade</h2>
            <p>
              A FBFLIX não se destina a menores de 18 anos. Não coletamos intencionalmente dados de menores. 
              Se tomarmos conhecimento de que coletamos dados de um menor, tomaremos medidas para excluir 
              essas informações.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">10. Alterações nesta Política</h2>
            <p>
              Reservamo-nos o direito de atualizar esta Política de Privacidade a qualquer momento. 
              Alterações significativas serão comunicadas por meio de notificação na plataforma ou por e-mail. 
              O uso continuado após as alterações constitui aceitação da nova política.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">11. Contato</h2>
            <p>
              Para dúvidas, solicitações ou reclamações sobre esta Política de Privacidade ou o 
              tratamento de seus dados pessoais, entre em contato:
            </p>
            <div className="mt-3 p-4 rounded-xl bg-card border border-border">
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
