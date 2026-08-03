---
name: proxy-auto-renew-priority
description: Auto-renew always runs before expiration warnings in proxy-lifecycle — clients with balance get renewed + thanked, never warned
type: feature
---
No `proxy-lifecycle`, ANTES de qualquer aviso de vencimento (d-1, d0, d+1..d+4):

1. Filtra assinaturas com `auto_renew = true` e saldo do cliente > 0.
2. Chama `proxyfbflix-api` action `migrate-proxybr-renewal` com `auto_renew_user_id` (via fetch direto com service role key, para ler o body de erro).
3. Se renovou: limpa `grace_notifications`, remove a assinatura do pipeline de notificações e envia WhatsApp de AGRADECIMENTO ("Renovação automática concluída", valor, próximo vencimento) — nunca aviso de vencimento.
4. Só quem não tem saldo/auto_renew recebe os avisos de vencimento e cobrança de carência.

Parâmetros de teste do endpoint: `{"only_names": ["WS-XXXX"]}` roda o lifecycle apenas nas assinaturas informadas; `{"dry_run": true}` desliga o auto-renew; `{"reset_and_run": true}` limpa grace_notifications de todas.

Why: cliente Luiz Ricardo (R$107 de saldo, 3 proxies com auto_renew) recebeu aviso "vence em 0 dias" e ficou expired em vez de ser renovado.
