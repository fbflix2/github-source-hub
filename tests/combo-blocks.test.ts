import { describe, expect, it } from "bun:test";
import JSZip from "jszip";
import { formatBlocoContent, resolveComboChildren, uniqueBlockNames, createBlockZip, comboBlockFileName, blockArchiveName } from "../src/lib/combo-blocks";

describe("downloads de combos", () => {
  it("usa os dados de cada filho e preserva as informações JSON", () => {
    const fixture = [{ id: "p1", data: { nomePerfil: "Exemplo A", descricao: "A", cookies: [{ name: "fixture", value: "example" }] } },
      { id: "p2", data: { nomePerfil: "Exemplo B", descricao: "B" } }];
    const children = resolveComboChildren(fixture, []);
    const template = "{{nomePerfil}}|{{descricao}}|{{cookies}}|{{pedido}}";
    const a = formatBlocoContent(template, children[0].data, "PED-1");
    const b = formatBlocoContent(template, children[1].data, "PED-1");
    expect(a).toContain("Exemplo A|A|");
    expect(a).toContain('"name": "fixture"');
    expect(a).not.toContain("[object Object]");
    expect(b).toBe("Exemplo B|B|—|PED-1");
  });
  it("usa o snapshot somente se a consulta não devolver filhos", () => {
    const fallback = [{ stock_item_id: "p2", nomePerfil: "Snapshot", idPerfil: "profile-2" }];
    expect(resolveComboChildren([], fallback)[0].id).toBe("p2");
    expect(resolveComboChildren([{ id: "p1", identification: "profile-1", data: { nomePerfil: "Atual" } }], fallback)[0].data.idPerfil).toBe("profile-1");
    expect(resolveComboChildren([], null)).toEqual([]);
  });
  it("não substitui placeholders presentes dentro do conteúdo inserido", () => {
    expect(formatBlocoContent("{{descricao}} {{pedido}}", { descricao: "{{pedido}}" }, "P1")).toBe("{{pedido}} P1");
  });
  it("gera arquivos distintos e seguros sem sobrescrever nomes", async () => {
    const files = [{ name: "../igual.txt", content: "A" }, { name: "igual.txt", content: "B" }];
    const named = uniqueBlockNames(files);
    expect(named.map(f => f.name)).toEqual(["igual.txt", "igual_2.txt"]);
    const blob = await createBlockZip(files);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(await zip.file("igual.txt")?.async("string")).toBe("A");
    expect(await zip.file("igual_2.txt")?.async("string")).toBe("B");
  });
});


describe("nomes e dados alternativos", () => {
  it("numera os arquivos e conserva o sufixo do arquivo compactado", () => {
    expect(comboBlockFileName("perfil A", 0)).toBe("01_perfil_A.txt");
    expect(comboBlockFileName("perfil A", 1)).toBe("02_perfil_A.txt");
    expect(blockArchiveName("Combo A", "combo")).toBe("Combo_A_combo");
    expect(blockArchiveName("Combo A", "blocos")).toBe("Combo_A_blocos");
    expect(blockArchiveName("a".repeat(200), "blocos").endsWith("_blocos")).toBe(true);
  });
  it("usa a identificação atual e os campos alternativos de registros antigos", () => {
    const [child] = resolveComboChildren([{ id: "a", name: "Exemplo", identification: "atual", data: { idPerfil: "antigo", email: "example.invalid", token: "fixture" } }], []);
    expect(formatBlocoContent("{{nomePerfil}}|{{idPerfil}}|{{emailAcesso}}|{{token2fa}}", child.data)).toBe("Exemplo|atual|example.invalid|fixture");
  });
});
