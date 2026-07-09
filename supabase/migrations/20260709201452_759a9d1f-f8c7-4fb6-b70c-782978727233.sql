INSERT INTO public.resellers (user_id, slug, company_name, brand_name, model, commission_rate, status, primary_color, accent_color, support_email, support_whatsapp)
VALUES ('c346e31d-3725-4235-8d84-e4715ee48366', 'revenda-teste', 'Revenda Teste LTDA', 'Revenda Teste', 'percentage', 25, 'active', '#22c55e', '#0ea5e9', 'suporte@revendateste.com.br', '5511999999999')
ON CONFLICT (slug) DO NOTHING;