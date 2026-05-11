-- 1) Switch product icon_type from 'bm' to 'perfil'
UPDATE public.products
SET icon_type = 'perfil'
WHERE id = 'c363f81b-d51f-4f24-8ec0-20fa5082a619';

-- 2) Helper: parse a credential line like
--    "Usuario: X | Senha: Y | Token: Z"
--    "user:X\SENHA:Y|TOKEN2FA:|Z"
-- and return jsonb with emailAcesso, senha, token2fa
CREATE OR REPLACE FUNCTION public._parse_insta_credential(_line text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_user text;
  v_pass text;
  v_token text;
  m text[];
BEGIN
  IF _line IS NULL OR length(trim(_line)) = 0 THEN
    RETURN '{}'::jsonb;
  END IF;

  -- Usuario / user
  m := regexp_match(_line, '(?:usuario|user)\s*[:=]\s*([^|\\\n]+)', 'i');
  IF m IS NOT NULL THEN v_user := trim(m[1]); END IF;

  -- Senha
  m := regexp_match(_line, 'senha\s*[:=]\s*([^|\\\n]+)', 'i');
  IF m IS NOT NULL THEN v_pass := trim(m[1]); END IF;

  -- Token (Token / TOKEN2FA / 2fa) — capture rest of line after marker
  m := regexp_match(_line, '(?:token2fa|token\s*2fa|token)\s*[:=]\s*\|?\s*(.+)$', 'i');
  IF m IS NOT NULL THEN
    v_token := trim(m[1]);
    -- Remove trailing pipes/whitespace
    v_token := regexp_replace(v_token, '\s*\|\s*$', '');
  END IF;

  RETURN jsonb_strip_nulls(jsonb_build_object(
    'emailAcesso', v_user,
    'senha', v_pass,
    'token2fa', v_token
  ));
END;
$$;

-- 3) Update stock_items for the Instagram product: parse identification_link into data fields,
--    and set identification = username, name = "Perfil <username>", clear identification_link
UPDATE public.stock_items si
SET
  data = COALESCE(si.data, '{}'::jsonb)
         || public._parse_insta_credential(COALESCE(si.identification_link, si.name))
         - 'rawBmInput',
  identification = COALESCE(
    public._parse_insta_credential(COALESCE(si.identification_link, si.name))->>'emailAcesso',
    si.identification
  ),
  name = CASE
    WHEN public._parse_insta_credential(COALESCE(si.identification_link, si.name))->>'emailAcesso' IS NOT NULL
      THEN 'Perfil ' || (public._parse_insta_credential(COALESCE(si.identification_link, si.name))->>'emailAcesso')
    ELSE si.name
  END,
  identification_link = NULL,
  updated_at = now()
WHERE si.product_id = 'c363f81b-d51f-4f24-8ec0-20fa5082a619';

-- 4) Update already-delivered order_items: replace bmLinks with parsed credentials in delivery_data
UPDATE public.order_items oi
SET delivery_data = (
  COALESCE(oi.delivery_data, '{}'::jsonb)
  || public._parse_insta_credential(
       COALESCE(
         (oi.delivery_data->'bmLinks'->>0),
         oi.delivery_data->>'linkPerfil',
         oi.delivery_data->>'rawBmInput'
       )
     )
) - 'bmLinks' - 'linkPerfil' - 'rawBmInput'
WHERE oi.product_id = 'c363f81b-d51f-4f24-8ec0-20fa5082a619'
  AND oi.delivery_data IS NOT NULL
  AND (oi.delivery_data ? 'bmLinks' OR oi.delivery_data ? 'linkPerfil' OR oi.delivery_data ? 'rawBmInput');

-- 5) Cleanup helper
DROP FUNCTION public._parse_insta_credential(text);