

## Plano: Criar "Dash Fabricio" - Sub-painel Financeiro dentro do Admin

### Resumo
Adicionar um submenu no item "Dashboard" da sidebar admin (igual ao padrão de "Gestão Itens", "Central Proxy", etc.) com duas opções: "Painel FBFLIX" (dashboard atual) e "Dash Fabricio" (novo painel financeiro independente). O "Dash Fabricio" terá autenticação por senha própria e um sistema financeiro completo com sidebar/menu próprio.

### Etapas

#### 1. Banco de Dados - Criar tabelas do Fb Finance
Criar via migration as seguintes tabelas (todas com RLS para staff):

- **fb_finance_config**: senha de acesso (hash), configurações globais de % distribuição
- **fb_finance_lancamentos**: data, tipo (pessoal/empresa), categoria, descricao, entrada, saida, caixa_destino
- **fb_finance_caixas**: nome, saldo_atual, alvo_percent, tipo (pessoal/empresa)
- **fb_finance_distribuicoes**: data, entrada_dia, percentuais JSONB, valores alocados JSONB
- **fb_finance_despesas_planejadas**: nome, valor, dia_vencimento, categoria, pago (boolean), mes_ref

#### 2. Sidebar - Adicionar submenu no Dashboard
Modificar `AdminSidebar.tsx` e `AdminMobileSidebar.tsx`:
- Transformar "Dashboard" em item com subItems:
  - "Painel FBFLIX" → `/admin` (dashboard atual)
  - "Dash Fabricio" → `/admin/dash-fabricio`

#### 3. Página Gate de Senha (`AdminDashFabricio.tsx`)
- Tela de login com senha dedicada
- No primeiro acesso: cadastrar senha (salva hash em `fb_finance_config`)
- Nos acessos seguintes: pedir senha para entrar
- Após autenticação, renderiza o painel financeiro completo

#### 4. Painel Financeiro - Componente Principal (`FbFinanceDashboard.tsx`)
Componente independente com:
- **Sidebar própria** (menu lateral interno) com navegação entre as abas
- **6 abas/páginas internas** (state-based, não rotas separadas):
  1. **Dashboard Principal**: Cards (Saldo Pessoal, Empresa, Patrimonio), gráfico pizza alocação, gráfico linha Capital de Giro 90 dias, KPIs, barra progresso orçamento
  2. **Lançamentos Diários**: Formulário + tabela filtrável
  3. **Caixas/Envelopes**: Cards de cada caixa com saldo, %, crescimento
  4. **Distribuição Diária PJ**: Tabela com % editáveis, cálculo automático, prova real
  5. **Planejamento Mensal Pessoal**: Despesas fixas/variáveis editáveis, gráfico barras
  6. **Relatórios**: Filtros por mês/ano, gráficos de evolução

#### 5. Rota no App.tsx
Adicionar rota: `<Route path="dash-fabricio" element={<AdminDashFabricio />} />`

### Detalhes Técnicos

- Design dark mode com tons azul escuro + verde (positivo) / vermelho (negativo)
- Formatação R$ pt-BR em todos os valores
- Dados de exemplo pré-populados (salário R$7000, aluguel R$2000, entradas PJ ~R$1000/dia)
- Caixas default: Conta Corrente Pessoal, Capital Giro, Fundos Reserva, Dividendos, Operacional, Dia a Dia, Investimentos, Fundo Emergência, Estilo de Vida, Janela Oportunidade
- % distribuição default: Capital Giro 2%, Fundos Reserva 15%, Dividendos 1%, Operacional 80%, Dia a Dia 2%
- Responsivo (sidebar colapsa em mobile)
- Nenhuma alteração nas funcionalidades existentes da FBFLIX

### Arquivos a criar/modificar
- **Modificar**: `AdminSidebar.tsx`, `AdminMobileSidebar.tsx`, `App.tsx`
- **Criar**: `src/pages/admin/AdminDashFabricio.tsx` (gate de senha + container)
- **Criar**: `src/components/admin/fb-finance/FbFinanceDashboard.tsx` (painel principal)
- **Criar**: `src/components/admin/fb-finance/FbFinanceSidebar.tsx` (sidebar interna)
- **Criar**: `src/components/admin/fb-finance/FbDashboardHome.tsx`
- **Criar**: `src/components/admin/fb-finance/FbLancamentos.tsx`
- **Criar**: `src/components/admin/fb-finance/FbCaixas.tsx`
- **Criar**: `src/components/admin/fb-finance/FbDistribuicaoPJ.tsx`
- **Criar**: `src/components/admin/fb-finance/FbPlanejamentoPessoal.tsx`
- **Criar**: `src/components/admin/fb-finance/FbRelatorios.tsx`
- **Migration**: Tabelas do Fb Finance

