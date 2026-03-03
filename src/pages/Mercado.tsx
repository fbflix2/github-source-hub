import { useState } from "react";
import { Newspaper, Coins, TrendingUp, ArrowRight, Clock, Eye, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const mockNews = [
  {
    id: "1",
    title: "Nova atualização de segurança disponível",
    summary: "Melhorias significativas na proteção de contas e dados dos usuários foram implementadas nesta versão.",
    category: "Segurança",
    date: "03 Mar 2026",
    readTime: "3 min",
    views: 248,
  },
  {
    id: "2",
    title: "Promoção especial: Proxies com 20% OFF",
    summary: "Aproveite nossa promoção de março e garanta proxies residenciais brasileiros com desconto exclusivo.",
    category: "Promoção",
    date: "02 Mar 2026",
    readTime: "2 min",
    views: 512,
  },
  {
    id: "3",
    title: "Novo sistema de assinaturas melhorado",
    summary: "Renovação automática, gestão simplificada e novas opções de planos disponíveis para todos os clientes.",
    category: "Novidade",
    date: "28 Fev 2026",
    readTime: "4 min",
    views: 189,
  },
  {
    id: "4",
    title: "Manutenção programada para dia 05/03",
    summary: "Realizaremos uma manutenção programada para melhorar a infraestrutura. O serviço pode ficar instável por alguns minutos.",
    category: "Aviso",
    date: "27 Fev 2026",
    readTime: "1 min",
    views: 321,
  },
];

const categoryColors: Record<string, string> = {
  Segurança: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  Promoção: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  Novidade: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  Aviso: "bg-amber-500/15 text-amber-400 border-amber-500/20",
};

export default function Mercado() {
  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-12">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Mercado</h1>
        <p className="text-muted-foreground mt-1">
          Fique por dentro das novidades e explore o ecossistema FBFLIX.
        </p>
      </div>

      {/* Section: Notícias */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
            <Newspaper className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Notícias</h2>
            <p className="text-sm text-muted-foreground">Atualizações, promoções e novidades da plataforma</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mockNews.map((news) => (
            <Card
              key={news.id}
              className="group cursor-pointer border-border/50 hover:border-primary/30 bg-card/80 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-semibold uppercase tracking-wider ${categoryColors[news.category] || ""}`}
                  >
                    {news.category}
                  </Badge>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{news.date}</span>
                </div>
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2">
                  {news.title}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                  {news.summary}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {news.readTime}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="size-3" />
                      {news.views}
                    </span>
                  </div>
                  <span className="text-xs text-primary font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    Ler mais <ArrowRight className="size-3" />
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator className="bg-border/50" />

      {/* Section: TokenFb */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <Coins className="size-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">TokenFb</h2>
            <p className="text-sm text-muted-foreground">Moeda digital do ecossistema FBFLIX — em breve</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Token Info Card */}
          <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent md:col-span-2">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/20 text-xs font-bold">
                  EM BREVE
                </Badge>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">O que é o TokenFb?</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                O TokenFb será a moeda digital exclusiva da FBFLIX. Com ela, você poderá negociar, 
                trocar por serviços, participar de promoções especiais e muito mais. 
                Estamos desenvolvendo um sistema seguro e transparente para toda a comunidade.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-card/80 border border-border/50">
                  <TrendingUp className="size-4 text-emerald-400" />
                  <div>
                    <p className="text-xs text-muted-foreground">Negociação</p>
                    <p className="text-sm font-semibold text-foreground">P2P</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-card/80 border border-border/50">
                  <Coins className="size-4 text-amber-400" />
                  <div>
                    <p className="text-xs text-muted-foreground">Recompensas</p>
                    <p className="text-sm font-semibold text-foreground">Diárias</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-card/80 border border-border/50">
                  <MessageCircle className="size-4 text-blue-400" />
                  <div>
                    <p className="text-xs text-muted-foreground">Comunidade</p>
                    <p className="text-sm font-semibold text-foreground">Ativa</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

      {/* Quick Stats Preview — CTA Card */}
          <Card className="relative overflow-hidden border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card/90 to-card/80 shadow-lg shadow-amber-500/5 group">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-400/10 via-transparent to-transparent pointer-events-none" />
            <CardContent className="p-6 flex flex-col justify-between h-full relative z-10">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/25 text-[10px] font-bold uppercase tracking-widest">
                    Token FBX
                  </Badge>
                  <div className="size-8 rounded-full bg-amber-400/15 flex items-center justify-center">
                    <Coins className="size-4 text-amber-400" />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Seu saldo</p>
                    <p className="text-3xl font-extrabold text-amber-400 tracking-tight">0,00 <span className="text-sm font-normal text-muted-foreground">TFB</span></p>
                  </div>
                  <Separator className="bg-amber-500/10" />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Cotação</p>
                      <p className="text-base font-semibold text-foreground">— BRL</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Status</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-xs font-semibold text-amber-400">Em breve</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => window.location.href = '/mercado/token-fbx'}
                className="mt-5 w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-sm shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:from-amber-400 hover:to-amber-500 transition-all duration-300 flex items-center justify-center gap-2 group-hover:scale-[1.02]"
              >
                <TrendingUp className="size-4" />
                Acessar Mercado FBX
                <ArrowRight className="size-4" />
              </button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
