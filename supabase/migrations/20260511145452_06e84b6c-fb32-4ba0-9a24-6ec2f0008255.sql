-- Create WhatsApp Flows table
CREATE TABLE public.whatsapp_flows (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create WhatsApp Flow Steps table
CREATE TABLE public.whatsapp_flow_steps (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    flow_id UUID NOT NULL REFERENCES public.whatsapp_flows(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    message_type TEXT NOT NULL CHECK (message_type IN ('text', 'image', 'audio', 'button')),
    content TEXT, -- Text message, Image URL or Audio URL
    delay_minutes INTEGER NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add audio_url to whatsapp_logs
ALTER TABLE public.whatsapp_logs ADD COLUMN audio_url TEXT;

-- Enable RLS
ALTER TABLE public.whatsapp_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_flow_steps ENABLE ROW LEVEL SECURITY;

-- Policies for flows
CREATE POLICY "Users can manage their own flows" 
ON public.whatsapp_flows 
FOR ALL 
USING (auth.uid() = user_id);

-- Policies for steps
CREATE POLICY "Users can manage their own flow steps" 
ON public.whatsapp_flow_steps 
FOR ALL 
USING (
    flow_id IN (SELECT id FROM public.whatsapp_flows WHERE user_id = auth.uid())
);

-- Trigger for updated_at on whatsapp_flows
CREATE TRIGGER update_whatsapp_flows_updated_at
BEFORE UPDATE ON public.whatsapp_flows
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_whatsapp_flows_user_id ON public.whatsapp_flows(user_id);
CREATE INDEX idx_whatsapp_flow_steps_flow_id ON public.whatsapp_flow_steps(flow_id);
