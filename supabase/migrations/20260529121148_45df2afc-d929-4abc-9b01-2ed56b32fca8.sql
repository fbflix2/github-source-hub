DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.whatsapp_templates WHERE event_key = 'ct_replacement') THEN
        INSERT INTO public.whatsapp_templates (name, event_key, message_body, active)
        VALUES (
            'Troca de Contingência',
            'ct_replacement',
            'Olá {{nome}} 👋\n\nInformamos que a troca do seu item de contingência foi realizada com sucesso! ✅\n\n🔹 *Item:* {{produto}}\n📋 *Motivo:* {{motivo}}\n\nSua estrutura já está atualizada e pronta para uso. 🚀\n\nQualquer dúvida, estamos à disposição!',
            true
        );
    ELSE
        UPDATE public.whatsapp_templates
        SET message_body = 'Olá {{nome}} 👋\n\nInformamos que a troca do seu item de contingência foi realizada com sucesso! ✅\n\n🔹 *Item:* {{produto}}\n📋 *Motivo:* {{motivo}}\n\nSua estrutura já está atualizada e pronta para uso. 🚀\n\nQualquer dúvida, estamos à disposição!',
            name = 'Troca de Contingência'
        WHERE event_key = 'ct_replacement';
    END IF;
END $$;
