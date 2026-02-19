import { Search, Plus, Info, Clock, TrendingUp, Star, CheckCircle, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

const GanheAqui = () => {
  const navigate = useNavigate();
  const ticketHistory = [
    {
      id: "#99281",
      date: "02 Jan 2026 • 14:30",
      status: "active",
      numbers: ["88291", "12930", "44821"],
      extra: 7,
    },
    {
      id: "#88123",
      date: "28 Dez 2025 • 09:15",
      status: "active",
      numbers: ["11029", "55921", "33910"],
      extra: 7,
    },
    {
      id: "#44",
      date: "20 Dez 2025 • Finalizado",
      status: "past",
      numbers: [],
      extra: 0,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="relative w-full rounded-2xl overflow-hidden bg-gradient-to-r from-card to-background border border-border shadow-2xl">
        {/* Background Glows */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary opacity-5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

        <div className="relative z-10 grid lg:grid-cols-2 gap-8 p-8 lg:p-12 items-center">
          {/* Left Content */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-bold uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Recarga Premiada
            </div>

            <h1 className="text-4xl lg:text-5xl font-extrabold text-foreground leading-tight">
              Recarregue <span className="text-primary">R$ 100</span> e concorra a{" "}
              <span className="text-primary">R$ 500</span> no Pix!
            </h1>

            <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
              Potencialize suas chances de ganhar. A cada R$ 100 adicionados à sua carteira,
              você desbloqueia 10 números da sorte exclusivos para o próximo sorteio.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button className="bg-primary hover:bg-red-700 text-primary-foreground font-bold py-6 px-8 rounded-xl shadow-lg shadow-red-900/20 transform hover:-translate-y-1 transition-all duration-300 flex items-center justify-center gap-2">
                <Plus className="w-5 h-5" />
                Recarregar Agora
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/como-funciona")}
                className="bg-secondary hover:bg-secondary/80 text-foreground font-medium py-6 px-8 rounded-xl border border-border backdrop-blur-sm transition-all duration-300 flex items-center justify-center gap-2"
              >
                <Info className="w-5 h-5 text-muted-foreground" />
                Como Funciona
              </Button>
            </div>

            <p className="text-xs text-muted-foreground pt-2 flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Promoção válida até 05/01/2026
            </p>
          </div>

          {/* Right - Status Card */}
          <div className="relative flex flex-col items-center justify-center">
            <div className="glass-panel p-6 rounded-2xl w-full max-w-md text-center border border-border">
              <h3 className="text-muted-foreground text-sm font-medium uppercase tracking-widest mb-6">
                Status do Sorteio
              </h3>

              <div className="mb-8">
                <div className="flex items-end justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Progresso</span>
                  <span className="text-3xl font-bold text-primary">75%</span>
                </div>
                <div className="relative h-4 bg-muted rounded-full overflow-hidden border border-border shadow-inner">
                  <div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-800 via-primary to-red-400 shadow-[0_0_15px_rgba(220,38,38,0.6)]"
                    style={{ width: "75%" }}
                  >
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/10 to-transparent" />
                  </div>
                </div>
                <p className="text-muted-foreground text-sm mt-3">
                  <span className="text-foreground font-semibold">75%</span> para o próximo sorteio
                </p>
              </div>

              <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent mb-6" />

              <div className="text-left">
                <p className="text-sm text-muted-foreground mb-2">Prêmio Acumulado</p>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold text-foreground">
                    R$ 500,00
                  </span>
                  <span className="bg-green-500/20 text-green-500 text-[10px] font-bold px-2 py-0.5 rounded border border-green-500/30">
                    PIX
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tickets Section */}
      <section className="grid lg:grid-cols-3 gap-8">
        {/* Header */}
        <div className="lg:col-span-3 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <span className="text-primary">🎫</span>
              Seus Números da Sorte
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Gerencie seus tickets ativos para o sorteio desta semana.
            </p>
          </div>
          <div className="relative w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por ID de transação..."
              className="w-full md:w-80 bg-card text-foreground border-border rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent text-sm placeholder-muted-foreground"
            />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-panel bg-card p-6 rounded-xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-muted-foreground">Tickets Ativos</h3>
              <div className="bg-primary/10 p-1.5 rounded-lg">
                <Star className="w-4 h-4 text-primary" />
              </div>
            </div>
            <div className="text-3xl font-bold text-foreground">24</div>
            <div className="mt-2 text-xs text-green-500 flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              +10 na última recarga
            </div>
          </div>

          <div className="glass-panel bg-card p-6 rounded-xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-muted-foreground">Chance de Ganhar</h3>
              <div className="bg-yellow-500/10 p-1.5 rounded-lg">
                <Star className="w-4 h-4 text-yellow-500" />
              </div>
            </div>
            <div className="text-3xl font-bold text-foreground">Alta</div>
            <div className="w-full bg-muted rounded-full h-1.5 mt-3">
              <div className="bg-primary h-1.5 rounded-full" style={{ width: "75%" }} />
            </div>
          </div>
        </div>

        {/* History Table */}
        <div className="lg:col-span-2">
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border bg-muted flex justify-between items-center">
              <h3 className="font-semibold text-foreground text-sm">Histórico Recente</h3>
              <button className="text-xs text-primary font-medium hover:underline">
                Ver todos
              </button>
            </div>

            <div className="divide-y divide-border">
              {ticketHistory.map((item, index) => (
                <div
                  key={index}
                  className="p-4 hover:bg-muted/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        item.status === "active"
                          ? "bg-green-900/30 text-green-500"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {item.status === "active" ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <History className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {item.status === "active" ? `Recarga ${item.id}` : `Sorteio Passado ${item.id}`}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.date}</p>
                    </div>
                  </div>

                  {item.status === "active" ? (
                    <div className="flex flex-wrap gap-2">
                      {item.numbers.map((num, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded bg-muted text-muted-foreground text-xs font-mono border border-border"
                        >
                          {num}
                        </span>
                      ))}
                      {item.extra > 0 && (
                        <span className="px-2.5 py-1 rounded bg-muted text-muted-foreground text-xs font-mono border border-border">
                          +{item.extra}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground italic">Não premiado</div>
                  )}
                </div>
              ))}
            </div>

            <div className="p-3 bg-muted border-t border-border text-center">
              <p className="text-xs text-muted-foreground">
                Você tem 24 números válidos para o próximo sorteio.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default GanheAqui;
