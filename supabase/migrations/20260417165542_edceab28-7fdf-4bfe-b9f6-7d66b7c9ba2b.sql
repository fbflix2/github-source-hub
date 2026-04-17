-- 1) Add new email columns to supplier_accounts
ALTER TABLE public.supplier_accounts
  ADD COLUMN IF NOT EXISTS email_principal text,
  ADD COLUMN IF NOT EXISTS email_password text,
  ADD COLUMN IF NOT EXISTS email_alt text;

-- 2) Backfill existing rows by parsing the `notes` field which holds the raw line.
--    Expected format: ID|SENHA_FB|EMAIL_PRINCIPAL|SENHA_EMAIL|EMAIL_ALT
--    Some lines may have empty fields (e.g. ID|SENHA_FB||EMAIL|SENHA_EMAIL|EMAIL_ALT)
DO $$
DECLARE
  r record;
  parts text[];
  v_login text;
  v_pass text;
  v_email text;
  v_email_pass text;
  v_email_alt text;
BEGIN
  FOR r IN
    SELECT id, notes
    FROM public.supplier_accounts
    WHERE notes IS NOT NULL
      AND notes LIKE '%|%|%'
      AND (email_principal IS NULL OR email_alt IS NULL)
  LOOP
    -- Take only the first segment before any newline / cookie blob
    parts := string_to_array(split_part(r.notes, E'\n', 1), '|');

    IF array_length(parts, 1) >= 3 THEN
      v_login      := NULLIF(trim(COALESCE(parts[1], '')), '');
      v_pass       := NULLIF(trim(COALESCE(parts[2], '')), '');
      v_email      := NULLIF(trim(COALESCE(parts[3], '')), '');
      v_email_pass := NULLIF(trim(COALESCE(parts[4], '')), '');
      v_email_alt  := NULLIF(trim(COALESCE(parts[5], '')), '');

      -- Only keep tokens that look like emails for the email columns
      IF v_email IS NOT NULL AND v_email NOT LIKE '%@%' THEN v_email := NULL; END IF;
      IF v_email_alt IS NOT NULL AND v_email_alt NOT LIKE '%@%' THEN v_email_alt := NULL; END IF;

      UPDATE public.supplier_accounts
      SET
        email_principal = COALESCE(email_principal, v_email),
        email_password  = COALESCE(email_password, v_email_pass),
        email_alt       = COALESCE(email_alt, v_email_alt)
      WHERE id = r.id;
    END IF;
  END LOOP;
END $$;