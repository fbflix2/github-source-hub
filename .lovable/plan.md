
Problema revisado

Do I know what the issue is? Sim.

O problema real não é só “um filtro errado”. Hoje a Auditoria mistura contagem, status e critério em lógicas diferentes, por isso você vê número total incoerente e perfis que já cumpriram tarefa/critérios não aparecem quando filtra.

O que confirmei
- Existem 735 perfis cadastrados no total.
- Desses, 692 estão no universo operacional da esteira (`active`, `checkpoint`, `completed`).
- 687 são pendentes (`active` + `checkpoint`).
- 5 estão aprovados (`completed`).
- Só 70 perfis têm critério salvo manualmente em `site_settings`.
- Parte dos critérios existe só nas tarefas concluídas, mas a detecção atual é frágil e não é usada de forma consistente em todas as telas.

Causa raiz
1. O card “Perfis” está usando quantidade filtrada/listada, não o total cadastrado.
2. A Auditoria usa uma regra híbrida, mas outras partes ainda usam só `qualityMap` bruto.
3. A identificação de 2FA/BM/Página por tarefa depende de texto solto e não é robusta o suficiente para todas as variações reais.
4. O toggle “Mostrando Pendentes” corta perfis por status antes do resto, então parte da base some sem ficar claro.

Plano de correção definitivo

1. Unificar a regra em um único derivador
- Criar um objeto derivado por perfil contendo:
  - status
  - dias de aquecimento
  - faixa de amigos
  - 2FA/BM/Página
  - origem da evidência: manual, tarefa ou ambos
- Todas as telas da esteira vão usar esse mesmo derivador.

2. Corrigir a origem dos critérios
- Em `src/lib/warming-ready.ts`, centralizar a leitura de critério manual + evidência de tarefas.
- Fortalecer a normalização dos textos e padrões atuais.
- Para resolver de vez, substituir dependência de texto por tags explícitas de evidência nas tarefas/config da esteira (`2fa`, `bm`, `page`) e fazer backfill das tarefas padrão já existentes.

3. Corrigir os números do topo
- Separar 4 contagens:
  - Total cadastrados = 735
  - Em auditoria
  - Aprovados
  - Resultado atual do filtro
- O total nunca mais deve depender do filtro ativo.

4. Corrigir o filtro de status
- Trocar o comportamento implícito atual por um filtro claro:
  - Todos
  - Pendentes
  - Aprovados
  - Bloqueados/Restritos
  - Enviados
- Assim, todo perfil cadastrado continua acessível e não some “por trás”.

5. Fazer os filtros 2FA/BM/Página baterem com a realidade
- Aplicar os filtros sobre o critério derivado unificado.
- Isso fará entrar tanto:
  - perfis marcados manualmente
  - quanto perfis que já cumpriram a tarefa correspondente

6. Remover divergência entre Auditoria e Análise Interna
- Hoje a Auditoria já tenta derivar parte dos critérios, mas a Análise Interna e outros pontos ainda mostram `qualityMap` cru.
- Vou alinhar:
  - `src/components/admin/warming/WarmingAuditDashboard.tsx`
  - `src/pages/admin/AdminEsteiraAdmin.tsx`
  - `src/components/admin/warming/ProfileQuickInfo.tsx`
  - `src/components/admin/warming/ProfileQualityMeter.tsx` se necessário

7. Dar transparência visual
- Exibir no perfil de onde veio cada badge:
  - Manual
  - Tarefa
  - Ambos
- Isso facilita validar rapidamente por que o perfil apareceu no filtro.

Arquivos principais envolvidos
- `src/lib/warming-ready.ts`
- `src/components/admin/warming/WarmingAuditDashboard.tsx`
- `src/pages/admin/AdminEsteiraAdmin.tsx`
- possivelmente componentes auxiliares de qualidade do perfil
- se eu aplicar a solução definitiva por tags: migration para suportar evidência estruturada

Resultado esperado
- Todo perfil cadastrado passa a estar acessível na Auditoria via status.
- O total exibido passa a refletir o total real da base.
- Filtro de 2FA/BM/Página passa a trazer os perfis que já cumpriram tarefa ou critério.
- Auditoria, Análise Interna e relatórios passam a mostrar os mesmos números e os mesmos perfis.
