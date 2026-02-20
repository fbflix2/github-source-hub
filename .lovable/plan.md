

## Solucao: Campo de Foto do Perfil Manual

### Problema
O Facebook nao permite mais acessar fotos de perfil via `graph.facebook.com/{id}/picture` sem um token de aplicativo (App Access Token). A API retorna uma silhueta generica em vez da foto real, e como a imagem carrega sem erro, o fallback nunca e acionado.

### Solucao
Adicionar um campo `foto_url` no formulario de cadastro/edicao do perfil, onde o admin pode colar a URL direta da foto do perfil do Facebook (copiada manualmente do navegador). Essa URL sera salva no campo `data` (JSON) do item e usada como avatar no estoque.

### Alteracoes

**1. `src/pages/admin/AdminBlocagem.tsx`**
- Adicionar campo "URL da Foto do Perfil" (opcional) no formulario de perfil
- Salvar o valor em `data.foto_url`

**2. `src/components/admin/EditStockItemModal.tsx`**
- Adicionar campo "URL da Foto do Perfil" no modal de edicao
- Carregar e salvar `data.foto_url`

**3. `src/pages/admin/AdminEstoque.tsx`**
- Na coluna TIPO/NOME, para itens do tipo `perfil`:
  - Verificar se `item.data?.foto_url` existe
  - Se sim, usar essa URL como `src` da imagem (com fallback para icone)
  - Remover a tentativa de usar `graph.facebook.com` (nao funciona mais sem token)
  - Manter o fallback com icone `UserRound` caso a foto nao carregue

### Como o admin obtem a URL da foto
O admin pode clicar com botao direito na foto do perfil no Facebook e copiar o endereco da imagem. Essa URL direta funciona como `src` de uma tag `<img>`.

### Detalhes tecnicos
- O campo `foto_url` e armazenado no JSONB `data` existente, sem necessidade de alterar o schema do banco
- Fallback com `onError` continua funcionando caso a URL expire ou fique invalida
- Campo e opcional, nao impacta perfis ja cadastrados
