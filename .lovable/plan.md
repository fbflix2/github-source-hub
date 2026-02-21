
## Proteção de Dados Sensíveis na Pagina de Detalhes do Item

### O que muda

1. **Token 2FA oculto por padrao** -- igual a senha, exibido como "dots" com botao de olho para revelar.

2. **Disclaimer de aceite obrigatorio** -- um dialogo (modal) aparece antes de permitir:
   - Revelar o token 2FA
   - Copiar cookies
   - Baixar bloco
   
   O usuario precisa marcar um checkbox confirmando que esta ciente da politica de nao-estorno.

3. **Texto do disclaimer (4-6 linhas)**:
   > Ao revelar o codigo 2FA, copiar cookies ou baixar os dados deste item, voce reconhece que teve acesso completo as credenciais do perfil adquirido. A partir deste momento, estornos nao serao aceitos, exceto em casos de problemas tecnicos com o item que nao possam ser resolvidos pelo suporte. Ao prosseguir, voce declara estar ciente e de acordo com estes termos.

### Detalhes tecnicos

**Arquivo:** `src/pages/ItemDetails.tsx`

- Novo estado `showToken` (boolean) -- controla visibilidade do 2FA, igual ao `showPassword`.
- Novo estado `acceptedDisclaimer` (boolean) -- desbloqueado apos aceite no modal.
- Novo estado `showDisclaimer` (boolean) -- controla abertura do modal.

**Fluxo de interacao:**
- Token 2FA renderizado como `"•••••••••"` por padrao, com botao de olho.
- Ao clicar no olho do token, copiar cookies ou baixar bloco:
  - Se `acceptedDisclaimer === false` --> abre o modal de disclaimer.
  - Se `acceptedDisclaimer === true` --> executa a acao normalmente.
- No modal: checkbox + texto do disclaimer + botao "Concordo e Desejo Continuar" (desabilitado ate marcar o checkbox).
- Apos aceite, o estado `acceptedDisclaimer` fica `true` para a sessao e a acao pendente e executada automaticamente.

**Modal:** Usar `AlertDialog` do shadcn/ui ja instalado no projeto, mantendo consistencia visual.

**Botoes "Copiar Cookies" e "Baixar Bloco":** Ficam visiveis mas disparam o disclaimer se ainda nao aceito. Apos aceite, funcionam normalmente.
