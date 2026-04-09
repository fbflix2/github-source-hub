
Objetivo: corrigir de vez a falha de conexão dos proxies rotativos Webshare para clientes, alinhando o que é entregue ao cliente com a configuração realmente compatível usada no painel interno.

1. Diagnóstico confirmado
- O sistema interno já possui um fluxo melhor para proxy rotativo em `webshare-api` com:
  - `host: p.webshare.io`
  - `converted_host` resolvido por DNS
  - portas `80`, `3128` e `1080`
- Porém isso está isolado no “Proxy Interno” e o próprio texto da tela diz que não afeta clientes.
- As assinaturas dos clientes em `purchase-rotating-proxy` salvam apenas:
  - `proxy_host: "p.webshare.io"`
  - `http_port: 80`
  - `socks5_port: 1080`
- No frontend do cliente (`useWebshareSubscriptions` e `SubscriptionManage`), o cliente recebe e copia só esse endpoint básico.
- Resultado provável: o teste passa em alguns cenários, mas ferramentas como JultiLogin/Multilogin continuam falhando porque o cliente não recebe automaticamente a melhor variante de conexão nem o IP convertido/porta alternativa.

2. Implementação proposta
- Unificar a origem das credenciais rotativas:
  - extrair no `webshare-api` um resolvedor único de credenciais rotativas usado tanto pelo painel interno quanto pelas assinaturas dos clientes.
- Melhorar o payload salvo em `subscriptions.raw_data` para `webshare_rotating`, incluindo:
  - `proxy_host`
  - `converted_host`
  - `http_port`
  - `alt_http_port`
  - `socks5_port`
  - `username`
  - `password`
  - `country_code`
- Atualizar `useWebshareSubscriptions` para expor essas variações para o app do cliente, não apenas `p.webshare.io:80`.
- Atualizar `SubscriptionManage.tsx` para mostrar e copiar:
  - HTTP principal
  - HTTP alternativo `:3128`
  - SOCKS5 `:1080`
  - Host convertido por IP, quando existir
  - indicação clara de qual usar em JultiLogin/Multilogin
- Ajustar o botão “Copiar Proxy” para priorizar a string mais compatível em vez de copiar só o HTTP simples atual.
- Melhorar o `test-proxy` para aceitar/testar mais de um endpoint quando a assinatura for rotativa:
  - HTTP `:80`
  - HTTP `:3128`
  - SOCKS5 `:1080` (ou ao menos identificar que a credencial é rotativa e orientar corretamente)
- Fazer backfill lógico para assinaturas rotativas já existentes:
  - quando `converted_host`/`alt_http_port` estiverem ausentes no `raw_data`, preencher via função ao carregar ou via ação administrativa de atualização.

3. Ajustes de UX para evitar novos chamados
- Exibir bloco “Configuração recomendada para JultiLogin/Multilogin”.
- Mostrar aviso curto:
  - usar usuário/senha
  - preferir IP convertido se a ferramenta rejeitar domínio
  - tentar `3128` se `80` falhar
  - usar `1080` para SOCKS5
- Manter o teste visual separado por protocolo/porta para o cliente entender exatamente qual variante funciona.

4. Arquivos principais a alterar
- `supabase/functions/webshare-api/index.ts`
- `supabase/functions/test-proxy/index.ts`
- `src/hooks/useWebshare.ts`
- `src/pages/SubscriptionManage.tsx`
- possivelmente `src/components/subscriptions/SubscriptionCard.tsx` para resumir melhor o endpoint ativo

5. Detalhes técnicos
- Hoje existe inconsistência entre:
  - configuração interna robusta (`get-internal-proxy-config`)
  - configuração entregue ao cliente (`purchase-rotating-proxy` + `useWebshareSubscriptions`)
- A correção deve reaproveitar o mesmo resolvedor de host/IP e portas em ambos os fluxos.
- Não parece exigir nova tabela; a tabela `internal_proxy_configs` já existe e pode continuar servindo como referência operacional.
- Se quisermos persistir a correção para clientes antigos sem depender só do carregamento dinâmico, pode ser necessário um backfill de `raw_data` das assinaturas `webshare_rotating`.

6. Validação após implementar
- Criar/inspecionar uma assinatura rotativa nova e confirmar que o `raw_data` contém `converted_host`, `alt_http_port` e `socks5_port`.
- Verificar na tela do cliente que aparecem as 3 opções de conexão.
- Testar o botão de cópia para garantir que ele não entrega mais uma string incompleta.
- Validar o fluxo fim a fim com um proxy rotativo real no preview e conferir se o teste diferencia corretamente HTTP 80, HTTP 3128 e SOCKS5 1080.
- Confirmar com um caso antigo de assinatura já existente para garantir que clientes antigos também passem a ver as credenciais corretas.
