CREATE TABLE public.proxy_usage_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric TEXT NOT NULL, -- 'bandwidth_gb'
    period TEXT NOT NULL, -- '1h', '24h', '7d'
    threshold NUMERIC NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.proxy_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    bytes_downloaded BIGINT DEFAULT 0,
    bytes_uploaded BIGINT DEFAULT 0,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    supplier TEXT DEFAULT 'webshare',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.proxy_usage_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proxy_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage usage alerts" ON public.proxy_usage_alerts
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view usage logs" ON public.proxy_usage_logs
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Trigger para updated_at
CREATE TRIGGER update_proxy_usage_alerts_updated_at
    BEFORE UPDATE ON public.proxy_usage_alerts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
