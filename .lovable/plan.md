

## Exibir Foto do Perfil do Facebook no Estoque

### Como funciona
O Facebook disponibiliza fotos de perfil publicas atraves da URL `https://graph.facebook.com/{ID}/picture?type=normal`. Usando o ID do perfil que ja esta salvo no campo `identification` dos itens do tipo "perfil", podemos exibir a foto real no lugar do icone generico.

### Alteracoes

**Arquivo: `src/pages/admin/AdminEstoque.tsx`**
- Na coluna "TIPO / NOME", para itens do tipo `perfil` que possuem um `identification` (ID numerico do Facebook):
  - Substituir o icone generico por uma tag `<img>` com a URL `https://graph.facebook.com/{ID}/picture?type=normal`
  - Manter o icone como fallback caso a imagem nao carregue (usando `onError` para esconder a imagem)
  - Estilizar como avatar circular (arredondado) no mesmo tamanho do icone atual (40x40px)
- Para itens que nao sao do tipo `perfil` ou que nao possuem ID, manter o icone padrao

### Detalhes tecnicos
- A URL `https://graph.facebook.com/{id}/picture` redireciona para a foto publica do perfil. Funciona sem autenticacao para perfis publicos
- Adicionar estado local ou tratamento `onError` na tag `<img>` para exibir o fallback (icone `UserRound`) caso a foto nao esteja disponivel
- Nenhuma dependencia nova necessaria, nenhuma alteracao no banco de dados

### Limitacoes
- So funciona para perfis com foto publica
- Se o Facebook bloquear o acesso, o fallback com icone sera exibido automaticamente

