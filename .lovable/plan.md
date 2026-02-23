
Objetivo
- Corrigir definitivamente o corte visual do conteúdo dentro dos cards da coluna esquerda em `/orders`, para que código, nome, data e valor fiquem 100% legíveis em todos os cards.

Diagnóstico do que está acontecendo
- Pelo código atual de `src/pages/Orders.tsx` e pelas capturas enviadas, o corte está no bloco inferior dos cards (data/valor), especialmente no valor (`R$ ...`) e na linha da data.
- O card da lista está com combinação que favorece clipping visual:
  - `overflow-hidden` no próprio card
  - layout interno sem estrutura de distribuição vertical estável (linha de baixo “encostando” no limite inferior)
  - alinhamento `items-end` na linha de data/valor
  - uso de `glass-panel` (com `backdrop-filter`) dentro de container com scroll, que pode agravar artefato visual de recorte em alguns ambientes.
- Ajustes anteriores de padding (`p-3.5 pb-4`) ajudaram pouco porque a causa principal é estrutural/compositing, não apenas espaço.

Plano de correção (implementação)
1) Reestruturar o layout interno do card para garantir altura e fluxo estáveis
- Em `src/pages/Orders.tsx`, no card da lista (map de `filteredOrders`):
  - Transformar o wrapper interno (`relative z-10`) em coluna flex com distribuição vertical:
    - `flex flex-col justify-between`
    - `gap` controlado entre topo e rodapé
    - `min-h` seguro para nunca “esmagar” a última linha.
- Resultado esperado: a linha de data/valor sempre terá área própria e não encostará no limite do card.

2) Remover o clipping do próprio card e preservar visual de seleção
- No container do card:
  - Remover `overflow-hidden` (principal fonte de recorte de texto quando combinado com blur/scroll).
- Na camada de destaque do card selecionado:
  - Manter o overlay absoluto, mas com borda arredondada explícita (`rounded-xl`) para preservar o visual sem depender de clipping do pai.
- Resultado esperado: texto deixa de ser “cortado” mesmo com rendering subpixel.

3) Ajustar microtipografia da linha inferior para legibilidade
- Na linha de metadados (ícone calendário + data + valor):
  - trocar `items-end` por `items-center` (ou `items-baseline` conforme melhor resultado visual no preview);
  - aplicar `leading-tight`/`leading-none` de forma controlada na data e no valor para evitar descida de glifos fora da caixa.
- Resultado esperado: números como “1” e caracteres de data não ficam serrilhados/cortados na base.

4) Manter consistência visual com o restante da tela
- Preservar:
  - largura da coluna esquerda
  - filtro/status
  - comportamento de scroll interno
  - aparência geral glass/dark do projeto.
- Só corrigir o que afeta legibilidade dos cards, sem alterar comportamento funcional de seleção/detalhes.

Validação (critério de aceite)
- Desktop (como no seu print grande):
  - nenhum card com data ou valor cortado;
  - cards selecionados e não selecionados legíveis.
- Largura estreita (como no print compacto):
  - texto completo visível dentro de cada card;
  - sem recorte na parte inferior de “R$ ...” e da linha da data.
- Fluxo:
  - rolar lista longa sem artefatos;
  - alternar entre filtros “Todos/Concluídos/Processando” sem voltar o problema.

Risco e mitigação
- Risco: ao remover `overflow-hidden`, o overlay de seleção pode passar do raio.
- Mitigação: aplicar `rounded-xl` no overlay e manter ordem de camadas (`absolute` + `relative z-10`) para acabamento limpo.

Arquivos impactados
- `src/pages/Orders.tsx` (somente ajustes de classes/layout no card da lista esquerda; sem mudança de lógica de dados).
