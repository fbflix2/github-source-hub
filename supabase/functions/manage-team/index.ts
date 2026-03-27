import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller } } = await supabaseUser.auth.getUser();
    if (!caller) throw new Error("Não autorizado");

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Sem permissão de administrador");

    // Route by method
    if (req.method === "GET") {
      return await handleList(supabaseAdmin);
    }

    const body = await req.json();

    if (req.method === "POST" && body.action === "add") {
      return await handleAdd(supabaseAdmin, body);
    }

    if (req.method === "POST" && body.action === "update_role") {
      return await handleUpdateRole(supabaseAdmin, body);
    }

    if (req.method === "POST" && body.action === "remove") {
      return await handleRemove(supabaseAdmin, body);
    }

    if (req.method === "POST" && body.action === "toggle_status") {
      return await handleToggleStatus(supabaseAdmin, body);
    }

    if (req.method === "POST" && body.action === "get_permissions") {
      return await handleGetPermissions(supabaseAdmin, body);
    }

    if (req.method === "POST" && body.action === "set_permissions") {
      return await handleSetPermissions(supabaseAdmin, body);
    }

    if (req.method === "POST" && body.action === "update_department") {
      return await handleUpdateDepartment(supabaseAdmin, body);
    }

    throw new Error("Ação não reconhecida");
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleList(sb: any) {
  // Get all users with admin or moderator roles
  const { data: roles, error } = await sb
    .from("user_roles")
    .select("user_id, role, created_at")
    .in("role", ["admin", "moderator"]);

  if (error) throw new Error(error.message);
  if (!roles || roles.length === 0) {
    return jsonResponse({ members: [] });
  }

  const userIds = [...new Set(roles.map((r: any) => r.user_id))];

  // Get profiles
  const { data: profiles } = await sb
    .from("profiles")
    .select("user_id, full_name, phone, status, avatar_url, created_at, department")
    .in("user_id", userIds);

  const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

  // Get emails from auth
  const emailMap = new Map<string, string>();
  for (const uid of userIds) {
    const { data: { user } } = await sb.auth.admin.getUserById(uid);
    if (user?.email) emailMap.set(uid, user.email);
  }

  const members = roles.map((r: any) => {
    const profile = profileMap.get(r.user_id) || {};
    const email = emailMap.get(r.user_id) || "";
    const name = profile.full_name || email.split("@")[0] || "Sem nome";
    const initials = name
      .split(" ")
      .slice(0, 2)
      .map((w: string) => w[0]?.toUpperCase())
      .join("");

    return {
      user_id: r.user_id,
      name,
      initials,
      email,
      role: r.role,
      status: profile.status || "active",
      avatar_url: profile.avatar_url || null,
      created_at: r.created_at,
      department: profile.department || null,
    };
  });

  return jsonResponse({ members });
}

async function handleAdd(sb: any, body: any) {
  const { email, role } = body;
  if (!email || !role) throw new Error("Email e role são obrigatórios");
  if (!["admin", "moderator"].includes(role)) throw new Error("Role inválida");

  const targetEmail = email.trim().toLowerCase();
  console.log("Looking for email:", targetEmail);

  let foundUser: any = null;

  // Paginated search through all auth users
  let page = 1;
  let totalChecked = 0;
  while (!foundUser) {
    const { data, error: listError } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (listError) {
      console.error("listUsers error on page", page, ":", listError.message);
      throw new Error(listError.message);
    }
    const users = data?.users || [];
    console.log(`Page ${page}: got ${users.length} users`);
    if (users.length === 0) break;
    
    for (const u of users) {
      if (u.email?.toLowerCase() === targetEmail) {
        foundUser = u;
        break;
      }
    }
    totalChecked += users.length;
    
    if (users.length < 1000) break;
    page++;
  }

  console.log(`Checked ${totalChecked} users across ${page} pages. Found:`, !!foundUser);

  if (!foundUser) throw new Error(`Usuário não encontrado com esse email (verificados: ${totalChecked})`);
  // Check if already has role
  const { data: existing } = await sb
    .from("user_roles")
    .select("id")
    .eq("user_id", foundUser.id)
    .eq("role", role)
    .maybeSingle();

  if (existing) throw new Error("Usuário já possui essa função");

  // Insert role
  const { error: insertError } = await sb
    .from("user_roles")
    .insert({ user_id: foundUser.id, role });

  if (insertError) throw new Error(insertError.message);

  return jsonResponse({ success: true, message: "Membro adicionado com sucesso" });
}

async function handleUpdateRole(sb: any, body: any) {
  const { user_id, old_role, new_role } = body;
  if (!user_id || !old_role || !new_role) throw new Error("Dados incompletos");
  if (!["admin", "moderator"].includes(new_role)) throw new Error("Role inválida");

  // Delete old role
  await sb.from("user_roles").delete().eq("user_id", user_id).eq("role", old_role);

  // Insert new role (if not already exists)
  const { data: existing } = await sb
    .from("user_roles")
    .select("id")
    .eq("user_id", user_id)
    .eq("role", new_role)
    .maybeSingle();

  if (!existing) {
    const { error } = await sb.from("user_roles").insert({ user_id, role: new_role });
    if (error) throw new Error(error.message);
  }

  return jsonResponse({ success: true });
}

async function handleRemove(sb: any, body: any) {
  const { user_id, role } = body;
  if (!user_id || !role) throw new Error("Dados incompletos");

  const { error } = await sb
    .from("user_roles")
    .delete()
    .eq("user_id", user_id)
    .eq("role", role);

  if (error) throw new Error(error.message);

  return jsonResponse({ success: true, message: "Membro removido com sucesso" });
}

async function handleToggleStatus(sb: any, body: any) {
  const { user_id, new_status } = body;
  if (!user_id || !new_status) throw new Error("Dados incompletos");

  const { error } = await sb
    .from("profiles")
    .update({ status: new_status })
    .eq("user_id", user_id);

  if (error) throw new Error(error.message);

  return jsonResponse({ success: true });
}

async function handleGetPermissions(sb: any, body: any) {
  const { user_id } = body;
  if (!user_id) throw new Error("user_id é obrigatório");

  const { data, error } = await sb
    .from("moderator_permissions")
    .select("allowed_paths")
    .eq("user_id", user_id)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return jsonResponse({ allowed_paths: data?.allowed_paths || [] });
}

async function handleSetPermissions(sb: any, body: any) {
  const { user_id, allowed_paths } = body;
  if (!user_id || !Array.isArray(allowed_paths)) throw new Error("Dados incompletos");

  const { error } = await sb
    .from("moderator_permissions")
    .upsert(
      { user_id, allowed_paths, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  if (error) throw new Error(error.message);

  return jsonResponse({ success: true });
}

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
