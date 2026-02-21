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
    <div className="space-y-3 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-text-secondary mb-0.5">
            <a onClick={() => navigate("/orders")} className="hover:text-foreground transition-colors cursor-pointer">Meus Pedidos</a>
            <span className="material-symbols-outlined text-[12px]">chevron_right</span>
            <span className="text-foreground">Detalhes do Item</span>
          </div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">{mockItemData.itemName}</h1>
        </div>
        <button 
          onClick={() => navigate("/orders")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-panel text-foreground hover:bg-muted/50 transition-all text-sm group"
        >
          <span className="material-symbols-outlined text-[16px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
          <span>Voltar</span>
        </button>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          {/* Item Details Card */}
          <div className="glass-panel rounded-xl p-4 relative overflow-hidden">
            {/* Order Header */}
            <div className="flex justify-between items-center mb-3 pb-3 border-b border-border">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-text-secondary font-bold">Pedido</span>
                <h2 className="text-lg font-mono font-bold text-foreground">{mockItemData.orderId}</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/10 text-green-400 border border-green-500/20 text-[10px] font-bold uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                  Entregue
                </span>
                <span className="text-xs text-text-secondary">{mockItemData.orderDate}</span>
              </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Item Description */}
              <div>
                <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[16px]">description</span>
                  Detalhes do Item
                </h3>
                <p className="text-text-secondary text-xs leading-relaxed mb-2">{mockItemData.itemDescription}</p>
                <ul className="space-y-1">
                  {mockItemData.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <span className="material-symbols-outlined text-primary text-[14px]">check_circle</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Access Data */}
              <div className="bg-muted/30 rounded-lg p-3 border border-border">
                <h3 className="text-[10px] font-bold text-foreground mb-2 uppercase tracking-wider">Dados de Acesso</h3>
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-text-secondary mb-0.5 block">Login / Email</label>
                    <div className="flex items-center gap-1">
                      <code className="flex-1 bg-background/50 px-2 py-1.5 rounded border border-border text-xs font-mono text-foreground">{mockItemData.loginEmail}</code>
                      <button onClick={() => copyToClipboard(mockItemData.loginEmail, 'email')} className="p-1.5 rounded bg-muted/50 hover:bg-muted transition-colors text-text-secondary hover:text-foreground">
                        <span className="material-symbols-outlined text-[14px]">{copied === 'email' ? 'check' : 'content_copy'}</span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-text-secondary mb-0.5 block">Senha</label>
                    <div className="flex items-center gap-1">
                      <code className="flex-1 bg-background/50 px-2 py-1.5 rounded border border-border text-xs font-mono text-foreground">{showPassword ? mockItemData.password : "***********"}</code>
                      <button onClick={() => setShowPassword(!showPassword)} className="p-1.5 rounded bg-muted/50 hover:bg-muted transition-colors text-text-secondary hover:text-foreground">
                        <span className="material-symbols-outlined text-[14px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                      </button>
                      <button onClick={() => copyToClipboard(mockItemData.password, 'password')} className="p-1.5 rounded bg-muted/50 hover:bg-muted transition-colors text-text-secondary hover:text-foreground">
                        <span className="material-symbols-outlined text-[14px]">{copied === 'password' ? 'check' : 'content_copy'}</span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-text-secondary mb-0.5 block">Código 2FA</label>
                    <div className="flex items-center gap-1">
                      <code className="flex-1 bg-background/50 px-2 py-1.5 rounded border border-border text-xs font-mono text-foreground">{mockItemData.code2FA}</code>
                      <button onClick={() => copyToClipboard(mockItemData.code2FA, '2fa')} className="p-1.5 rounded bg-muted/50 hover:bg-muted transition-colors text-text-secondary hover:text-foreground">
                        <span className="material-symbols-outlined text-[14px]">{copied === '2fa' ? 'check' : 'content_copy'}</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-border">
                  <button className="w-full py-2 bg-primary text-background font-bold rounded-lg hover:brightness-110 transition-all flex items-center justify-center gap-1.5 text-sm shadow-glow">
                    <span className="material-symbols-outlined text-[16px]">cloud_download</span>
                    Baixar Cookies e Backup
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Item Management Card */}
          <div className="glass-panel rounded-xl p-4">
            <h3 className="text-sm font-bold text-foreground mb-3">Gerenciamento do Item</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                <div>
                  <span className="block text-foreground text-xs font-medium">Status do Item</span>
                  <span className="text-[10px] text-text-secondary">Controle interno</span>
                </div>
                <button onClick={() => setItemStatus(!itemStatus)} className={`relative w-10 h-5 rounded-full transition-colors ${itemStatus ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-foreground rounded-full transition-all ${itemStatus ? 'right-0.5' : 'left-0.5'}`}></span>
                </button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                <div>
                  <span className="block text-foreground text-xs font-medium">Funcionando?</span>
                  <span className="text-[10px] text-text-secondary">Confirme que está OK</span>
                </div>
                <button className="px-3 py-1.5 rounded-md bg-green-500/20 text-green-400 border border-green-500/30 font-semibold hover:bg-green-500/30 transition-colors flex items-center gap-1 text-xs">
                  <span className="material-symbols-outlined text-[16px]">thumb_up</span>
                  OK
                </button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-danger/10 border border-danger/20 group hover:bg-danger/15 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-danger text-[18px]">report_problem</span>
                  <span className="text-foreground text-xs font-bold">Bloqueio?</span>
                </div>
                <button className="px-3 py-1.5 rounded-md bg-danger text-danger-foreground font-bold hover:brightness-110 transition-all text-xs">
                  Reportar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          {/* Feedback Timer */}
          <div className="glass-panel rounded-xl p-4 bg-gradient-to-br from-muted/30 to-primary/5 border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-primary text-lg">timer</span>
              <h3 className="text-sm font-bold text-foreground">Tempo de Feedback</h3>
            </div>
            <p className="text-xs text-text-secondary mb-3">24h para testar e reportar problemas.</p>
            <div className="flex justify-center gap-3 mb-3">
              {[
                { val: countdown.hours, label: 'Horas' },
                { val: countdown.minutes, label: 'Min' },
                { val: countdown.seconds, label: 'Seg' },
              ].map((t) => (
                <div key={t.label} className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-lg bg-background/50 border border-border flex items-center justify-center text-xl font-mono font-bold text-foreground">
                    {t.val.toString().padStart(2, '0')}
                  </div>
                  <span className="text-[9px] uppercase text-text-secondary mt-0.5">{t.label}</span>
                </div>
              ))}
            </div>
            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full shadow-glow transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
            </div>
          </div>

          {/* Warranty */}
          <div className="glass-panel rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-blue-400 text-lg">verified_user</span>
              <h3 className="text-sm font-bold text-foreground">Garantia de Reposição</h3>
            </div>
            <p className="text-xs text-text-secondary mb-1">Cobrimos bloqueios imediatos, falhas no login ou itens fora da descrição.</p>
            <p className="text-[10px] italic text-text-secondary/70 mb-3">Não cobrimos mau uso ou bloqueios após atividade publicitária.</p>
            <button className="w-full py-2 rounded-lg border border-border hover:bg-muted/50 text-foreground text-xs font-medium flex items-center justify-center gap-1.5 transition-all group">
              <span className="material-symbols-outlined text-[16px] group-hover:text-primary transition-colors">play_circle</span>
              Assistir Termos de Garantia
            </button>
          </div>

          {/* Support */}
          <div className="glass-panel rounded-xl p-4">
            <h3 className="text-foreground text-sm font-bold mb-1">Precisa de Ajuda?</h3>
            <p className="text-xs text-text-secondary mb-2">Suporte online para este item.</p>
            <button className="w-full py-2 rounded-lg bg-muted/50 hover:bg-muted text-foreground border border-border transition-colors flex items-center justify-center gap-1.5 text-xs">
              <span className="material-symbols-outlined text-[16px]">support_agent</span>
              Abrir Chat de Suporte
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
