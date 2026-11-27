import JSZip from "jszip";

type Data = Record<string, unknown>;
const record = (value: unknown): Data => value && typeof value === "object" && !Array.isArray(value) ? value as Data : {};
const text = (value: unknown): string => {
  if (value == null || value === "") return "";
  if (typeof value === "object") {
    try { return JSON.stringify(value, null, 2); } catch { return ""; }
  }
  return String(value);
};
export const serializeBlockValue = text;

export function formatBlocoContent(template: string | null, data: unknown, orderCode?: string, orderDate?: string, itemName?: string, instagram = false): string {
  const d = record(data);
  const raw = text(d.dadosAdicionais || d.idPerfil);
  const oldEmail = raw.includes("@") && raw.includes(":") ? raw.split(":") : [];
  const values: Record<string, string> = {
    nomePerfil: text(d.nomePerfil || d.name),
    emailAcesso: text(d.emailAcesso || d.email) || (oldEmail[0] || "").trim(),
    emailAlternativo: text(d.emailAlternativo || d.alternateEmail || d.alternative_email),
    senha: text(d.senha || d.senhaFB) || oldEmail.slice(1).join(":").trim(),
    senhaEmail: text(d.senhaEmail),
    token2fa: text(d.token2fa || d.token),
    dataNascimento: text(d.dataNascimento),
    genero: text(d.genero),
    tempoPlataforma: text(d.tempoPlataforma),
    statusAtual: text(d.statusAtual),
    descricao: text(d.descricao),
    cookies: text(d.cookies),
    linkDocumento: text(d.linkDocumento),
    linkPerfil: text(d.linkPerfil),
    idPerfil: text(d.idPerfil),
    pedido: orderCode || "",
    data: orderDate || "",
    nomeProduto: itemName || text(d.nomePerfil) || "Item",
  };
  if (template?.trim()) {
    return template.replace(/\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g, (match, key: string) =>
      Object.prototype.hasOwnProperty.call(values, key) ? values[key] || "—" : match
    );
  }
  const lines = [
    "=== " + values.nomeProduto + " ===", "Pedido: " + (values.pedido || "—"),
    "Data: " + (values.data || "—"), "", "--- Dados de Acesso ---",
    "Login / Email: " + (values.emailAcesso || "—"),
    "Senha: " + (values.senha || "—"),
    "Código 2FA: " + (values.token2fa || "—"),
  ];
  const fields = [
    ...(!instagram ? [["emailAlternativo", "Email Alternativo"], ["senhaEmail", "Senha Email"]] : []),
    ["nomePerfil", "Nome do Perfil"], ["dataNascimento", "Data de Nascimento"], ["genero", "Gênero"],
    ["tempoPlataforma", "Tempo de Plataforma"], ["statusAtual", "Status Atual"], ["idPerfil", "ID"],
    ["linkPerfil", "Link do Perfil"], ["linkDocumento", "Documento"],
  ];
  for (const [key, label] of fields) if (values[key]) lines.push(label + ": " + values[key]);
  if (values.descricao) lines.push("", "--- Descrição ---", values.descricao);
  if (values.cookies) lines.push("", "--- Cookies ---", values.cookies);
  return lines.join("\n");
}

export function normalizeComboChild(value: unknown, index: number) {
  const source = record(value);
  const nested = record(source.data);
  const data = { ...source, ...nested };
  const type = text(source.type || data.type) || (data.linkBM || data.rawBmInput ? "bm" : "perfil");
  const identification = text(source.identification || data.idPerfil);
  const identification_link = text(source.identification_link || (type === "bm" ? data.linkBM : data.linkPerfil));
  if (identification && type !== "bm") data.idPerfil = identification;
  if (identification_link && type !== "bm") data.linkPerfil = identification_link;
  if (!data.nomePerfil && type !== "bm" && source.name) data.nomePerfil = source.name;
  if (data.cookies != null) data.cookies = text(data.cookies);
  const actualId = text(source.stock_item_id || source.id);
  return {
    id: actualId || "combo-child-" + index,
    stockItemId: actualId || null,
    name: text(source.name || data.nomePerfil || data.nomeBM || data.emailAcesso) || "Item " + (index + 1),
    type,
    identification: identification || null,
    identification_link: identification_link || null,
    status: text(source.status || data.status),
    data,
  };
}

export function resolveComboChildren(children: unknown[], snapshot: unknown): ReturnType<typeof normalizeComboChild>[] {
  const source = children.length ? children : Array.isArray(snapshot) ? snapshot : [];
  return source.filter(item => item && typeof item === "object" && !Array.isArray(item) && !record(item).deleted_at).map(normalizeComboChild);
}

export function safeBlockName(value: unknown, fallback = "item"): string {
  return (text(value).normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 100) || fallback);
}
export type BlockFile = { name: string; content: string };

export function comboBlockFileName(value: unknown, index: number): string {
  return String(index + 1).padStart(2, "0") + "_" + safeBlockName(value, "perfil") + ".txt";
}

// Keep the archive suffix even when the item name is very long.
export function blockArchiveName(value: unknown, suffix: "combo" | "blocos"): string {
  return safeBlockName(value, "combo").slice(0, 90) + "_" + suffix;
}

export function uniqueBlockNames(files: BlockFile[]): BlockFile[] {
  const used = new Set<string>();
  return files.map(file => {
    const base = safeBlockName(file.name.replace(/\.txt$/i, ""));
    let name = base + ".txt";
    let suffix = 2;
    while (used.has(name.toLowerCase())) name = base + "_" + suffix++ + ".txt";
    used.add(name.toLowerCase());
    return { name, content: file.content };
  });
}

export function saveBlockBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  try { document.body.appendChild(a); a.click(); }
  finally { a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

export async function createBlockZip(files: BlockFile[]): Promise<Blob> {
  if (!files.length) throw new Error("Nenhum bloco disponível.");
  const zip = new JSZip();
  for (const file of uniqueBlockNames(files)) zip.file(file.name, file.content);
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export async function downloadBlockFiles(files: BlockFile[], archiveName: string, forceZip = false): Promise<void> {
  const named = uniqueBlockNames(files);
  if (!named.length) throw new Error("Nenhum bloco disponível.");
  if (named.length === 1 && !forceZip) {
    saveBlockBlob(new Blob([named[0].content], { type: "text/plain;charset=utf-8" }), named[0].name);
  } else {
    saveBlockBlob(await createBlockZip(named), safeBlockName(archiveName, "combo") + ".zip");
  }
}
