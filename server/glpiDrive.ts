import * as XLSX from "xlsx";
import {
  collapseBuyerAliases,
  normalizeRecord,
  summarizeBuyer,
  summarizeSemester,
  type GlpiRawRecord,
  type SemesterKey,
  type SemesterReport,
} from "../shared/glpi";

const AREA_FOLDERS = {
  indiretos: process.env.DRIVE_FOLDER_INDIRETOS ?? "",
  suprimentosAdm: process.env.DRIVE_FOLDER_SUPRIMENTOS_ADM ?? "",
  transportes: process.env.DRIVE_FOLDER_TRANSPORTES ?? "",
};

export const driveSyncEnabled = process.env.ENABLE_DRIVE_SYNC === "true";

export type DriveAreaKey = keyof typeof AREA_FOLDERS;
export type DriveSnapshotData = Record<DriveAreaKey, Record<number, { first: SemesterReport; second: SemesterReport }>>;
export type DriveIssue = {
  scope: "area" | "year" | "file";
  area: DriveAreaKey;
  year?: number;
  file?: string;
  message: string;
};
export type DriveAreaDiagnostic = {
  status: "ok" | "partial" | "error";
  yearsDiscovered: number;
  filesDiscovered: number;
  filesLoaded: number;
  errors: DriveIssue[];
};
export type DriveDiagnostics = {
  checkedAt: string;
  hasIssues: boolean;
  areas: Record<DriveAreaKey, DriveAreaDiagnostic>;
};
export type DriveSnapshot = {
  data: DriveSnapshotData;
  diagnostics: DriveDiagnostics;
};

const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}?usp=sharing`;
export const publicDownloadUrl = (id: string) =>
  `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`;
const legacyDownloadUrl = (id: string) =>
  `https://drive.google.com/uc?export=download&confirm=t&id=${encodeURIComponent(id)}`;
const REQUEST_TIMEOUT_MS = 20_000;
const EXPECTED_YEARS = [2026, 2027, 2028, 2029, 2030];

const sleep = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

async function fetchWithRetry(url: string, init: RequestInit = {}, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        ...init,
        cache: "no-store",
        headers: { "User-Agent": "Relatorio-GLPI/1.0", ...(init.headers ?? {}) },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Drive respondeu ${response.status} para ${url}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await sleep(350 * (attempt + 1));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Falha ao consultar ${url}`);
}

async function fetchText(url: string) {
  const response = await fetchWithRetry(url);
  return response.text();
}

async function fetchBuffer(fileId: string) {
  let lastError: unknown;
  for (const url of [publicDownloadUrl(fileId), legacyDownloadUrl(fileId)]) {
    try {
      const response = await fetchWithRetry(url);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
        throw new Error(`Resposta não é um arquivo XLSX para ${fileId}`);
      }
      return buffer;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Não foi possível baixar ${fileId}`);
}

export function rowsFromFolderHtml(html: string) {
  const rows: Array<{ id: string; name: string; kind: "folder" | "file" }> = [];
  const rowRegex = /<tr[^>]*data-selectable[^>]*data-id="([^"]+)"[\s\S]*?<\/tr>/g;
  for (const match of Array.from(html.matchAll(rowRegex))) {
    const row = match[0];
    const labels = Array.from(row.matchAll(/aria-label="([^"]+)"/g)).map((item) => item[1] ?? "");
    const fileLabel = labels.find((label) => /Microsoft Excel|Google Sheets/i.test(label));
    const folderLabel = labels.find((label) => /Shared folder$/i.test(label));
    if (fileLabel) rows.push({ id: match[1]!, name: fileLabel.replace(/\s+(Microsoft Excel|Google Sheets)(\s+Shared)?$/i, "").trim(), kind: "file" });
    else if (folderLabel) rows.push({ id: match[1]!, name: folderLabel.replace(/\s+Shared folder$/i, "").trim(), kind: "folder" });
  }
  return rows;
}

function excelValue(value: unknown): string | number | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S)).toISOString();
  }
  return value as string | number;
}

function parseWorkbook(buffer: Buffer, semester: SemesterKey): SemesterReport {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
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
  return summarizeSemester(semester, collapseBuyerAliases(buyers));
}

function emptyYear(year: number) {
  return { year, first: summarizeSemester("first", []), second: summarizeSemester("second", []) };
}

export function semesterFromFile(name: string): SemesterKey | null {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/^(1|primeiro)/.test(normalized)) return "first";
  if (/^(2|segundo)/.test(normalized)) return "second";
  return null;
}

