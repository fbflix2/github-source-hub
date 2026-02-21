

# Importador Inteligente de Clientes

## Problema Atual
O importador atual assume que a planilha sempre tem 3 colunas fixas (Nome, Email, Telefone) e tenta criar usuários usando `supabase.auth.admin` direto do navegador -- o que **nao funciona** com a chave anon. Precisamos de uma solução robusta.

## O que a planilha contém
A planilha `users.xlsx` possui **3 colunas**: Nome, Email e Telefone. O importador será atualizado para detectar automaticamente qualquer coluna disponível.

## Plano de Implementação

### 1. Criar Edge Function `import-clients`
Uma nova Edge Function que recebe os dados dos clientes e:
- Verifica se o chamador é admin
- Usa `supabase.auth.admin.createUser` (com service role) para criar cada usuário com `email_confirm: true` (conta já ativa)
- Atualiza o perfil com todos os dados extras (phone, cpf, cep, address, birth_date)
- Retorna quantos tiveram sucesso e quantos falharam, com detalhes dos erros

### 2. Atualizar `ImportClientsModal.tsx`
- **Detecção inteligente de colunas**: Ao ler o arquivo, o sistema verifica se a primeira linha parece ser um cabeçalho (ex: "nome", "email", "telefone", "cpf", "endereço", "cep", "data de nascimento"). Se sim, usa como mapeamento. Se não, assume a ordem padrão (Nome, Email, Telefone)
- **Mapeamento flexível**: Suportar sinônimos (ex: "fone" = "telefone", "name" = "nome", "endereco" = "address")
- **Interface de preview**: Mostrar todas as colunas detectadas na tabela de preview, não apenas as 3 fixas
- **Instruções atualizadas**: Informar que o sistema aceita colunas extras como CPF, Endereço, CEP, Data de Nascimento
- **Chamada via Edge Function**: Substituir a criação direta por chamadas à nova edge function `import-clients`
- **Barra de progresso**: Mostrar o andamento da importação (X de Y processados)

### 3. Campos suportados no mapeamento

| Coluna na Planilha | Campo no Perfil |
|---|---|
| nome / name | full_name |
| email / e-mail | email (auth) |
| telefone / phone / fone / celular | phone |
| cpf / documento | cpf |
| cep / zip | cep |
| endereco / endereço / address | address |
| nascimento / birth / data_nascimento | birth_date |

---

## Detalhes Técnicos

### Edge Function `import-clients`
```
POST /import-clients
Body: { clients: [{ email, full_name, phone?, cpf?, cep?, address?, birth_date? }] }
Response: { success: number, failed: number, errors: string[] }
```

A função processa os clientes em lote:
1. Para cada cliente, chama `auth.admin.createUser` com email_confirm: true
2. Aguarda o trigger criar o perfil, depois faz update com os campos extras
3. Acumula resultados e retorna o resumo

### Detecção de cabeçalho
O sistema normaliza a primeira linha (lowercase, sem acentos) e verifica se contém palavras-chave como "nome", "email", "telefone". Se pelo menos 2 corresponderem, trata como cabeçalho e usa para mapear as colunas. Caso contrário, assume ordem padrão.

### Arquivos modificados
- `supabase/functions/import-clients/index.ts` -- novo
- `src/components/admin/ImportClientsModal.tsx` -- reescrito com detecção inteligente
- `supabase/config.toml` -- adicionar nova function

