import { ArrowLeft, Coins, TrendingUp, Users, Shield, Zap, Gift } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function TokenFBX() {
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-16">
      {/* Back */}
      <button
        onClick={() => navigate("/mercado")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Voltar ao Mercado
      </button>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-card to-card p-8 md:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-amber-400/15 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="size-20 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Coins className="size-10 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">Token FBX</h1>
              <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25 text-xs font-bold uppercase">Em breve</Badge>
            </div>
            <p className="text-muted-foreground max-w-xl leading-relaxed">
              A moeda digital exclusiva do ecossistema FBFLIX. Negocie, troque por serviços, 
              participe de promoções e muito mais com o Token FBX.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Seu saldo</p>
            <p className="text-4xl font-extrabold text-amber-400">0,00</p>
            <p className="text-sm text-muted-foreground">TFB</p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Cotação", value: "—", sub: "BRL", icon: TrendingUp, color: "text-emerald-400" },
          { label: "Holders", value: "—", sub: "usuários", icon: Users, color: "text-blue-400" },
          { label: "Supply", value: "—", sub: "TFB", icon: Zap, color: "text-purple-400" },
          { label: "Recompensas", value: "—", sub: "diárias", icon: Gift, color: "text-amber-400" },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/50 bg-card/80">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`size-10 rounded-xl bg-muted/50 flex items-center justify-center ${stat.color}`}>
                <stat.icon className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-lg font-bold text-foreground">{stat.value} <span className="text-xs font-normal text-muted-foreground">{stat.sub}</span></p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator className="bg-border/50" />

      {/* Features */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-5">Como funciona</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: TrendingUp,
              title: "Negociação P2P",
              desc: "Compre e venda tokens diretamente com outros usuários da plataforma de forma segura.",
              color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
            },
            {
              icon: Gift,
              title: "Recompensas Diárias",
              desc: "Ganhe tokens completando missões, indicando amigos e participando de promoções.",
              color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
            },
            {
              icon: Shield,
              title: "Segurança",
              desc: "Transações protegidas com sistema de escrow e verificação de identidade.",
              color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
            },
          ].map((feat) => (
            <Card key={feat.title} className="border-border/50 bg-card/80 hover:border-amber-500/20 transition-colors">
              <CardContent className="p-6">
                <div className={`size-12 rounded-xl border flex items-center justify-center mb-4 ${feat.color}`}>
                  <feat.icon className="size-6" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feat.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator className="bg-border/50" />

      {/* Roadmap */}
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-5">Roadmap</h2>
        <div className="space-y-3">
          {[
            { phase: "Fase 1", title: "Lançamento do Token", status: "Em desenvolvimento", active: true },
            { phase: "Fase 2", title: "Marketplace P2P", status: "Planejado", active: false },
            { phase: "Fase 3", title: "Recompensas e Missões", status: "Planejado", active: false },
            { phase: "Fase 4", title: "Staking e Rendimentos", status: "Futuro", active: false },
          ].map((item) => (
            <div
              key={item.phase}
              className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                item.active
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-border/50 bg-card/50"
              }`}
            >
              <div className={`size-3 rounded-full ${item.active ? "bg-amber-400 animate-pulse" : "bg-muted-foreground/30"}`} />
              <div className="flex-1">
                <span className="text-xs text-muted-foreground font-medium">{item.phase}</span>
                <h4 className="font-semibold text-foreground">{item.title}</h4>
              </div>
              <Badge
                variant="outline"
                className={item.active ? "bg-amber-500/15 text-amber-400 border-amber-500/25 text-xs" : "text-xs"}
              >
                {item.status}
              </Badge>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
