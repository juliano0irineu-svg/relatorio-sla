import * as XLSX from "xlsx";
import type { GlpiRawRecord, SemesterKey, SemesterReport } from "@shared/glpi";
import { collapseBuyerAliases, normalizeRecord, summarizeBuyer, summarizeSemester } from "@shared/glpi";

function excelValue(value: unknown): string | number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S).toISOString();
  }
  return value as string | number;
}

export async function parseGlpiWorkbook(file: File, key: SemesterKey): Promise<SemesterReport> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const buyers = workbook.SheetNames.map((sheetName) => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: null });
    const headerIndex = rows.findIndex((row) => row.some((cell) => String(cell ?? "").trim().toUpperCase() === "CHAMADO"));
    if (headerIndex < 0) return summarizeBuyer(sheetName, []);
    const headers = (rows[headerIndex] ?? []).map((cell) => String(cell ?? "").trim().toUpperCase());
    const indexOf = (name: string) => headers.indexOf(name);
    const chamadoIndex = indexOf("CHAMADO");
    const aberturaIndex = indexOf("ABERTURA");
    const fechamentoIndex = indexOf("FECHAMENTO");
    const tempoIndex = indexOf("TEMPO");
    const records = rows.slice(headerIndex + 1).flatMap((row, index) => {
      const chamado = row[chamadoIndex];
      if (chamado === null || chamado === undefined || String(chamado).trim() === "") return [];
      const raw: GlpiRawRecord = {
        chamado: String(chamado),
        abertura: excelValue(row[aberturaIndex]) as string | null,
        fechamento: excelValue(row[fechamentoIndex]) as string | null,
        tempo: tempoIndex >= 0 ? String(row[tempoIndex] ?? "") : null,
      };
      return [normalizeRecord(raw, index)];
    });
    return summarizeBuyer(sheetName, records);
  });
  return summarizeSemester(key, collapseBuyerAliases(buyers));
}
