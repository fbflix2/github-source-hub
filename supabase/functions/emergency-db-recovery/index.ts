import postgres from "npm:postgres@3.4.7";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const databaseUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!databaseUrl) {
    return Response.json({ ok: false, error: "Database binding unavailable" }, { status: 503 });
  }

  const sql = postgres(databaseUrl, {
    max: 1,
    connect_timeout: 10,
    idle_timeout: 1,
    max_lifetime: 15,
    prepare: false,
  });

  try {
    await sql`SELECT cron.alter_job(7, active := false)`;
    await sql`SELECT cron.alter_job(8, active := false)`;
    const terminated = await sql`
      SELECT count(*)::int AS count
      FROM (
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE pid <> pg_backend_pid()
          AND datname = current_database()
          AND backend_type = 'client backend'
          AND state <> 'idle'
          AND query_start < now() - interval '30 seconds'
      ) stopped
    `;

    return Response.json({ ok: true, terminated: terminated[0]?.count ?? 0 });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Recovery failed" },
      { status: 500 },
    );
  } finally {
    await sql.end({ timeout: 1 });
  }
});