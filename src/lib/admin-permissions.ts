const permissionAliases: Record<string, string[]> = {
  "/admin/ferramentas": ["/admin/ferramentas-2fa"],
  "/admin/ferramentas/2fa": ["/admin/ferramentas-2fa"],
  "/admin/ferramentas/imagens": ["/admin/imagens"],
};

export function normalizeAdminAllowedPaths(paths: string[] | null | undefined): Set<string> {
  const normalized = new Set<string>();

  for (const rawPath of paths ?? []) {
    if (!rawPath) continue;

    normalized.add(rawPath);

    const aliases = permissionAliases[rawPath] ?? [];
    aliases.forEach((alias) => normalized.add(alias));
  }

  if (normalized.has("/admin/estoque")) {
    normalized.add("/admin/blocagem");
    normalized.add("/admin/reciclagem");
  }

  normalized.add("/admin/chat");
  normalized.add("/admin/aquecimento-guia");
  normalized.add("/admin/operador-financeiro");

  for (const path of [...normalized]) {
    const parts = path.split("/").filter(Boolean);

    for (let i = 2; i < parts.length; i++) {
      normalized.add(`/${parts.slice(0, i).join("/")}`);
    }
  }

  return normalized;
}