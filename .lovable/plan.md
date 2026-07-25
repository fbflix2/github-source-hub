## Problema confirmado
O cliente chega em `/checkout?product=...&qty=1&r=active-growth-marketing`, o layout do revendedor aparece, mas o conteúdo do checkout fica preso no spinner. Pelo código lido, esse spinner só é exibido quando:

1. `loading` ainda está `true` enquanto busca o produto; ou
2. `isResellerCheckout && product && !resellerPricingReady` enquanto resolve preço/override do revendedor.

Também foi confirmado que a rota `/checkout` está dentro do app autenticado e que o `CustomDomainRouter` já deixa passar `/checkout` quando existe `r=` na URL. Então o bloqueio atual está dentro do `Checkout.tsx`, não mais no roteador externo.

## Plano de correção

1. **Remover o spinner infinito como estado bloqueante**
   - Trocar o bloqueio `isResellerCheckout && product && !resellerPricingReady` por uma experiência não bloqueante.
   - O checkout deve renderizar assim que o produto for encontrado.
   - Enquanto o preço do revendedor resolve, exibir o conteúdo com preço provisório/fallback e atualizar assim que o preço correto chegar.

2. **Tornar o fetch do produto impossível de travar visualmente**
   - Garantir `try/catch/finally` no `fetchData()` principal do checkout.
   - Mesmo se a consulta de produto falhar ou demorar, `setLoading(false)` precisa sempre rodar.
   - Quando houver falha, mostrar “Produto não encontrado” com botão para voltar para a loja do revendedor, em vez de spinner permanente.

3. **Criar fallback local do preço do revendedor**
   - Se a URL tem `r=active-growth-marketing`, o checkout deve considerar esse slug como suficiente para continuar.
   - Se a consulta de override/preço não responder rápido, liberar a tela e manter o fallback até a consulta terminar.
   - A criação do pedido ainda deve usar `resellerItemPrices[product.id] ?? product.price`, então a tela não trava.

4. **Reduzir dependências que reexecutam o pricing sem necessidade**
   - Ajustar o `useEffect` de preço para depender de valores estáveis, principalmente `product.id` e uma chave estável dos itens extras, evitando reexecuções/cancelamentos contínuos.

5. **Adicionar logs temporários úteis para diagnóstico se persistir**
   - Adicionar logs seguros e sem dados sensíveis para marcar: produto carregado, pricing iniciado, pricing finalizado e razão de fallback.
   - Se o problema continuar na próxima mensagem, esses logs vão aparecer automaticamente e indicar o ponto exato.

6. **Validar o fluxo**
   - Testar `/checkout?product=e22acc24-d124-4cad-9b65-1095021d471f&qty=1&r=active-growth-marketing` no preview.
   - Conferir que a tela não fica só no spinner e que o cliente vê o formulário/resumo do checkout.
   - Quando autenticado não estiver disponível no sandbox, validar ao menos o redirect preservado para `/auth?redirect=...` e a ausência de bloqueio no roteador.

## Arquivos envolvidos

- `src/pages/Checkout.tsx`
  - Corrigir renderização bloqueante.
  - Blindar carregamento de produto/preço com `finally`.
  - Tornar pricing de revendedor não bloqueante.

- `src/components/CustomDomainRouter.tsx`
  - Manter como está, pois a leitura confirmou que `/checkout` com `r=` já passa direto.

- `src/App.tsx`
  - Manter como está salvo nova evidência, pois `/checkout` já está protegido corretamente dentro de `AuthenticatedApp` e o redirect para login preserva a URL.