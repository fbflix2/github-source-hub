Como o sistema já possui uma infraestrutura de administração robusta, o plano é estender a tabela de perfis de usuário para permitir a configuração de um multiplicador de preço (desconto) ou uma categoria de preços especial diretamente no controle interno.

### Alterações sugeridas:

1.  **Banco de Dados**:
    *   Adicionar uma coluna `proxy_price_multiplier` (numeric) à tabela `public.profiles`. Isso permitirá definir, por exemplo, que um cliente específico paga 0.8 (80%) do valor padrão.
    *   Alternativamente, podemos adicionar uma coluna `custom_proxy_price` (numeric) ou uma flag para uma categoria VIP. Dado o seu pedido de "custo específico", um multiplicador ou um campo de preço customizado é o mais flexível. Vou seguir com `proxy_price_multiplier` para facilitar a manutenção de múltiplos produtos de proxy.

2.  **Interface Admin (Controle Interno)**:
    *   Atualizar o componente `ClientEditModal.tsx` para incluir um novo campo de entrada: "Multiplicador de Preço Proxy".
    *   O administrador poderá definir um valor (ex: 0.90 para 10% de desconto ou 1.0 para preço normal).

3.  **Lógica de Venda (Frontend/Checkout)**:
    *   Ao listar os produtos de proxy ou processar o checkout, o sistema verificará se o perfil do usuário logado possui um `proxy_price_multiplier`.
    *   Se possuir, o preço exibido e cobrado será `preço_original * multiplicador`.

### Detalhes Técnicos:
*   **Migração SQL**: `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS proxy_price_multiplier NUMERIC DEFAULT 1.0;`
*   **Componente**: Modificar `src/components/admin/ClientEditModal.tsx` para ler e salvar este novo campo.
*   **Hook de Preço**: (Opcional) Criar ou atualizar um hook que calcula o preço final do produto baseado no perfil do usuário.

Dessa forma, você terá total controle sobre quanto cada cliente paga pelos proxys diretamente na tela de "Clientes" do seu admin.

Deseja que eu siga com a criação da coluna no banco e a atualização da interface de edição de cliente?
