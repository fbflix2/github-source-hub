-- Auto-greeting: quando um cliente abre um ticket, o sistema responde
-- automaticamente com a mensagem de saudação inicial (mesma usada nos
-- templates do admin), simulando resposta em segundos.

CREATE OR REPLACE FUNCTION public.send_ticket_greeting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_name text;
BEGIN
  -- Busca o primeiro nome do cliente que abriu o ticket
  SELECT split_part(full_name, ' ', 1)
  INTO v_first_name
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  INSERT INTO public.ticket_messages (ticket_id, content, sender, read)
  VALUES (
    NEW.id,
    'Olá ' || COALESCE(v_first_name, '') ||
      '! Recebemos seu ticket e nossa equipe já está verificando. Aguarde, retornaremos o quanto antes.',
    'support',
    false
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_greeting ON public.tickets;

CREATE TRIGGER trg_ticket_greeting
AFTER INSERT ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.send_ticket_greeting();
