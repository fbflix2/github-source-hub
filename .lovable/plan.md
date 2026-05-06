## Objetivo
Suportar vídeos do Vimeo e enriquecer a página de tutoriais com descrição, materiais de apoio, comentários, feedback de utilidade e botões de copiar.

## 1. Player Vimeo (correção do bug atual)
- Em `src/pages/Tutorials.tsx`, criar helper `getEmbedUrl` que detecta YouTube **e** Vimeo:
  - Vimeo: `https://vimeo.com/123` ou `https://vimeo.com/manage/videos/123` → `https://player.vimeo.com/video/123?autoplay=1`
- Thumbnail Vimeo: usar campo `thumbnail_url` se preenchido; se não, fallback para placeholder com ícone Play (a API oEmbed do Vimeo exige requisição extra — manteremos simples).
- Manter o mesmo modal/iframe usado no YouTube, com `allow="autoplay; fullscreen; picture-in-picture"`.

## 2. Novo modal de tutorial (substitui o overlay simples)
Layout em duas colunas (empilha no mobile):
- **Esquerda:** player do vídeo (YouTube ou Vimeo).
- **Direita / abaixo:** título, categoria, descrição, materiais para baixar, links para copiar, feedback (👍 útil / 👎 não útil) e seção de comentários.

## 3. Materiais de apoio + Links com copiar (configurado no admin)
Adicionar campos JSON ao registro de tutorial:
- `attachments`: lista de `{ label, url }` — exibidos como botões "Baixar".
- `copy_items`: lista de `{ label, value }` — exibidos com ícone de cópia (clipboard).

No `AdminTutoriais.tsx`, no formulário de criar/editar:
- Seção "Materiais para download" (adicionar/remover linhas com nome + URL).
- Seção "Links / dados para copiar" (adicionar/remover linhas com rótulo + valor).

## 4. Feedback e comentários
Nova tabela `tutorial_feedback`:
- `tutorial_id`, `user_id`, `helpful` (bool), `comment` (text, nullable).
- Único por (tutorial_id, user_id) — voto/comentário substitui o anterior.
- RLS: usuário autenticado lê todos os comentários do tutorial; insere/atualiza só o próprio; admin pode tudo.

Na página do tutorial:
- Botões "👍 Foi útil" / "👎 Não foi útil" (mostra contador agregado).
- Campo de comentário opcional, lista comentários recentes (com nome/avatar do autor via profiles).

## 5. Detalhes técnicos
- Nova migration adiciona colunas `attachments jsonb default '[]'` e `copy_items jsonb default '[]'` em `tutorials`, e cria `tutorial_feedback`.
- Atualizar tipos consumidos em `Tutorials.tsx` e `AdminTutoriais.tsx`.
- Botão de copiar usa `navigator.clipboard.writeText` + toast.
- Componente novo: `src/components/tutorials/TutorialPlayerModal.tsx` para concentrar a UI rica.

## Arquivos afetados
- `src/pages/Tutorials.tsx` (refatora modal, adiciona Vimeo)
- `src/pages/admin/AdminTutoriais.tsx` (campos novos no form)
- `src/components/tutorials/TutorialPlayerModal.tsx` (novo)
- nova migration SQL

Confirma para eu implementar?