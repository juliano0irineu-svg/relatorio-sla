import * as XLSX from "xlsx";
import { describe, expect, it, vi } from "vitest";
import { loadDriveSnapshot, rowsFromFolderHtml, semesterFromFile } from "./glpiDrive";

describe("glpiDrive", () => {
  it("descobre pastas e arquivos públicos a partir das linhas do Drive", () => {
    const html = `
      <table>
        <tr data-selectable data-id="folder-2027"><td aria-label="GLPI_2027 Shared folder"></td></tr>
        <tr data-selectable data-id="file-first"><td aria-label="1°Semestre.xlsx Microsoft Excel Shared"></td></tr>
        <tr data-selectable data-id="file-second"><td aria-label="2°Semestre Microsoft Excel Shared"></td></tr>
      </table>`;

    expect(rowsFromFolderHtml(html)).toEqual([
      { id: "folder-2027", name: "GLPI_2027", kind: "folder" },
      { id: "file-first", name: "1°Semestre.xlsx", kind: "file" },
      { id: "file-second", name: "2°Semestre", kind: "file" },
    ]);
  });

  it("mapeia nomes de arquivos para o semestre correto", () => {
    expect(semesterFromFile("1°Semestre.xlsx")).toBe("first");
    expect(semesterFromFile("Primeiro semestre.xlsx")).toBe("first");
    expect(semesterFromFile("2°Semestre")).toBe("second");
    expect(semesterFromFile("Segundo semestre.xlsx")).toBe("second");
    expect(semesterFromFile("arquivo temporário.xlsx")).toBeNull();
  });

  it("monta um download público direto e estável para o arquivo", async () => {
    const { publicDownloadUrl } = await import("./glpiDrive");
    expect(publicDownloadUrl("file id/1")).toBe(
      "https://drive.usercontent.google.com/download?id=file%20id%2F1&export=download&confirm=t"
    );
  });

  it("reflete uma nova linha no snapshot seguinte sem alterar a fonte", async () => {
    let version = 1;
    const rootHtml = `<tr data-selectable data-id="year-2026"><td aria-label="GLPI_2026 Shared folder"></td></tr>`;
    const filesHtml = `<tr data-selectable data-id="semester-first"><td aria-label="1°Semestre.xlsx Microsoft Excel Shared"></td></tr>`;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("drive/folders/year-2026")) return new Response(filesHtml, { status: 200 });
      if (url.includes("drive/folders/")) return new Response(rootHtml, { status: 200 });
      const workbook = XLSX.utils.book_new();
      const rows = [
        ["CHAMADO", "ABERTURA", "FECHAMENTO"],
        ["GLPI-${version}-1", "2026-01-05T09:00:00.000Z", "2026-01-05T10:00:00.000Z"],
        ...(version > 1 ? [["GLPI-${version}-2", "2026-01-06T09:00:00.000Z", "2026-01-06T10:00:00.000Z"]] : []),
      ];
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Comprador");
      return new Response(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer, { status: 200 });
    });

    const first = await loadDriveSnapshot();
    version = 2;
    const second = await loadDriveSnapshot();

    expect(first.data.indiretos[2026]?.first.totalRecords).toBe(1);
    expect(second.data.indiretos[2026]?.first.totalRecords).toBe(2);
    expect(second.diagnostics.hasIssues).toBe(true);
    expect(second.diagnostics.areas.indiretos.errors.some(error => error.year === 2027)).toBe(true);
    fetchMock.mockRestore();
  });
});
