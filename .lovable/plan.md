

## Plan: Bloco Padrão (Template de Download para Perfis)

### Concept
Admins upload a `.txt` template with placeholders (e.g., `{{email}}`, `{{senha}}`, `{{token2fa}}`). When a customer who bought a **perfil** item downloads their "bloco de notas", the system replaces the placeholders with the actual profile data, delivering a formatted file based on the selected template.

### Database Changes
**New table `block_templates`:**
- `id` (uuid, PK)
- `name` (text) - template name
- `content` (text) - the raw .txt content with placeholders
- `is_default` (boolean, default false) - marks the active template
- `created_at`, `updated_at` (timestamptz)

RLS: Staff can manage, anyone can read the default template (needed for client-side download).

### Available Placeholders
Based on the `StockData` fields and order data:
- `{{nomePerfil}}`, `{{emailAcesso}}`, `{{emailAlternativo}}`, `{{senha}}`, `{{token2fa}}`
- `{{dataNascimento}}`, `{{genero}}`, `{{tempoPlataforma}}`, `{{statusAtual}}`
- `{{descricao}}`, `{{cookies}}`, `{{linkDocumento}}`
- `{{pedido}}`, `{{data}}`, `{{nomeProduto}}`

### New Admin Page: `AdminBlocoPadrao.tsx`
- Located at `/admin/configuracoes/bloco-padrao`
- Upload .txt file or paste template content directly in a textarea
- Live preview panel showing how placeholders will render with sample data
- List of saved templates with ability to set one as default
- Reference card listing all available placeholders

### Sidebar Change
Add "Bloco Padrão" sub-item under "Configurações" in `AdminSidebar.tsx` with `FileText` icon.

### Client Download Change: `ItemDetails.tsx`
- Modify the `downloadBloco` function (currently hardcoded at lines 218-244)
- Fetch the default `block_template` from Supabase
- If a template exists, replace all `{{placeholder}}` tokens with actual stock data
- If no template exists, fall back to the current hardcoded format

### Implementation Steps
1. Create `block_templates` migration with RLS policies
2. Create `AdminBlocoPadrao.tsx` page with template CRUD and .txt upload
3. Add route and sidebar entry for the new page
4. Update `downloadBloco` in `ItemDetails.tsx` to use the template

