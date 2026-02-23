
## Tela de Assinaturas: Mostrar produtos disponíveis quando não há assinaturas

Quando o cliente não possui nenhuma assinatura de proxy, em vez de exibir a tela vazia com filtros e "Nenhuma assinatura encontrada", a página mostrará os planos de proxy disponíveis da ProxyBR para que ele possa contratar diretamente.

### O que vai mudar

**Página `/subscriptions` (`src/pages/Subscriptions.tsx`)**

- Quando o carregamento terminar e a lista de assinaturas estiver vazia (0 itens), toda a interface atual (stats, filtros, cards vazios, banner CTA) será substituída por uma nova seção de "vitrine de planos".
- Essa vitrine vai:
  - Usar o hook `useProxyBRProducts()` (já existente em `useProxyBR.ts`) para buscar os produtos disponíveis na API ProxyBR.
  - Exibir um header convidativo tipo "Escolha seu plano de Proxy" com subtítulo explicativo.
  - Listar os produtos retornados em cards estilizados (seguindo o visual glass/dark do projeto), mostrando nome, descrição/tipo e preço de cada plano.
  - Cada card terá um botão "Assinar" que redireciona para `/loja` ou abre o fluxo de contratação.
- Quando o cliente **já tem** assinaturas (1 ou mais), a tela continua exatamente como está hoje (filtros, cards, modal de detalhes, banner CTA).

### Detalhes técnicos

1. No `Subscriptions.tsx`, importar `useProxyBRProducts` de `@/hooks/useProxyBR`.
2. Chamar o hook no componente.
3. Adicionar uma condição: se `!isLoading && !error && subscriptions.length === 0`, renderizar a seção de produtos em vez do conteúdo atual.
4. A seção de produtos mostrará um grid de cards com os dados retornados pela API (`data` do hook), com skeleton durante carregamento dos produtos.
5. O botão de cada produto levará o usuário para `/loja` para completar a compra.

### Arquivo impactado
- `src/pages/Subscriptions.tsx` -- adição de lógica condicional e novo bloco de UI para estado vazio com produtos.
