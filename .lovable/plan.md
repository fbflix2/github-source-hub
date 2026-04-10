

## Problema

Os filtros "2FA Ativo", "BM Criada" e "Página Criada" na Auditoria e Relatórios estão usando dados combinados (checkbox manual + detecção automática por regex em títulos de tarefas). Isso faz com que perfis apareçam nos filtros mesmo sem o operador ter marcado a caixinha correspondente.

## Solução

Alterar os filtros para usar **exclusivamente** os dados manuais (checkboxes marcados pelo operador), ignorando a detecção automática por tarefas.

## Alterações

### 1. `src/components/admin/warming/WarmingAuditDashboard.tsx`
- Linha ~121-127: O `effectiveQualityMap` usa `getEffectiveProfileQualityWithSource` que combina manual + task evidence
- Alterar para que os **filtros** usem apenas `qualityMap` (dados manuais puros passados como prop) em vez de `effectiveQualityMap`
- Os badges de exibição e contadores podem continuar usando `effectiveQualityMap` para informação visual, mas a filtragem (linhas 174-176) deve consultar `qualityMap` diretamente

### 2. `src/pages/admin/AdminEsteiraAdmin.tsx`
- Linha ~827-832: O `derivedQualityMap` é construído com `getEffectiveProfileQuality` que mistura manual + task evidence
- Criar um segundo mapa `manualOnlyQualityMap` que guarda apenas os dados manuais dos checkboxes (sem passar por `getEffectiveProfileQuality`)
- Passar esse mapa manual para os filtros
- O `qualityMap` existente (derivado) pode continuar sendo usado para exibição visual (badges 2FA, BM, Page nos cards)

### 3. Fluxo corrigido
- Operador marca checkbox "2FA" no perfil → salva em `site_settings` como `warming_quality_{profileId}`
- Admin filtra por "2FA Ativo" → sistema consulta apenas os dados salvos manualmente pelo operador
- Perfis que apenas têm tarefas com título mencionando "2FA" mas sem checkbox marcado **não aparecem** no filtro

