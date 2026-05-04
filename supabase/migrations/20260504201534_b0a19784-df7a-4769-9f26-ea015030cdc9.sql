-- Remover políticas antigas para garantir limpeza
DROP POLICY IF EXISTS "Staff can manage request items" ON public.supplier_request_items;
DROP POLICY IF EXISTS "Users can manage supplier request items" ON public.supplier_request_items;

-- Criar política robusta para usuários autenticados
CREATE POLICY "authenticated_manage_request_items" 
ON public.supplier_request_items 
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- Garantir que a tabela tenha RLS habilitado (caso tenha sido desativado)
ALTER TABLE public.supplier_request_items ENABLE ROW LEVEL SECURITY;
