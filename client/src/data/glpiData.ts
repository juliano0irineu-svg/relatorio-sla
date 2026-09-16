import type { SemesterKey, SemesterReport } from "@shared/glpi";
import { normalizeRecord, summarizeBuyer, summarizeSemester } from "@shared/glpi";

export type AreaKey = "indiretos" | "suprimentosAdm" | "transportes";
export type ReportScope = AreaKey | "geral";

export const areaLabels: Record<AreaKey, string> = {
  indiretos: "Indiretos",
  suprimentosAdm: "Suprimentos Adm",
  transportes: "Transportes",
};

const firstSemesterRecords: Record<string, ReturnType<typeof normalizeRecord>[]> = {
  "Alexandre Magno Brandao": [
    ["2026 098 080", "2026-07-28T16:55:00", "2026-07-29T14:27:00", "0d 21h32"],
    ["2026 096 237", "2026-07-24T10:44:00", "2026-07-27T09:01:00", "2d 22h17"],
    ["2026 093 908", "2026-07-20T17:11:00", "2026-07-21T08:35:00", "0d 15h24"],
    ["2026 092 558", "2026-07-16T17:34:00", "2026-07-17T14:19:00", "0d 20h45"],
    ["2026 090 906", "2026-07-14T13:39:00", "2026-07-15T08:42:00", "0d 19h03"],
    ["2026 090 905", "2026-07-14T13:36:00", "2026-07-14T16:56:00", "0d 03h20"],
    ["2026 090 428", "2026-07-13T16:56:00", "2026-07-14T16:43:00", "0d 23h47"],
  ].map(([chamado, abertura, fechamento, tempo], index) => normalizeRecord({ chamado, abertura, fechamento, tempo }, index)),
  Gabrielly: [],
  Mariana: [],
  Luiz: [],
  Silvia: [],
};

function buildSemester(key: "first" | "second", source: Record<string, ReturnType<typeof normalizeRecord>[]>) {
  return summarizeSemester(key, Object.entries(source).map(([buyer, records]) => summarizeBuyer(buyer, records)));
}

const emptySemester = (key: "first" | "second") => summarizeSemester(key, []);

export const areaReports: Record<AreaKey, Record<"first" | "second", SemesterReport>> = {
  indiretos: {
    first: buildSemester("first", firstSemesterRecords),
    second: emptySemester("second"),
  },
  suprimentosAdm: { first: emptySemester("first"), second: emptySemester("second") },
  transportes: { first: emptySemester("first"), second: emptySemester("second") },
};

export type YearlyAreaReports = Record<AreaKey, Record<number, Record<"first" | "second", SemesterReport>>>;

const emptyYearReports = (): Record<"first" | "second", SemesterReport> => ({ first: emptySemester("first"), second: emptySemester("second") });
const years = [2026, 2027, 2028, 2029, 2030];

export const yearlyAreaReports: YearlyAreaReports = Object.fromEntries(
  (Object.keys(areaReports) as AreaKey[]).map((area) => [
    area,
    Object.fromEntries(years.map((year) => [year, year === 2026 ? areaReports[area] : emptyYearReports()])),
  ]),
) as YearlyAreaReports;

export const glpiSemesters = areaReports.indiretos;

export function buildGeneralReport(reports: typeof areaReports, semester: SemesterKey, selection: AreaKey | "all"): SemesterReport {
  const entries = selection === "all" ? Object.entries(reports) : [[selection, reports[selection]] as [AreaKey, typeof reports[AreaKey]]];
  const buyers = entries.flatMap(([area, areaReport]) => areaReport[semester].buyers.map((buyer) => ({ ...buyer, buyer: `${areaLabels[area as AreaKey]} · ${buyer.buyer}` })));
  return summarizeSemester(semester, buyers);
}

export const dataSourceNote = "Dados dos chamados são extraídos do GLPI, tratados nas planilhas do Google Drive e sincronizados automaticamente pelo relatório.";
