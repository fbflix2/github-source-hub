
Objetivo: fazer o proxy interno funcionar sem mexer no fluxo de entrega/cobrança dos produtos vendidos.

Do I know what the issue is? Sim.

Diagnóstico:
- O front está exibindo a combinação mais recente corretamente: `fhvaccdhresidential` + `-BR-rotate`, host `p.webshare.io`, portas `80/1080`.
- O log da Edge Function mostra que `get-rotating-credentials` está respondendo sem erro.
- Pela sua captura, o validador externo mostra:
  - “Conexão com proxy: Funcionando”
  - “Comunicação com proxy: Sem conexão”
- Isso indica que a autenticação no endpoint está sendo aceita, mas o perfil de conexão exposto pela tela ainda não é um perfil “comprovadamente compatível” com a ferramenta que você está usando.
- O ponto mais provável é que hoje estamos inferindo as credenciais internas a partir do backbone/Webshare, em vez de usar um perfil validado de conexão. Além disso, a documentação da Webshare diz que alguns softwares não funcionam bem com o host em domínio (`p.webshare.io`) e precisam de “converted IP”.
- Outro ponto importante: `site_settings` é público para leitura no projeto, então não podemos guardar credenciais internas ali.

Plano:
1. Separar o proxy interno do fluxo comercial
- Criar uma configuração própria para “proxy interno BR”, isolada da lógica de venda/assinatura (`webshare_rotating`, checkout, cobrança, fulfillment).
- Isso garante que qualquer ajuste para uso operacional não afete o produto do cliente.

2. Criar armazenamento seguro para credenciais internas
- Adicionar uma tabela exclusiva, algo como `internal_proxy_configs`.
- Campos:
  - `label`
  - `provider_slug`
  - `country_code`
  - `host`
  - `converted_host`
  - `http_port`
  - `socks5_port`
  - `alt_http_port` (3128)
  - `username`
  - `password`
  - `source` (`webshare_auto` | `manual_override`)
  - `status`
  - `notes`
  - `last_verified_at`
- RLS: leitura/edição apenas para admin/staff.
- Não usar `site_settings` para isso.

3. Melhorar a Edge Function sem encostar na cobrança
- Em `supabase/functions/webshare-api/index.ts`:
  - manter o que já existe para vendas/assinaturas;
  - criar um caminho separado para o proxy interno;
  - continuar buscando o “auto-sugerido” da Webshare;
  - permitir salvar um override manual seguro quando o auto-sugerido não funcionar;
  - retornar também opções de compatibilidade:
    - host por domínio;
    - converted IP (quando informado);
    - portas `80`, `1080` e `3128`.
- O proxy interno passará a ler primeiro o override validado; se não existir, usa a sugestão automática.

4. Ajustar a tela `/admin/central-proxy/interno`
- Transformar a página em uma central operacional, não só exibição.
- Exibir:
  - configuração ativa;
  - configuração automática sugerida;
  - override manual;
  - observações de compatibilidade.
- Adicionar campos editáveis para:
  - host por domínio;
  - converted IP;
  - usuário;
  - senha;
  - portas.
- Adicionar cópias prontas separadas:
  - HTTP 80
  - SOCKS5 1080
  - HTTP 3128
- Adicionar instruções explícitas para ferramentas externas:
  - “se a ferramenta falhar com `p.webshare.io`, tente o converted IP”
  - “se estiver usando SOCKS5, use 1080”
  - “se estiver usando HTTP, tente 80 e depois 3128”

5. Melhorar o diagnóstico visual
- Mostrar badges como:
  - “Automático”
  - “Override manual”
  - “Compatibilidade alta”
  - “Host em domínio”
  - “Host em IP convertido”
- Mostrar claramente qual perfil está ativo no momento.
- Mostrar aviso de que a tela interna não altera assinatura de cliente nem entrega.

Impacto no sistema:
- Não mexe no checkout.
- Não mexe no tipo `webshare_rotating`.
- Não mexe na entrega automática ao cliente.
- Não mexe em cobrança.
- Apenas cria uma camada separada e segura para o seu uso operacional temporário.

Arquivos que eu alteraria:
- `supabase/functions/webshare-api/index.ts`
- `src/hooks/useWebshare.ts`
- `src/pages/admin/AdminProxyInterno.tsx`
- `src/integrations/supabase/types.ts`
- nova migration em `supabase/migrations/...` para a tabela segura do proxy interno

Detalhes técnicos:
- A correção principal não é “trocar mais um sufixo no username”.
- O problema real é tornar o proxy interno confiável para a ferramenta que você usa, inclusive quando ela não aceita bem host em domínio.
- Por isso, a solução robusta é:
  1. manter a geração automática;
  2. permitir override manual seguro com o valor exato que funcionar no seu ambiente;
  3. priorizar esse override só para o painel interno;
  4. preservar todo o resto do sistema comercial intacto.

Resultado esperado:
- Você terá uma tela interna funcional para uso operacional.
- Poderá usar o perfil automático quando funcionar.
- Quando não funcionar, poderá salvar o host/credenciais exatos que validaram na sua ferramenta, sem quebrar entrega nem cobrança.
