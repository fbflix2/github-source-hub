

## Vinculacao de Proxies aos Clientes via API ProxyBR - CONCLUÍDO

### Resultado da investigação

A API ProxyBR **NÃO retorna dados do cliente** nas assinaturas. Os campos retornados são: `code`, `notes`, `product`, `product_variant`, `proxies`, `status`, `price`, `dates`. O campo `notes` é a **única** forma de vincular assinaturas a clientes.

### O que foi implementado

1. **Matching melhorado** no sync (cron e manual): agora busca por email exato, nome exato, email parcial E nome parcial no campo `notes`
2. **Ação "Re-vincular tudo"**: nova ação `relink-all-subscriptions` que re-analisa todas as assinaturas do admin e tenta vincular usando o matching melhorado
3. **Botão no admin**: "Re-vincular tudo" na página de assinaturas

### Como vincular proxies antigos

Para proxies comprados diretamente no painel ProxyBR (sem `notes` preenchido):
- **Opção 1**: Vincular manualmente no admin (botão "Vincular" na tabela) - isso também grava o nome/email no campo `notes` da ProxyBR
- **Opção 2**: Preencher o campo `notes` no painel ProxyBR com o email do cliente, depois rodar "Re-vincular tudo"
