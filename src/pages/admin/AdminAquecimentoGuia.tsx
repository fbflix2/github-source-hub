import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

function MIcon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

const sections = [
  {
    icon: "info",
    title: "O que é o Aquecimento?",
    content:
      "O aquecimento é o processo de preparar perfis do Facebook para uso seguro em anúncios. Perfis novos ou recém-comprados precisam de atividade gradual para ganhar confiança junto ao algoritmo do Facebook, evitando bloqueios e checkpoints.",
  },
  {
    icon: "route",
    title: "Como Funciona o Fluxo?",
    items: [
      "1. O perfil é adicionado à esteira pelo admin com uma trilha (7, 15 ou 30 dias).",
      "2. O operador acessa o perfil diariamente e executa as tarefas definidas para aquele dia.",
      "3. Cada tarefa concluída é registrada com tempo gasto e status.",
      "4. Ao final da trilha, o perfil é avaliado para venda conforme os critérios de qualidade.",
      "5. Perfis prontos são movidos automaticamente para 'Perfis Prontos'.",
    ],
  },
  {
    icon: "checklist",
    title: "Tarefas Diárias",
    content:
      "As tarefas são configuradas pelo admin na 'Esteira Admin' e podem incluir: navegar no feed, curtir publicações, adicionar amigos, publicar stories, interagir em grupos, entre outras ações que simulam uso orgânico. Cada dia possui suas tarefas específicas que devem ser concluídas em ordem.",
  },
  {
    icon: "verified",
    title: "Critérios de Qualidade (Perfil Pronto)",
    items: [
      "✅ Mínimo de 20 amigos adicionados",
      "✅ 2FA (autenticação em duas etapas) ativado",
      "✅ Mínimo de 7 dias de aquecimento completo",
      "🔶 BM criada (opcional, mas recomendado)",
      "🔶 Página criada (opcional, mas recomendado)",
    ],
    note: "Os critérios podem ser ajustados pelo admin nas configurações da esteira.",
  },
  {
    icon: "shield",
    title: "Status dos Perfis",
    items: [
      "🟢 Ativo — Em aquecimento normal, seguindo a trilha.",
      "🟡 Checkpoint — Perfil entrou em verificação do Facebook. Requer atenção imediata.",
      "🔴 Bloqueado/Restrito — Perfil perdido. Contabilizado em 'Perdas do Mês'.",
      "✅ Completo — Aquecimento finalizado, perfil pronto para venda.",
      "⏸️ Pausado — Aquecimento pausado temporariamente.",
    ],
  },
  {
    icon: "timer",
    title: "Tempo e Produtividade",
    content:
      "O sistema registra o tempo gasto em cada perfil através do timer integrado. Isso permite calcular métricas de produtividade como 'Tempo Médio por Perfil' e identificar gargalos no processo. Use o timer sempre que estiver trabalhando em um perfil.",
  },
  {
    icon: "emoji_events",
    title: "Níveis de Confiança",
    items: [
      "🥉 Bronze — Perfil novo, início do aquecimento.",
      "🥈 Prata — Perfil com atividade consistente, poucos checkpoints.",
      "🥇 Ouro — Perfil maduro, alta confiança, pronto para uso intenso.",
    ],
  },
  {
    icon: "edit_note",
    title: "Anotações Rápidas",
    content:
      "Use a aba de anotações no painel lateral para registrar observações sobre cada perfil: comportamento do Facebook, dificuldades encontradas, checkpoints recebidos, etc. Essas notas são salvas automaticamente e ficam vinculadas ao perfil.",
  },
  {
    icon: "warning",
    title: "Regras Importantes",
    items: [
      "⚠️ Nunca pule dias de aquecimento — a consistência é essencial.",
      "⚠️ Não faça ações em massa (ex: adicionar 50 amigos de uma vez).",
      "⚠️ Use sempre o proxy atribuído ao perfil.",
      "⚠️ Se receber checkpoint, pare imediatamente e altere o status.",
      "⚠️ Registre o tempo gasto em cada perfil para métricas precisas.",
      "⚠️ Não use VPN genérica — apenas o proxy designado.",
    ],
  },
];

export default function AdminAquecimentoGuia() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin/aquecimento")}
          className="shrink-0"
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
            <MIcon name="help" className="text-primary text-3xl" />
            Como Funciona o Aquecimento
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Guia completo para operadores — regras, fluxo, critérios e boas práticas.
          </p>
        </div>
      </div>

      {/* Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((section, idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-border bg-card p-5 space-y-3 flex flex-col"
          >
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <MIcon name={section.icon} className="text-primary text-xl" />
              {section.title}
            </h2>

            {section.content && (
              <p className="text-muted-foreground text-xs leading-relaxed flex-1">
                {section.content}
              </p>
            )}

            {section.items && (
              <ul className="space-y-1 flex-1">
                {section.items.map((item, i) => (
                  <li key={i} className="text-muted-foreground text-xs leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            )}

            {section.note && (
              <p className="text-[11px] text-primary/80 italic pt-1">
                {section.note}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center pb-8">
        <p className="text-xs text-muted-foreground">
          Dúvidas adicionais? Entre em contato pelo Chat da Equipe.
        </p>
      </div>
    </div>
  );
}
