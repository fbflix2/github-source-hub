import { useNavigate, Link } from "react-router-dom";
import logoFbflix from "@/assets/logo-fbflix.webp";

export default function CookiePolicy() {
  const navigate = useNavigate();
  return (
    <div className="bg-background min-h-screen text-foreground">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80">
            <span className="material-symbols-outlined text-foreground text-[20px]">arrow_back</span>
          </button>
          <img src={logoFbflix} alt="FBFLIX" className="w-7 h-7 object-contain" />
        </div>
      </div>
      <div className="container max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Política de Cookies</h1>
        <p className="text-muted-foreground text-sm mb-8">Última atualização: 26 de junho de 2026</p>
        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. O que são cookies</h2>
            <p>Cookies são pequenos arquivos de texto armazenados no seu dispositivo quando você visita um site. Eles ajudam a manter sua sessão ativa, lembrar preferências e medir o uso da plataforma. Esta política deve ser lida em conjunto com a nossa <Link to="/privacidade" className="text-primary underline">Política de Privacidade</Link>.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Categorias de cookies que usamos</h2>
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-card border border-border">
                <p className="font-semibold text-foreground">Necessários (sempre ativos)</p>
                <p className="mt-1">Indispensáveis para login, carrinho, checkout, segurança contra fraude e prevenção de abuso. Sem eles a plataforma não funciona. Base legal: execução de contrato.</p>
                <p className="mt-2 text-xs">Exemplos: <code>sb-*</code> (sessão Supabase), <code>fbflix_cookie_consent_v1</code> (suas escolhas), tokens CSRF.</p>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border">
                <p className="font-semibold text-foreground">Analíticos (opcional)</p>
                <p className="mt-1">Medem visitas, páginas mais acessadas e desempenho. Usados para melhorar a experiência. Base legal: consentimento.</p>
              </div>
              <div className="p-4 rounded-xl bg-card border border-border">
                <p className="font-semibold text-foreground">Marketing (opcional)</p>
                <p className="mt-1">Personalizam anúncios e medem campanhas (ex.: Pixel do Facebook configurado por parceiros). Só são ativados após seu consentimento. Base legal: consentimento.</p>
              </div>
            </div>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Como gerenciar suas preferências</h2>
            <p>Você pode revogar ou alterar seu consentimento a qualquer momento limpando o cookie <code>fbflix_cookie_consent_v1</code> do navegador — o banner será exibido novamente na próxima visita. Também é possível bloquear cookies diretamente nas configurações do seu navegador.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Cookies de terceiros</h2>
            <p>Alguns parceiros podem inserir cookies próprios quando seus serviços são utilizados (MercadoPago no pagamento, WhatsApp Business para suporte, Meta/Facebook em pixels ativados por parceiros). Esses cookies são regidos pelas políticas de privacidade de cada terceiro.</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Contato</h2>
            <p>Encarregado de Dados (DPO): <span className="text-primary">equipefbflix@gmail.com</span></p>
          </section>
        </div>
      </div>
    </div>
  );
}