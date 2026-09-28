CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _rid uuid;
BEGIN
  BEGIN
    _rid := NULLIF(NEW.raw_user_meta_data->>'reseller_id','')::uuid;
  EXCEPTION WHEN others THEN _rid := NULL; END;
  IF _rid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.resellers WHERE id = _rid) THEN
    _rid := NULL;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, reseller_id)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', _rid);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$function$;