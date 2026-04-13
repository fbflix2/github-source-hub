
Objetivo: corrigir a aba "Disponíveis" para realmente listar os proxies Webshare livres para venda.

Diagnóstico
- O componente `ProxyAvailableTab.tsx` hoje considera como “vendido/ocupado” todo registro da tabela `subscriptions` com `type = "webshare"`.
- Isso inclui assinaturas antigas, canceladas, expiradas e possivelmente já encerradas.
- Resultado: o filtro remove proxies demais e a tela pode ficar zerada mesmo existindo estoque livre.
- Há uma inconsistência importante: na edge function `webshare-api`, a alocação interna já trata como ocupados apenas proxies de assinaturas `active` e `expiring`. A aba “Disponíveis” deveria seguir a mesma regra.

O que vou implementar
1. Ajustar a lógica de bloqueio de estoque em `src/components/admin/proxy/ProxyAvailableTab.tsx`
- Filtrar `subscriptions` para considerar somente proxies atualmente ocupados:
  - status `active` e `expiring`
  - e, se existir `end_date`, respeitar vencimento real
- Ignorar assinaturas canceladas/expiradas/antigas para não “segurar” proxy no inventário.

2. Alinhar a aba com a regra do backend
- Reproduzir a mesma ideia usada na `webshare-api`:
  - apenas proxies ainda em uso devem sair da lista de disponíveis
- Isso evita divergência entre o estoque visual e o estoque usado na alocação.

3. Melhorar o tratamento dos dados vindos da Webshare
- Garantir parsing estável da resposta `{ data: [...], total }`
- Opcionalmente filtrar apenas proxies válidos (`p.valid`) para não exibir item inválido como disponível, seguindo o padrão já usado no backend.

4. Melhorar estados da interface
- Exibir mensagem mais clara quando:
  - a API retornar zero proxies
  - não houver sessão/autorização
  - houver erro no carregamento
- Assim fica fácil distinguir “sem estoque” de “falha no carregamento”.

5. Revisar os cards de resumo
- Fazer os totais de BR/US refletirem exatamente o mesmo conjunto filtrado da tabela
- Garantir coerência entre contagem e listagem.

Arquivos que devem ser alterados
- `src/components/admin/proxy/ProxyAvailableTab.tsx`

Arquivos de referência que vou seguir
- `src/components/admin/proxy/WebshareProxyTab.tsx`
- `src/hooks/useWebshare.ts`
- `supabase/functions/webshare-api/index.ts`

Resultado esperado
- A aba “Disponíveis” passará a mostrar os proxies realmente livres para venda.
- Proxies de clientes com assinatura já encerrada deixarão de bloquear o estoque.
- Os números do topo e as listas BR/US ficarão consistentes com a regra real de alocação.

Validação após implementar
- Abrir a aba “Disponíveis” e confirmar que os totais deixam de ficar zerados indevidamente.
- Conferir se um proxy vinculado a assinatura ativa não aparece na lista.
- Conferir se um proxy de assinatura cancelada/expirada volta a aparecer como disponível.
- Testar o botão “Atualizar” e a busca por IP/porta.
- Validar BR e US separadamente para garantir que a segmentação continua correta.

Detalhe técnico importante
- O principal ajuste não é visual; é de regra de negócio.
- Hoje a tela está usando “já foi vendido alguma vez” como sinônimo de “indisponível”.
- O correto para estoque é “está atualmente alocado a uma assinatura ainda válida”.
