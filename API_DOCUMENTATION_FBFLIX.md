# Documentação da API ProxyFbflix

Bem-vindo à documentação oficial da API ProxyFbflix. Esta API permite que sistemas externos integrem nossa infraestrutura de proxies residenciais e móveis, permitindo a compra, listagem e gestão de proxies programaticamente.

## 1. Autenticação

Todas as requisições devem incluir um cabeçalho de autorização com um token JWT válido:

```http
Authorization: Bearer <SEU_TOKEN_DE_ACESSO>
```

> **Nota:** O token de acesso pode ser obtido através do login na plataforma ou solicitado ao suporte técnico para integrações B2B.

---

## 2. Endpoints Base

**URL Base:** `https://[SUA_URL_SUPABASE].supabase.co/functions/v1/proxyfbflix-api`

Todas as requisições utilizam o método **POST** com o corpo em formato JSON.

---

## 3. Comprar Proxy via Saldo

Este endpoint permite adquirir um novo proxy utilizando o saldo disponível na carteira da conta.

- **Action:** `purchase-proxy-with-balance`
- **Corpo da Requisição:**

```json
{
  "action": "purchase-proxy-with-balance",
  "total": 9.90,
  "product_id": "UUID_DO_PRODUTO",
  "order_id": "ID_INTERNO_DO_PEDIDO",
  "quantity": 1
}
```

- **Resposta de Sucesso (200 OK):**

```json
{
  "success": true,
  "quantity": 1,
  "subscriptions": ["WS-XXXXXX"],
  "proxies": [
    {
      "ip": "1.2.3.4",
      "port": 8080,
      "username": "user",
      "password": "pass"
    }
  ]
}
```

---

## 4. Listar Meus Proxies

Retorna a lista de proxies vinculados à conta.

- **Action:** `get-proxy-list`
- **Corpo da Requisição:**

```json
{
  "action": "get-proxy-list",
  "page": 1,
  "page_size": 250
}
```

---

## 5. Trocar Proxy (Substituição)

Solicita a troca de um proxy por um novo (útil em caso de falha ou renovação de IP).

- **Action:** `replace-proxy`
- **Corpo da Requisição:**

```json
{
  "action": "replace-proxy",
  "proxy_id": "ID_DO_PROXY"
}
```

---

## 6. Sincronizar Credenciais

Sincroniza as credenciais locais com o provedor Fbflix.

- **Action:** `sync-proxyfbflix-proxy-credentials`
- **Corpo da Requisição:**

```json
{
  "action": "sync-proxyfbflix-proxy-credentials",
  "subscription_id": "UUID_DA_ASSINATURA"
}
```

---

## 7. Status de Consumo (Bandwidth)

Verifica o consumo de banda e estatísticas do plano.

- **Action:** `get-bandwidth-stats`
- **Corpo da Requisição:**

```json
{
  "action": "get-bandwidth-stats"
}
```

---

## Erros Comuns

- `401 Unauthorized`: Token inválido ou expirado.
- `429 Too Many Requests`: Limite de requisições atingido.
- `Saldo insuficiente`: A conta não possui saldo para completar a compra.
- `Nenhum proxy disponível`: Estoque de proxies do país solicitado está zerado.

Para suporte adicional, entre em contato via nosso canal oficial.
