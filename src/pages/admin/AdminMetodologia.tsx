import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ShoppingBag,
  Building2,
  DollarSign,
  TrendingUp,
  Calculator,
  Layers,
  ArrowRight,
  Minus,
  Equal,
} from "lucide-react";

export default function AdminMetodologia() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] -mx-6 -mt-6 p-6 lg:p-12 gap-8 relative">
      {/* Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] mix-blend-screen opacity-40" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] mix-blend-screen opacity-30" />
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col gap-10">
        {/* Header */}
        <header className="flex flex-col gap-4">
          <button
            onClick={() => navigate("/admin/auditoria/projecao-lucro")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors w-fit"
          >
            <ArrowLeft className="size-4" />
            Voltar para Projeção de Lucro
          </button>
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
              Como calculamos seus{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">
                resultados?
              </span>
            </h1>
            <p className="text-muted-foreground text-sm mt-2 max-w-2xl leading-relaxed">
              Aqui explicamos de forma simples e transparente como cada número da Projeção de Lucro é calculado, para que você entenda exatamente de onde vem cada valor.
            </p>
          </div>
        </header>

        {/* Visual Formula */}
        <section className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-6">
          <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
            <Calculator className="size-5 text-blue-400" />
            A Fórmula Resumida
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3 py-4">
            <FormulaBlock label="Receita Total" color="text-emerald-400" bgColor="bg-emerald-400/10 border-emerald-400/20" />
            <Minus className="size-5 text-muted-foreground" />
            <FormulaBlock label="Custo Real (COGS)" color="text-red-400" bgColor="bg-red-400/10 border-red-400/20" />
            <Minus className="size-5 text-muted-foreground" />
            <FormulaBlock label="Custos Fixos" color="text-amber-400" bgColor="bg-amber-400/10 border-amber-400/20" />
            <Equal className="size-5 text-white" />
            <FormulaBlock label="Lucro Real" color="text-blue-400" bgColor="bg-blue-400/10 border-blue-400/20" />
          </div>
        </section>

        {/* Step by step */}
        <div className="flex flex-col gap-6">
          {/* Step 1 */}
          <StepCard
            step={1}
            icon={ShoppingBag}
            iconColor="text-red-400"
            iconBg="bg-red-400/10 border-red-400/20"
            title="Custo Real dos Produtos (COGS)"
            subtitle="Cost of Goods Sold — O quanto você gastou"
          >
            <p>
              Cada vez que você registra uma <strong>compra</strong> na Central de Investimentos, informamos:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Quantidade</strong> — quantas unidades comprou</li>
              <li><strong>Custo unitário</strong> — quanto pagou por cada unidade</li>
              <li><strong>Taxa/Imposto</strong> — percentual adicional (IOF, cambial, etc)</li>
            </ul>
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 mt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Cálculo:</p>
              <p className="text-white font-mono text-sm">
                COGS = Quantidade × Custo Unitário × (1 + Taxa ÷ 100)
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                <strong>Exemplo:</strong> Comprou 10 perfis a R$5,00 cada com 6% de taxa
                <br />
                COGS = 10 × R$5,00 × 1,06 = <strong className="text-red-400">R$53,00</strong>
              </p>
            </div>
          </StepCard>

          {/* Step 2 */}
          <StepCard
            step={2}
            icon={DollarSign}
            iconColor="text-emerald-400"
            iconBg="bg-emerald-400/10 border-emerald-400/20"
            title="Receita Total Projetada"
            subtitle="Quanto você vai receber ao vender tudo"
          >
            <p>
              Quando registra a compra, você também define o <strong>preço de venda</strong> de cada item. A receita projetada é simplesmente:
            </p>
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 mt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Cálculo:</p>
              <p className="text-white font-mono text-sm">
                Receita = Quantidade × Preço de Venda
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                <strong>Exemplo:</strong> 10 perfis vendidos a R$15,00 cada
                <br />
                Receita = 10 × R$15,00 = <strong className="text-emerald-400">R$150,00</strong>
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              ⚠️ Esse valor assume que <strong>todos os itens</strong> serão vendidos. É uma projeção — se sobrar estoque, o valor real será menor.
            </p>
          </StepCard>

          {/* Step 3 */}
          <StepCard
            step={3}
            icon={TrendingUp}
            iconColor="text-blue-400"
            iconBg="bg-blue-400/10 border-blue-400/20"
            title="Lucro Bruto"
            subtitle="Receita menos o custo dos produtos"
          >
            <p>
              O lucro bruto mostra quanto <strong>sobra</strong> depois de pagar os fornecedores, <strong>mas antes</strong> de descontar os custos fixos do negócio.
            </p>
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 mt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Cálculo:</p>
              <p className="text-white font-mono text-sm">
                Lucro Bruto = Receita Total − COGS Total
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                <strong>Exemplo:</strong> R$150,00 − R$53,00 = <strong className="text-blue-400">R$97,00</strong>
              </p>
            </div>
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 mt-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Margem Bruta:</p>
              <p className="text-white font-mono text-sm">
                Margem = (Lucro Bruto ÷ Receita) × 100
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                <strong>Exemplo:</strong> (R$97 ÷ R$150) × 100 = <strong className="text-blue-400">64,7%</strong>
                <br />
                Isso significa que a cada R$1 de venda, R$0,65 é lucro bruto.
              </p>
            </div>
          </StepCard>

          {/* Step 4 */}
          <StepCard
            step={4}
            icon={Building2}
            iconColor="text-amber-400"
            iconBg="bg-amber-400/10 border-amber-400/20"
            title="Custos Fixos Mensais"
            subtitle="Despesas do Centro de Custos"
          >
            <p>
              São todas as despesas que você tem <strong>todo mês</strong>, independente de quantas vendas faz. Exemplos:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Servidores e hospedagem</li>
              <li>Ferramentas e softwares</li>
              <li>Proxies e infraestrutura</li>
              <li>Domínios, licenças, etc</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-3">
              Esses custos são somados automaticamente a partir dos itens <strong>ativos</strong> cadastrados no Centro de Custos (/admin/auditoria/centro-custos).
            </p>
          </StepCard>

          {/* Step 5 - Final */}
          <StepCard
            step={5}
            icon={Layers}
            iconColor="text-primary"
            iconBg="bg-primary/10 border-primary/20"
            title="Lucro Real (Resultado Final)"
            subtitle="O dinheiro que realmente sobra no final"
            highlighted
          >
            <p>
              Este é o número mais importante. Ele desconta <strong>tudo</strong>: o custo dos produtos e os custos fixos do negócio.
            </p>
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 mt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Cálculo:</p>
              <p className="text-white font-mono text-sm">
                Lucro Real = Lucro Bruto − Custos Fixos Mensais
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                <strong>Exemplo completo:</strong>
                <br />
                Receita: R$150,00
                <br />
                − COGS: R$53,00
                <br />
                = Lucro Bruto: R$97,00
                <br />
                − Custos Fixos: R$30,00
                <br />
                = <strong className="text-primary">Lucro Real: R$67,00</strong>
              </p>
            </div>
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 mt-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Margem Real:</p>
              <p className="text-white font-mono text-sm">
                Margem Real = (Lucro Real ÷ Receita) × 100
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                (R$67 ÷ R$150) × 100 = <strong className="text-primary">44,7%</strong>
                <br />
                A cada R$1 vendido, R$0,45 é lucro líquido real.
              </p>
            </div>
          </StepCard>
        </div>

        {/* Period Info */}
        <section className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-2xl p-6">
          <h2 className="text-white font-bold text-lg mb-3">📅 Período de Análise</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Todos os cálculos da Projeção de Lucro consideram as <strong className="text-white">compras dos últimos 30 dias</strong>. 
            Ou seja, a cada dia que passa, compras mais antigas "saem" da janela de 30 dias e os valores são atualizados automaticamente.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mt-2">
            Os <strong className="text-white">custos fixos</strong> do Centro de Custos são considerados <strong className="text-white">integralmente</strong> (valor mensal completo), 
            pois representam despesas recorrentes que acontecem todo mês.
          </p>
        </section>

        {/* Important Notes */}
        <section className="bg-white/[0.03] backdrop-blur-2xl border border-amber-400/20 rounded-2xl p-6">
          <h2 className="text-white font-bold text-lg mb-3">⚠️ Observações Importantes</h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <ArrowRight className="size-4 mt-0.5 text-amber-400 shrink-0" />
              <span>A <strong className="text-white">receita é projetada</strong>, ou seja, assume que todos os itens comprados serão vendidos. Na prática, o valor pode ser menor se houver estoque parado.</span>
            </li>
            <li className="flex gap-2">
              <ArrowRight className="size-4 mt-0.5 text-amber-400 shrink-0" />
              <span>A <strong className="text-white">margem por item</strong> na tabela mostra o lucro bruto individual, sem considerar os custos fixos. É útil para comparar a rentabilidade entre produtos diferentes.</span>
            </li>
            <li className="flex gap-2">
              <ArrowRight className="size-4 mt-0.5 text-amber-400 shrink-0" />
              <span>Proxies com receita recorrente (MRR) são contabilizados <strong className="text-white">separadamente</strong> na tela de Auditoria principal, não entram nesta projeção de compras avulsas.</span>
            </li>
            <li className="flex gap-2">
              <ArrowRight className="size-4 mt-0.5 text-amber-400 shrink-0" />
              <span>Se uma compra não tiver <strong className="text-white">preço de venda</strong> definido, a receita projetada para aquele item será R$0,00, resultando em margem negativa.</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function FormulaBlock({ label, color, bgColor }: { label: string; color: string; bgColor: string }) {
  return (
    <div className={`px-4 py-2 rounded-xl border ${bgColor}`}>
      <span className={`text-sm font-bold ${color}`}>{label}</span>
    </div>
  );
}

function StepCard({
  step,
  icon: Icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  highlighted,
  children,
}: {
  step: number;
  icon: any;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  highlighted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`bg-white/[0.03] backdrop-blur-2xl border rounded-2xl p-6 relative overflow-hidden ${
        highlighted ? "border-primary/30 shadow-[0_0_40px_-10px_rgba(249,6,6,0.15)]" : "border-white/10"
      }`}
    >
      {highlighted && (
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-50" />
      )}
      <div className="relative z-10">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 border border-white/10 text-xs font-black text-white">
            {step}
          </div>
          <div className={`p-2 rounded-lg border ${iconBg}`}>
            <Icon className={`size-5 ${iconColor}`} />
          </div>
          <div>
            <h3 className="text-white font-bold text-base">{title}</h3>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="text-sm text-muted-foreground leading-relaxed pl-12">
          {children}
        </div>
      </div>
    </section>
  );
}