async function mapWithConcurrency<T>(items: T[], limit: number, mapper: (item: T) => Promise<void>) {
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item !== undefined) await mapper(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
}

function createAreaDiagnostic(): DriveAreaDiagnostic {
  return { status: "ok", yearsDiscovered: 0, filesDiscovered: 0, filesLoaded: 0, errors: [] };
}

function addIssue(diagnostic: DriveAreaDiagnostic, issue: DriveIssue) {
  diagnostic.errors.push(issue);
}

export async function loadDriveSnapshot(): Promise<DriveSnapshot> {
  const data = {} as DriveSnapshotData;
  const areas = {} as Record<DriveAreaKey, DriveAreaDiagnostic>;

  await Promise.all(Object.entries(AREA_FOLDERS).map(async ([area, rootId]) => {
    const areaKey = area as DriveAreaKey;
    const areaDiagnostic = createAreaDiagnostic();
    areas[areaKey] = areaDiagnostic;
    const years: DriveSnapshotData[DriveAreaKey] = {};
    try {
      const yearRows = rowsFromFolderHtml(await fetchText(folderUrl(rootId))).filter(
        row => row.kind === "folder" && /^GLPI_\d{4}$/i.test(row.name)
      );
      areaDiagnostic.yearsDiscovered = yearRows.length;
      const discoveredYears = new Set(yearRows.map(row => Number(row.name.match(/\d{4}/)?.[0])));
      for (const expectedYear of EXPECTED_YEARS) {
        if (!discoveredYears.has(expectedYear)) {
          addIssue(areaDiagnostic, { scope: "area", area: areaKey, year: expectedYear, message: `A pasta GLPI_${expectedYear} não foi encontrada.` });
        }
      }
      await mapWithConcurrency(yearRows, 3, async yearRow => {
        const year = Number(yearRow.name.match(/\d{4}/)?.[0]);
        const result = emptyYear(year);
        try {
          const files = rowsFromFolderHtml(await fetchText(folderUrl(yearRow.id))).filter(
            row => row.kind === "file"
          );
          areaDiagnostic.filesDiscovered += files.filter(file => semesterFromFile(file.name) !== null).length;
          const semesterFiles = files.filter(file => semesterFromFile(file.name) !== null);
          if (!semesterFiles.some(file => semesterFromFile(file.name) === "first")) {
            addIssue(areaDiagnostic, { scope: "year", area: areaKey, year, message: "Arquivo do 1º semestre não foi encontrado." });
          }
          if (!semesterFiles.some(file => semesterFromFile(file.name) === "second")) {
            addIssue(areaDiagnostic, { scope: "year", area: areaKey, year, message: "Arquivo do 2º semestre não foi encontrado." });
          }
          await mapWithConcurrency(files, 3, async file => {
            const semester = semesterFromFile(file.name);
            if (!semester) return;
            try {
              result[semester] = parseWorkbook(await fetchBuffer(file.id), semester);
              areaDiagnostic.filesLoaded += 1;
            } catch (error) {
              addIssue(areaDiagnostic, {
                scope: "file",
                area: areaKey,
                year,
                file: file.name,
                message: error instanceof Error ? error.message : "Falha desconhecida ao ler o arquivo.",
              });
              console.warn(`[Drive] Não foi possível ler ${file.name}:`, error);
            }
          });
        } catch (error) {
          addIssue(areaDiagnostic, {
            scope: "year",
            area: areaKey,
            year,
            message: error instanceof Error ? error.message : "Falha desconhecida ao consultar a pasta anual.",
          });
          console.warn(`[Drive] Não foi possível consultar ${yearRow.name}:`, error);
        }
        years[year] = { first: result.first, second: result.second };
      });
    } catch (error) {
      addIssue(areaDiagnostic, {
        scope: "area",
        area: areaKey,
        message: error instanceof Error ? error.message : "Falha desconhecida ao consultar a área.",
      });
      console.warn(`[Drive] Não foi possível consultar a área ${area}:`, error);
    }
    areaDiagnostic.status = areaDiagnostic.errors.length === 0
      ? "ok"
      : areaDiagnostic.filesLoaded > 0 || areaDiagnostic.yearsDiscovered > 0
        ? "partial"
        : "error";
    data[areaKey] = years;
  }));

  const diagnostics: DriveDiagnostics = {
    checkedAt: new Date().toISOString(),
    hasIssues: Object.values(areas).some(area => area.errors.length > 0),
    areas,
  };
  return { data, diagnostics };
}
