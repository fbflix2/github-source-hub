INSERT INTO public.notification_sounds (event_key, label, active)
VALUES ('client_notification', 'Notificação do Cliente', true)
ON CONFLICT DO NOTHING;