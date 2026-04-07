export function extractBmNameFromInput(value?: string | null): string {
  const input = value?.trim() ?? "";
  if (!input) return "";

  const beforePipe = input.split("|")[0]?.trim() ?? "";
  if (beforePipe && !/^https?:\/\//i.test(beforePipe)) {
    return beforePipe.replace(/[\s:\-]+$/, "").trim();
  }

  return input.match(/^(.*?)https?:\/\//i)?.[1]?.replace(/[\s|:\-]+$/, "").trim() ?? "";
}

export function extractBmUrlFromInput(value?: string | null): string {
  const input = value?.trim() ?? "";
  if (!input) return "";

  return input.match(/https?:\/\/\S+/i)?.[0] ?? input;
}

export function resolveBmDisplayName(params: {
  name?: string | null;
  identificationLink?: string | null;
  data?: { nomeProduto?: string | null; rawBmInput?: string | null } | null;
}): string {
  const extractedName = extractBmNameFromInput(params.data?.rawBmInput || params.identificationLink);
  const productName = params.data?.nomeProduto?.trim() ?? "";
  const savedName = params.name?.trim() ?? "";

  return extractedName || productName || savedName || "BM";
}
