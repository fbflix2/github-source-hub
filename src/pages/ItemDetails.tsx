import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

interface ItemDetailsData {
  orderId: string;
  orderDate: string;
  itemName: string;
  itemDescription: string;
  features: string[];
  loginEmail: string;
  password: string;
  code2FA: string;
  feedbackDeadline: {
    hours: number;
    minutes: number;
    seconds: number;
  };
}

// Mock data - in production this would come from an API
const mockItemData: ItemDetailsData = {
  orderId: "#ORD-2023-882",
  orderDate: "20 Out 2023",
  itemName: "Perfil Farmado (Alta Qualidade)",
  itemDescription: "Este perfil foi farmado manualmente por 30 dias com interações reais. Possui cookies aquecidos e está pronto para anunciar.",
  features: [
    "Conta com 2FA ativado",
    "Amigos e postagens reais",
    "Marketplace Ativo",
    "Ads Manager intacto"
  ],
  loginEmail: "usuario_farmado882@fbflix.com",
  password: "senha_secreta_123",
  code2FA: "AABB CCDD EEFF GGHH",
  feedbackDeadline: {
    hours: 18,
    minutes: 42,
    seconds: 15
  }
};

export default function ItemDetails() {
  const navigate = useNavigate();
  const { orderId, itemId } = useParams();
  const [showPassword, setShowPassword] = useState(false);
  const [countdown, setCountdown] = useState(mockItemData.feedbackDeadline);
  const [copied, setCopied] = useState<string | null>(null);
  const [itemStatus, setItemStatus] = useState(false);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        let { hours, minutes, seconds } = prev;
        if (seconds > 0) {
          seconds--;
        } else if (minutes > 0) {
          minutes--;
          seconds = 59;
        } else if (hours > 0) {
          hours--;
          minutes = 59;
          seconds = 59;
        }
        return { hours, minutes, seconds };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  // Calculate progress percentage based on remaining time (24h = 100%)
  const totalSeconds = countdown.hours * 3600 + countdown.minutes * 60 + countdown.seconds;
  const progressPercent = (totalSeconds / (24 * 3600)) * 100;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm text-text-secondary mb-1">
            <a 
              onClick={() => navigate("/orders")} 
              className="hover:text-foreground transition-colors cursor-pointer"
            >
              Meus Pedidos
            </a>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-foreground">Detalhes do Item</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">Detalhes do Item</h1>
          <p className="text-xl text-primary font-medium">{mockItemData.itemName}</p>
        </div>
        <button 
          onClick={() => navigate("/orders")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl glass-panel text-foreground hover:bg-muted/50 transition-all w-fit group"
        >
          <span className="material-symbols-outlined text-[20px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
          <span>Voltar para Pedidos</span>
        </button>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Item Details Card */}
          <div className="glass-panel rounded-2xl p-6 md:p-8 relative overflow-hidden">
            {/* Decorative blur */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
            
            {/* Order Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-border pb-6">
              <div>
                <span className="text-xs uppercase tracking-wider text-text-secondary font-bold">Número do Pedido</span>
                <h2 className="text-2xl font-mono font-bold text-foreground mt-1">{mockItemData.orderId}</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 text-xs font-bold uppercase tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                  Entregue
                </span>
                <span className="text-sm text-text-secondary">{mockItemData.orderDate}</span>
              </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Item Description */}
              <div>
                <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">description</span>
                  Detalhes do Item
                </h3>
                <div className="space-y-3 text-text-secondary text-sm leading-relaxed">
                  <p>{mockItemData.itemDescription}</p>
                  <ul className="space-y-2 mt-4">
                    {mockItemData.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Access Data */}
              <div className="bg-muted/30 rounded-xl p-5 border border-border">
                <h3 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">Dados de Acesso</h3>
                <div className="space-y-4">
                  {/* Email */}
                  <div>
                    <label className="text-xs text-text-secondary mb-1 block">Login / Email</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-background/50 px-3 py-2 rounded border border-border text-sm font-mono text-foreground">
                        {mockItemData.loginEmail}
                      </code>
                      <button 
                        onClick={() => copyToClipboard(mockItemData.loginEmail, 'email')}
                        className="p-2 rounded bg-muted/50 hover:bg-muted transition-colors text-text-secondary hover:text-foreground"
                        title="Copiar"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {copied === 'email' ? 'check' : 'content_copy'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="text-xs text-text-secondary mb-1 block">Senha</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-background/50 px-3 py-2 rounded border border-border text-sm font-mono text-foreground">
                        {showPassword ? mockItemData.password : "***********"}
                      </code>
                      <button 
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-2 rounded bg-muted/50 hover:bg-muted transition-colors text-text-secondary hover:text-foreground"
                        title="Mostrar"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {showPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                      <button 
                        onClick={() => copyToClipboard(mockItemData.password, 'password')}
                        className="p-2 rounded bg-muted/50 hover:bg-muted transition-colors text-text-secondary hover:text-foreground"
                        title="Copiar"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {copied === 'password' ? 'check' : 'content_copy'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* 2FA Code */}
                  <div>
                    <label className="text-xs text-text-secondary mb-1 block">Código 2FA</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-background/50 px-3 py-2 rounded border border-border text-sm font-mono text-foreground">
                        {mockItemData.code2FA}
                      </code>
                      <button 
                        onClick={() => copyToClipboard(mockItemData.code2FA, '2fa')}
                        className="p-2 rounded bg-muted/50 hover:bg-muted transition-colors text-text-secondary hover:text-foreground"
                        title="Copiar"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {copied === '2fa' ? 'check' : 'content_copy'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Download Button */}
                <div className="mt-4 pt-4 border-t border-border">
                  <button className="w-full py-2.5 bg-primary text-background font-bold rounded-lg hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-glow">
                    <span className="material-symbols-outlined">cloud_download</span>
                    Baixar Cookies e Backup
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Item Management Card */}
          <div className="glass-panel rounded-2xl p-6 md:p-8">
            <h3 className="text-lg font-bold text-foreground mb-6">Gerenciamento do Item</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Status Toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border">
                <div>
                  <span className="block text-foreground font-medium mb-1">Status do Item</span>
                  <span className="text-xs text-text-secondary">Controle interno para sua gestão</span>
                </div>
                <button
                  onClick={() => setItemStatus(!itemStatus)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    itemStatus ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span 
                    className={`absolute top-1 w-4 h-4 bg-foreground rounded-full transition-all ${
                      itemStatus ? 'right-1' : 'left-1'
                    }`}
                  ></span>
                </button>
              </div>

              {/* Report OK */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border">
                <div>
                  <span className="block text-foreground font-medium mb-1">Item Funcionando?</span>
                  <span className="text-xs text-text-secondary">Confirme que está tudo certo</span>
                </div>
                <button className="px-4 py-2 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 font-semibold hover:bg-green-500/30 transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">thumb_up</span>
                  Reportar OK
                </button>
              </div>

              {/* Report Problem */}
              <div className="md:col-span-2 flex items-center justify-between p-4 rounded-xl bg-danger/10 border border-danger/20 group hover:bg-danger/15 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-danger/20 flex items-center justify-center text-danger">
                    <span className="material-symbols-outlined">report_problem</span>
                  </div>
                  <div>
                    <span className="block text-foreground font-bold mb-1">Reportar Bloqueio</span>
                    <span className="text-xs text-text-secondary group-hover:text-foreground/80 transition-colors">O item veio bloqueado ou com problemas?</span>
                  </div>
                </div>
                <button className="px-5 py-2.5 rounded-lg bg-danger text-danger-foreground font-bold hover:brightness-110 shadow-[0_0_15px_rgba(255,59,48,0.3)] transition-all flex items-center gap-2">
                  Reportar Problema
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Feedback Timer */}
          <div className="glass-panel rounded-2xl p-6 bg-gradient-to-br from-muted/30 to-primary/5 border-primary/20">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-primary text-2xl">timer</span>
              <h3 className="text-lg font-bold text-foreground">Tempo de Feedback</h3>
            </div>
            <p className="text-sm text-text-secondary mb-6">Você tem 24 horas após a compra para testar o item e reportar qualquer problema.</p>
            
            {/* Countdown */}
            <div className="flex justify-center gap-4 mb-4">
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-lg bg-background/50 border border-border flex items-center justify-center text-2xl font-mono font-bold text-foreground">
                  {countdown.hours.toString().padStart(2, '0')}
                </div>
                <span className="text-[10px] uppercase text-text-secondary mt-1">Horas</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-lg bg-background/50 border border-border flex items-center justify-center text-2xl font-mono font-bold text-foreground">
                  {countdown.minutes.toString().padStart(2, '0')}
                </div>
                <span className="text-[10px] uppercase text-text-secondary mt-1">Min</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-lg bg-background/50 border border-border flex items-center justify-center text-2xl font-mono font-bold text-foreground">
                  {countdown.seconds.toString().padStart(2, '0')}
                </div>
                <span className="text-[10px] uppercase text-text-secondary mt-1">Seg</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full shadow-glow transition-all duration-1000"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>

          {/* Warranty */}
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-blue-400 text-2xl">verified_user</span>
              <h3 className="text-lg font-bold text-foreground">Garantia de Reposição</h3>
            </div>
            <div className="text-sm text-text-secondary space-y-3 mb-6">
              <p>Cobrimos bloqueios imediatos, falhas no login ou itens que não correspondam à descrição.</p>
              <p className="text-xs italic opacity-70">Nota: Não cobrimos mau uso ou bloqueios após atividade publicitária.</p>
            </div>
            <button className="w-full py-3 rounded-xl border border-border hover:bg-muted/50 text-foreground font-medium flex items-center justify-center gap-2 transition-all group">
              <span className="material-symbols-outlined group-hover:text-primary transition-colors">play_circle</span>
              Assistir Termos de Garantia
            </button>
          </div>

          {/* Support */}
          <div className="glass-panel rounded-2xl p-6">
            <h3 className="text-foreground font-bold mb-4">Precisa de Ajuda?</h3>
            <p className="text-sm text-text-secondary mb-4">Nossa equipe de suporte está online para ajudar com este item.</p>
            <button className="w-full py-2.5 rounded-lg bg-muted/50 hover:bg-muted text-foreground border border-border transition-colors flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-lg">support_agent</span>
              Abrir Chat de Suporte
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
