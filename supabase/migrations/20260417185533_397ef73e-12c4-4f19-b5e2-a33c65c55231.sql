
-- Backfill supplier_accounts: re-parse notes to populate email_principal, email_password, email_alt correctly
-- Format: ID|SENHA_FB||EMAIL_PRINCIPAL|SENHA_EMAIL|EMAIL_ALT|...cookies
WITH parsed AS (
  SELECT
    id,
    string_to_array(notes, '|') AS parts
  FROM supplier_accounts
  WHERE notes IS NOT NULL
    AND notes LIKE '%|%'
),
extracted AS (
  SELECT
    id,
    parts,
    -- Find first email matching hotmail/outlook/live/msn (skip first two = login/password)
    (
      SELECT trim(p)
      FROM unnest(parts[3:array_length(parts,1)]) WITH ORDINALITY t(p, ord)
      WHERE p ~* '@(hotmail|outlook|live|msn)\.'
      ORDER BY ord
      LIMIT 1
    ) AS principal_email,
    -- Find email matching fviainboxes
    (
      SELECT trim(p)
      FROM unnest(parts[3:array_length(parts,1)]) WITH ORDINALITY t(p, ord)
      WHERE p ~* '@fviainboxes\.'
      ORDER BY ord
      LIMIT 1
    ) AS alt_email
  FROM parsed
),
final AS (
  SELECT
    e.id,
    e.principal_email,
    e.alt_email,
    -- Email password = the token immediately after the principal email
    (
      SELECT trim(p)
      FROM unnest(e.parts) WITH ORDINALITY t(p, ord)
      WHERE ord = (
        SELECT ord2
        FROM unnest(e.parts) WITH ORDINALITY t2(p2, ord2)
        WHERE trim(p2) = e.principal_email
        LIMIT 1
      ) + 1
        AND p NOT LIKE '%@%'
        AND p !~* '^https?://'
      LIMIT 1
    ) AS email_pwd
  FROM extracted e
  WHERE e.principal_email IS NOT NULL
)
UPDATE supplier_accounts sa
SET
  email_principal = f.principal_email,
  email_alt = f.alt_email,
  email_password = COALESCE(f.email_pwd, sa.email_password)
FROM final f
WHERE sa.id = f.id
  AND (
    sa.email_principal IS DISTINCT FROM f.principal_email
    OR sa.email_alt IS DISTINCT FROM f.alt_email
    OR (f.email_pwd IS NOT NULL AND sa.email_password IS DISTINCT FROM f.email_pwd)
  );
