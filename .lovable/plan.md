

## Safe BM — Cofre de Backup de BMs (Plano de Implementação)

### Resumo
Criar um sistema de "cofre" para backup de Business Managers vendido como assinatura (R$ 9,99/BM protegida/mês). Inclui painel admin para gestão e visão do cliente nas assinaturas.

---

### 1. Nova tabela: `safe_bm_vaults`

```sql
CREATE TABLE public.safe_bm_vaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name TEXT,
  bm_name TEXT NOT NULL,
  bm_link TEXT NOT NULL,
  perfil_backup TEXT,              -- perfil que guarda a BM
  purchase_date TIMESTAMPTZ,       -- data de compra da BM
  protection_start TIMESTAMPTZ NOT NULL DEFAULT now(), -- início do serviço
  link_regenerations INTEGER NOT NULL DEFAULT 0, -- quantas vezes gerou novo link
  status TEXT NOT NULL DEFAULT 'active',  -- active | inactive
  subscription_price NUMERIC NOT NULL DEFAULT 9.99,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.safe_bm_vaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage safe_bm_vaults" ON public.safe_bm_vaults FOR ALL USING (is_staff(auth.uid()));
CREATE POLICY "Users can view own vaults" ON public.safe_bm_vaults FOR SELECT USING (auth.uid() = user_id);

-- Auto-update timestamp
CREATE TRIGGER update_safe_bm_vaults_updated_at 
  BEFORE UPDATE ON public.safe_bm_vaults 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

---

### 2. Nova página admin: `AdminSafeBM.tsx`

Inspirada no layout de `AdminGestaoBMs.tsx`:

- **Cards resumo**: Total protegidas, Ativas, Inativas, Receita mensal (count × R$9,99)
- **Tabela** com colunas: Cliente, Nome da BM, Perfil Backup, Link BM, Data Compra, Início Proteção, Regenerações de link, Status, Ações
- **Ações**: Ativar/Inativar, Regenerar Link (+1 no contador), Editar, Excluir
- **Modal "Adicionar BM ao Cofre"**: campos para cliente (busca por email), nome BM, link, perfil backup, data de compra
- **Filtros**: busca por texto, filtro por status (ativo/inativo/todos)

---

### 3. Rota e Sidebar

- **Rota**: `/admin/safe-bm` em `App.tsx`
- **Sidebar**: Novo item "Safe BM" com ícone `Shield` no grupo de BMs/Gestão, ao lado de "Gestão BMs"

---

### 4. Visão do cliente (página Subscriptions)

Na página de assinaturas do cliente (`/subscriptions`), exibir as BMs protegidas do usuário como cards separados mostrando:
- Nome da BM, status, data de proteção, preço mensal R$9,99

---

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar tabela `safe_bm_vaults` |
| `src/pages/admin/AdminSafeBM.tsx` | Novo — página de gestão do cofre |
| `src/App.tsx` | Adicionar rota `/admin/safe-bm` |
| `src/components/admin/AdminSidebar.tsx` | Adicionar item "Safe BM" |
| `src/pages/Subscriptions.tsx` | Seção para BMs protegidas do cliente |

