-- Criar tabela de solicitações de compra
CREATE TABLE public.purchase_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('bm', 'perfil')),
    quantity INTEGER NOT NULL DEFAULT 1,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ativar RLS
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
-- Administradores podem fazer tudo (será validado via service role ou políticas específicas de admin se existirem)
-- Fornecedores podem apenas visualizar solicitações abertas
CREATE POLICY "Suppliers can view open purchase requests" 
ON public.purchase_requests 
FOR SELECT 
USING (status = 'open');

-- Trigger para updated_at
CREATE TRIGGER update_purchase_requests_updated_at
BEFORE UPDATE ON public.purchase_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
