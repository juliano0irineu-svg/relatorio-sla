import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  Menu,
  X,
  CircleHelp,
  Clock3,
  Download,
  FileSpreadsheet,
  LayoutDashboard,
  RefreshCw,
  Search,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  collapseBuyerAliases,
  formatDate,
  formatDuration,
  summarizeBuyer,
  summarizeSemester,
  type GlpiRecord,
  type SemesterKey,
  type SemesterReport,
} from "@shared/glpi";
import {
  areaLabels,
  areaReports,
  type AreaKey,
  type ReportScope,
  type YearlyAreaReports,
  yearlyAreaReports,
} from "@/data/glpiData";
import { trpc } from "@/lib/trpc";
import * as XLSX from "xlsx";

type DriveDiagnosticsView = {
  hasIssues: boolean;
  areas: Record<string, {
    errors: Array<{
      scope: "area" | "year" | "file";
      year?: number;
      file?: string;
      message: string;
    }>;
  }>;
};

const LAST_DRIVE_SNAPSHOT_KEY = "relatorio-glpi:last-drive-snapshot:v1";

function reviveReports(input: unknown): YearlyAreaReports | null {
  if (!input || typeof input !== "object") return null;
  try {
    const parsed = input as Record<string, Record<string, { first: SemesterReport; second: SemesterReport }>>;
    const reviveDate = (value: unknown) => {
      if (!value) return null;
      if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
      const date = new Date(String(value));
      return Number.isNaN(date.getTime()) ? null : date;
    };
    const result = {} as YearlyAreaReports;
    for (const area of Object.keys(areaLabels) as AreaKey[]) {
      if (!parsed[area]) return null;
      result[area] = {};
      for (const [year, reports] of Object.entries(parsed[area]!)) {
        const reviveReport = (report: SemesterReport): SemesterReport => ({
          ...report,
          buyers: report.buyers.map(buyer => ({
            ...buyer,
            records: buyer.records.map(record => ({
              ...record,
              abertura: reviveDate(record.abertura),
              fechamento: reviveDate(record.fechamento),
            })),
          })),
        });
        result[area][Number(year)] = {
          first: reviveReport(reports.first),
          second: reviveReport(reports.second),
        };
      }
    }
    return result;
  } catch {
    return null;
  }
}

function reviveCachedReports(): YearlyAreaReports | null {
  if (typeof window === "undefined") return null;
  try {
    return reviveReports(JSON.parse(localStorage.getItem(LAST_DRIVE_SNAPSHOT_KEY) ?? "null"));
  } catch {
    return null;
  }
}

const areas: Array<{
  key: ReportScope;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { key: "geral", label: "Resumo geral", icon: LayoutDashboard },
  { key: "indiretos", label: "Indiretos", icon: FileSpreadsheet },
  { key: "suprimentosAdm", label: "Suprimentos Adm", icon: UsersRound },
  { key: "transportes", label: "Transportes", icon: BarChart3 },
];

type SemesterChoice = SemesterKey | "all";

const GROUP_LOGO_URL = "/manus-storage/grupo-barigui-logo-branca-final_600da188.png";
const SITE_VERSION = "1.0.0";

type BuyerDetailProps = {
  buyer: string;
  records: GlpiRecord[];
  selectedRecordId: string | null;
  onSelectRecord: (id: string | null) => void;
  sortOrder?: SortOrder;
  onSortOrderChange?: (value: SortOrder) => void;
  embedded?: boolean;
};

function readScopeFromUrl(): ReportScope {
  const value = new URLSearchParams(window.location.search).get("scope");
  return value === "indiretos" ||
    value === "suprimentosAdm" ||
    value === "transportes" ||
    value === "geral"
    ? value
    : "geral";
}

function readGeneralAreaFromUrl(): AreaKey | "all" {
  const value = new URLSearchParams(window.location.search).get("area");
  return value === "indiretos" ||
    value === "suprimentosAdm" ||
    value === "transportes"
    ? value
    : "all";
}

function combineReports(
  parts: SemesterReport[],
  label: string
): SemesterReport {
  const buyers = new Map<string, ReturnType<typeof summarizeBuyer>>();
  parts.forEach(part =>
    part.buyers.forEach(buyer => {
      const current = buyers.get(buyer.buyer);
      buyers.set(
        buyer.buyer,
        summarizeBuyer(
          buyer.buyer,
          current ? [...current.records, ...buyer.records] : buyer.records
        )
      );
    })
  );
  return {
    ...summarizeSemester(
      "first",
      collapseBuyerAliases(Array.from(buyers.values()))
    ),
    label,
  };
}

function reportForArea(
  reports: typeof areaReports,
  area: AreaKey,
  semester: SemesterChoice
): SemesterReport {
  return combineReports(
    semester === "all"
      ? [reports[area].first, reports[area].second]
      : [reports[area][semester]],
    semester === "all" ? "Todos os semestres" : reports[area][semester].label
  );
}

function filterByDateRange(
  report: SemesterReport,
  from: string,
  to: string
): SemesterReport {
  if (!from && !to) return report;
  const start = from ? new Date(`${from}T00:00:00`) : null;
  const end = to ? new Date(`${to}T23:59:59.999`) : null;
  const buyers = report.buyers.map(buyer =>
    summarizeBuyer(
      buyer.buyer,
      buyer.records.filter(record => {
        const time = record.abertura?.getTime();
        return (
          time !== undefined &&
          (!start || time >= start.getTime()) &&
          (!end || time <= end.getTime())
        );
      })
    )
  );
  return combineReports([summarizeSemester("first", buyers)], report.label);
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

type SortOrder = "default" | "desc" | "asc";

function sortReportRecords(
  report: SemesterReport,
  order: SortOrder
): SemesterReport {
  if (order === "default") return report;
  const buyers = report.buyers.map(buyer =>
    summarizeBuyer(
      buyer.buyer,
      [...buyer.records].sort((a, b) => {
        const aMinutes =
          a.usefulMinutes ?? (order === "desc" ? -1 : Number.MAX_SAFE_INTEGER);
        const bMinutes =
          b.usefulMinutes ?? (order === "desc" ? -1 : Number.MAX_SAFE_INTEGER);
        return order === "desc" ? bMinutes - aMinutes : aMinutes - bMinutes;
      })
    )
  );
  return { ...report, buyers };
}

function filterBySearch(
  report: SemesterReport,
  query: string,
  scopeLabel: string
): SemesterReport {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return report;
  const buyers = report.buyers
    .map(buyer => {
      const buyerText = normalizeSearchText(buyer.buyer);
      const areaText = normalizeSearchText(scopeLabel);
      const buyerMatches =
        buyerText.includes(normalizedQuery) ||
        areaText.includes(normalizedQuery);
      const records = buyerMatches
        ? buyer.records
        : buyer.records.filter(record =>
            normalizeSearchText(record.chamado).includes(normalizedQuery)
          );
      return summarizeBuyer(buyer.buyer, records);
    })
    .filter(buyer => buyer.records.length > 0);
  return combineReports([summarizeSemester("first", buyers)], report.label);
}

function splitBuyerArea(
  buyer: string,
  fallbackArea: string
): { area: string; buyer: string } {
  const separatorIndex = buyer.indexOf(" · ");
  return separatorIndex >= 0
    ? {
        area: buyer.slice(0, separatorIndex),
        buyer: buyer.slice(separatorIndex + 3),
      }
    : { area: fallbackArea, buyer };
}

export function buildExportRows(report: SemesterReport, fallbackArea: string) {
  return report.buyers.flatMap(buyer => {
    const identity = splitBuyerArea(buyer.buyer, fallbackArea);
    return buyer.records.map(record => ({
      Área: identity.area,
      Comprador: identity.buyer,
      Chamado: record.chamado || "Sem número",
      Abertura: formatDate(record.abertura),
      Fechamento: formatDate(record.fechamento),
      "Tempo útil":
        record.status === "valid"
          ? formatDuration(record.usefulMinutes)
          : "Data inválida",
      Status: record.status === "valid" ? "Válido" : "Data inválida",
    }));
  });
}

export default function Home() {
  const [scope, setScope] = useState<ReportScope>(readScopeFromUrl);
  const [semester, setSemester] = useState<SemesterChoice>(() => {
    const value = new URLSearchParams(window.location.search).get("semester");
    return value === "second" || value === "first" ? value : "all";
  });
  const [year, setYear] = useState<number>(
    () =>
      Number(new URLSearchParams(window.location.search).get("year")) || 2026
  );
  const [dateFrom, setDateFrom] = useState(
    () => new URLSearchParams(window.location.search).get("from") || ""
  );
  const [dateTo, setDateTo] = useState(
    () => new URLSearchParams(window.location.search).get("to") || ""
  );
  const [selectedBuyer, setSelectedBuyer] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("default");
  const [generalArea, setGeneralArea] = useState<AreaKey | "all">(
    readGeneralAreaFromUrl
  );
  const [reportsByYear, setReportsByYear] = useState<YearlyAreaReports>(
    () => reviveCachedReports() ?? yearlyAreaReports
  );
  const [reportsSource, setReportsSource] = useState<"drive" | "cache" | "initial">(
    () => (reviveCachedReports() ? "cache" : "initial")
  );
  const {
    data: driveSnapshot,
    isFetching: isSyncing,
    error: driveError,
    refetch: refetchDrive,
  } = trpc.glpi.driveSnapshot.useQuery(undefined, {
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 0,
  });

  useEffect(() => {
    if (!driveSnapshot?.data) return;
    const nextReports = reviveReports(driveSnapshot.data);
    if (!nextReports) return;
    if (driveSnapshot.diagnostics?.hasIssues) return;
    setReportsByYear(nextReports);
    setReportsSource("drive");
    try {
      localStorage.setItem(LAST_DRIVE_SNAPSHOT_KEY, JSON.stringify(nextReports));
    } catch {
      // O dashboard continua funcional mesmo se o navegador bloquear o armazenamento local.
    }
  }, [driveSnapshot]);

  const driveDiagnostics = driveSnapshot?.diagnostics as DriveDiagnosticsView | undefined;

  const availableYears = useMemo(
    () =>
      Object.keys(reportsByYear.indiretos)
        .map(Number)
        .sort((a, b) => a - b),
    [reportsByYear]
  );
  const reports = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(reportsByYear).map(([area, years]) => [
          area,
          years[year] ?? areaReports[area as AreaKey],
        ])
      ) as typeof areaReports,
    [reportsByYear, year]
  );
  const baseReport =
    scope === "geral"
      ? combineReports(
          (generalArea === "all"
            ? (Object.keys(areaLabels) as AreaKey[])
            : [generalArea]
          ).flatMap(area => {
            const parts =
              semester === "all"
                ? [reports[area].first, reports[area].second]
                : [reports[area][semester]];
            return parts.map(part => ({
              ...part,
              buyers: part.buyers.map(buyer => ({
                ...buyer,
                buyer: `${areaLabels[area]} · ${buyer.buyer}`,
              })),
            }));
          }),
          "Resumo consolidado"
        )
      : reportForArea(reports, scope, semester);
  const scopeLabel =
    scope === "geral"
      ? generalArea === "all"
        ? "Resumo geral"
        : `Resumo geral · ${areaLabels[generalArea]}`
      : areaLabels[scope];
  const report = sortReportRecords(
    filterBySearch(
      filterByDateRange(baseReport, dateFrom, dateTo),
      searchQuery,
      scopeLabel
    ),
    sortOrder
  );
  const filteredReportsByArea = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(areaLabels) as AreaKey[]).map(area => [
          area,
          filterBySearch(
            filterByDateRange(
              reportForArea(reports, area, semester),
              dateFrom,
              dateTo
            ),
            searchQuery,
            areaLabels[area]
          ),
        ])
      ) as Record<AreaKey, SemesterReport>,
    [reports, semester, dateFrom, dateTo, searchQuery]
  );
  const selected = useMemo(
    () => report.buyers.find(buyer => buyer.buyer === selectedBuyer) ?? null,
    [report, selectedBuyer]
  );
  const displayedReport = useMemo(
    () =>
      selected
        ? {
            ...report,
            buyers: [selected],
            totalRecords: selected.count,
            totalUsefulMinutes: selected.totalUsefulMinutes,
            averageUsefulMinutes: selected.averageUsefulMinutes,
          }
        : report,
    [report, selected]
  );
  const exportRows = useMemo(
    () =>
      buildExportRows(
        displayedReport,
        scope === "geral" && generalArea !== "all"
          ? areaLabels[generalArea]
          : scope === "geral"
            ? "Todas as áreas"
            : areaLabels[scope]
      ),
    [displayedReport, scope, generalArea]
  );

  useEffect(() => {
    setSelectedRecordId(null);
  }, [selectedBuyer]);

  const summaryRecords = selected ? selected.count : report.totalRecords;
  const summaryTotalMinutes = selected
    ? selected.totalUsefulMinutes
    : report.totalUsefulMinutes;
  const summaryAverageMinutes = selected
    ? selected.averageUsefulMinutes
    : report.averageUsefulMinutes;
  const summaryTitle = selected
    ? selected.buyer
    : scope === "geral"
      ? generalArea === "all"
        ? "Todos os compradores"
        : `Todos os compradores · ${areaLabels[generalArea]}`
      : `Todos os compradores · ${areaLabels[scope]}`;
  const summaryAreaKeys =
    scope === "geral" && generalArea !== "all"
      ? [generalArea]
      : (Object.keys(areaLabels) as AreaKey[]);
  const summaryAreaMetrics = summaryAreaKeys
    .map(area => ({
      area,
      label: areaLabels[area],
      report: filteredReportsByArea[area],
    }))
    .filter(item => item.report.totalRecords > 0);
  const summaryActiveBuyers = selected
    ? 1
    : new Set(
        report.buyers
          .filter(buyer => buyer.count > 0)
          .map(buyer => splitBuyerArea(buyer.buyer, "").buyer.toLocaleLowerCase())
      ).size;
  const summaryActiveAreas = selected
    ? 1
    : scope === "geral"
      ? summaryAreaMetrics.length
      : report.totalRecords > 0
        ? 1
        : 0;
  const summaryUsefulDurations = displayedReport.buyers
    .flatMap(buyer => buyer.records)
    .flatMap(record =>
      typeof record.usefulMinutes === "number" && record.usefulMinutes >= 0
        ? [record.usefulMinutes]
        : []
    );
  const summaryLongestMinutes = summaryUsefulDurations.length
    ? Math.max(...summaryUsefulDurations)
    : 0;
  const summaryShortestMinutes = summaryUsefulDurations.length
    ? Math.min(...summaryUsefulDurations)
    : 0;
  const summaryAreaDescription = selected
    ? splitBuyerArea(
        selected.buyer,
        scope === "geral" ? "Todas as áreas" : areaLabels[scope]
      ).area
    : scope === "geral"
      ? summaryAreaMetrics.length
        ? summaryAreaMetrics
            .map(item => `${item.label}: ${item.report.totalRecords}`)
            .join(" · ")
        : "Sem chamados no período"
      : areaLabels[scope];
  const diagnosticIssueCount = driveDiagnostics
    ? Object.values(driveDiagnostics.areas).reduce((total, area) => total + area.errors.length, 0)
    : 0;
  const sourceStatus = driveError
    ? reportsSource === "initial"
      ? "Drive indisponível · base inicial"
      : "Drive indisponível · última base válida"
    : driveDiagnostics?.hasIssues
      ? `Drive parcial · ${diagnosticIssueCount} alerta${diagnosticIssueCount === 1 ? "" : "s"}`
      : isSyncing
        ? "Sincronizando Drive…"
        : reportsSource === "cache"
          ? "Última base válida em cache local"
          : reportsSource === "initial"
            ? "Base inicial local"
            : "Drive sincronizado automaticamente";

  const changeScope = (next: ReportScope) => {
    setScope(next);
    setSelectedBuyer(null);
    setSelectedRecordId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const changeSemester = (next: SemesterChoice) => {
    setSemester(next);
    setSelectedBuyer(null);
  };
  const changeYear = (next: number) => {
    setYear(next);
    setSelectedBuyer(null);
  };
  const refreshPage = () => {
    void refetchDrive();
  };

  const changeSearch = (value: string) => {
    setSearchQuery(value);
    setSelectedBuyer(null);
  };

  const exportFiltered = () => {
    if (!exportRows.length) return;
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Chamados");
    const workbookData = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const blob = new Blob([workbookData], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const link = document.createElement("a");
    const fileScope = scope === "geral" ? "resumo-geral" : scope;
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-glpi-${year}-${fileScope}.xlsx`;
    link.click();
    if (typeof URL.revokeObjectURL === "function")
      window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
  };

  return (
    <div className="min-h-screen bg-[#f4f6fc] text-[#202650]">
      <aside className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-[#4540a2] bg-[#302b86] py-6 text-white transition-[width,padding] duration-300 ease-out lg:flex ${sidebarCollapsed ? "w-[78px] px-3" : "w-[248px] px-5"}`}>
        <div className={`flex items-center gap-3 ${sidebarCollapsed ? "justify-center" : "justify-between px-2"}`}>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className={`grid shrink-0 place-items-center ${sidebarCollapsed ? "h-8 w-8" : "h-12 w-16"}`}>
              <img
                src={GROUP_LOGO_URL}
                alt="Grupo Barigüi"
                className="block h-full w-full object-contain"
              />
            </div>
            {!sidebarCollapsed && (
              <h1 className="min-w-0 flex-1 whitespace-nowrap text-[13px] font-bold tracking-[-.02em] text-white transition-opacity duration-200">
                Relatório GLPI
              </h1>
            )}
          </div>
          <button
            type="button"
            aria-label={sidebarCollapsed ? "Expandir menu" : "Minimizar menu"}
            title={sidebarCollapsed ? "Expandir menu" : "Minimizar menu"}
            onClick={() => setSidebarCollapsed(collapsed => !collapsed)}
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#d7ee58] transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#d7ee58]/40 ${sidebarCollapsed ? "absolute right-[-14px] top-6 bg-[#302b86] shadow-md" : ""}`}
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
        <Separator className="my-7" />
        <nav className="space-y-1">
          {areas.map(item => (
            <button
              key={item.key}
              type="button"
              aria-label={item.label}
              title={sidebarCollapsed ? item.label : undefined}
              onClick={() => changeScope(item.key)}
              className={`flex w-full items-center rounded-xl py-3 text-sm font-medium transition-[background-color,color,transform] duration-200 ${sidebarCollapsed ? "justify-center px-2 hover:bg-[#d7ee58] hover:text-[#302b86] hover:shadow-[0_4px_14px_rgba(215,238,88,.22)]" : "gap-3 px-3 text-left hover:bg-white/10"} ${scope === item.key ? "bg-white text-[#312b88]" : "text-[#d1d5f3]"}`}
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {!sidebarCollapsed && item.label}
            </button>
          ))}
        </nav>
        <div className={`mt-auto text-[#d1d5f3] ${sidebarCollapsed ? "text-center" : "px-2"}`}>
          {sidebarCollapsed ? (
            <span title="Juliano Bueno Polidoro · v1.0.0" className="text-[10px] font-semibold tracking-[.08em]">JB</span>
          ) : (
            <p data-testid="creator-signature" className="text-[10px] font-medium tracking-[.06em]">
              Juliano Bueno Polidoro · v1.0.0
            </p>
          )}
        </div>
      </aside>
      <main className={`min-w-0 transition-[padding] duration-200 ${sidebarCollapsed ? "lg:pl-[78px]" : "lg:pl-[248px]"}`}>
        <header className="border-b border-[#dce1f0] bg-white/85 px-5 py-5 backdrop-blur md:px-10 md:py-7">
          <div className="mx-auto flex w-full max-w-[1320px] min-w-0 flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-[#7781a5]">
                <span className="h-2 w-2 rounded-full bg-[#d7ee58]" />{" "}
                {scopeLabel}
              </div>
              <h2 className="text-3xl font-semibold tracking-[-.04em] text-[#26286e] md:text-[38px]">
                Ritmo dos chamados
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#69739a]">
                Análise por área, comprador, ano, semestre e mês, com tempo útil
                calculado de segunda a sexta-feira.
              </p>
            </div>
            <div className="relative flex min-w-0 flex-wrap items-center justify-end gap-3 text-xs font-medium text-[#6f789a]">
              <button
                type="button"
                aria-label="Ajuda e suporte"
                title="Ajuda e suporte"
                onClick={() => setSupportOpen(open => !open)}
                className="grid h-9 w-9 place-items-center rounded-full border border-[#d8ddef] bg-white text-[#312b88] shadow-sm transition-colors hover:border-[#312b88] hover:bg-[#f3f3ff] focus:outline-none focus:ring-2 focus:ring-[#312b88]/20"
              >
                <CircleHelp className="h-4 w-4" />
              </button>
              {supportOpen && (
                <div
                  role="dialog"
                  aria-label="Ajuda e suporte"
                  className="absolute right-0 top-11 z-30 w-[min(300px,calc(100vw-2rem))] rounded-2xl border border-[#d8ddef] bg-white p-4 text-left text-xs leading-5 text-[#636d91] shadow-[0_18px_45px_rgba(24,43,58,.16)]"
                >
                  <p className="font-semibold text-[#312b88]">
                    Como usar o painel
                  </p>
                  <p className="mt-1">
                    Use os filtros, a busca e o seletor de comprador para
                    consultar uma visão específica. Os indicadores são
                    recalculados pelas datas de abertura e fechamento.
                  </p>
                  <div className="mt-4 border-t border-[#eef0f3] pt-3">
                    <div className="flex items-center gap-2 font-semibold text-[#737f20]">
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>Fonte dos dados</span>
                    </div>
                    <p data-testid="data-origin-note" className="mt-1 text-xs leading-5 text-[#636d91]">
                      Os dados têm origem no sistema GLPI, são tratados nas planilhas públicas do Drive e lidos pelo painel sem alterar as fontes.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSupportOpen(false)}
                    className="mt-3 font-semibold text-[#312b88] underline underline-offset-4"
                  >
                    Fechar
                  </button>
                </div>
              )}
              <span className="flex items-center gap-2">
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin text-[#d7ee58]" : "text-[#91ad2e]"}`}
                />
                {sourceStatus}
              </span>
              <button
                type="button"
                onClick={refreshPage}
                className="flex items-center gap-2 rounded-full border border-[#d8ddef] bg-white px-4 py-2 font-semibold text-[#312b88] shadow-sm transition-colors hover:border-[#312b88] hover:bg-[#f3f3ff] focus:outline-none focus:ring-2 focus:ring-[#312b88]/20"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Atualizar página
              </button>
            </div>
          </div>
        </header>
        <nav
          aria-label="Áreas do relatório"
          className="border-b border-[#dce1f0] bg-white px-5 py-3 lg:hidden"
        >
          <div className="mx-auto flex w-full max-w-[1320px] gap-2 overflow-x-auto pb-0.5">
            {areas.map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => changeScope(item.key)}
                className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${scope === item.key ? "bg-[#312b88] text-white" : "bg-[#eff0fb] text-[#636d91]"}`}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            ))}
          </div>
        </nav>
        <div className="mx-auto w-full max-w-[1320px] min-w-0 space-y-7 px-5 py-7 md:px-10 md:py-9">
          <UnifiedFilters
            year={year}
            years={availableYears}
            semester={semester}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onYear={changeYear}
            onSemester={changeSemester}
            onDateFrom={value => {
              setDateFrom(value);
              setSelectedBuyer(null);
            }}
            onDateTo={value => {
              setDateTo(value);
              setSelectedBuyer(null);
            }}
            showArea={scope === "geral"}
            activeArea={generalArea}
            onArea={area => {
              setGeneralArea(area);
              setSelectedBuyer(null);
              setSelectedRecordId(null);
            }}
            buyers={report.buyers}
            selectedBuyer={selectedBuyer}
            onBuyer={buyer => {
              setSelectedBuyer(buyer);
              setSelectedRecordId(null);
            }}
            query={searchQuery}
            onQueryChange={changeSearch}
            onExport={exportFiltered}
            exportDisabled={!exportRows.length}
            resultCount={exportRows.length}
            driveError={Boolean(driveError)}
            driveDiagnostics={driveDiagnostics}
            reportsSource={reportsSource}
          />
          <Card
            data-testid="buyer-summary-blue"
            className="min-w-0 w-full border-[#312b88] bg-[#312b88] text-white shadow-[0_12px_35px_rgba(24,59,86,.14)]"
          >
            <CardContent className="flex h-full min-h-[300px] flex-col p-7">
              <div className="flex-1">
                <div className="mb-5 flex items-center justify-between">
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-[#c9cff2]">
                    {selected
                      ? "Resumo do comprador"
                      : scope === "geral"
                        ? generalArea === "all"
                          ? "Resumo consolidado"
                          : `Resumo ${areaLabels[generalArea]}`
                        : `Resumo ${scopeLabel}`}
                  </span>
                  <BarChart3 className="h-5 w-5 text-[#d7ee58]" />
                </div>
                <p className="text-sm text-[#ced4f3]">{summaryTitle}</p>
                <div className="mt-4 flex items-center justify-between border-b border-white/10 pb-4 text-xs text-[#ced4f3]">
                  <span>{summaryRecords} chamados calculados</span>
                  <span className="text-right">
                    <span className="block text-[#d7ee58]">Seg–Sex</span>
                    {selected && (
                      <span
                        data-testid="selected-buyer-average"
                        className="mt-1 block text-[11px] text-[#c9cff2]"
                      >
                        Média: {formatDuration(summaryAverageMinutes, true)}
                      </span>
                    )}
                  </span>
                </div>
                <div
                  data-testid={
                    scope === "geral"
                      ? "general-team-metrics"
                      : "area-summary-metrics"
                  }
                  className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"
                >
                  <SummaryMetric label={`Chamados em ${year}`} value={String(displayedReport.totalRecords)} />
                  <SummaryMetric label="Tempo total útil" value={formatDuration(displayedReport.totalUsefulMinutes, true)} />
                  <SummaryMetric label="Tempo médio útil" value={formatDuration(displayedReport.averageUsefulMinutes, true)} />
                  <SummaryMetric label="Compradores com chamados" value={String(summaryActiveBuyers)} />
                  <SummaryMetric label="Áreas no recorte" value={String(summaryActiveAreas)} />
                  <SummaryMetric label="Maior duração" value={formatDuration(summaryLongestMinutes, true)} />
                  <SummaryMetric label="Menor duração" value={formatDuration(summaryShortestMinutes, true)} />
                  <div className="col-span-2 rounded-xl border border-white/10 bg-white/[.06] p-3 sm:col-span-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[.11em] text-[#aeb7e4]">
                      Distribuição por área
                    </p>
                    <p
                      className="mt-2 truncate text-xs font-semibold text-[#e9f1bc]"
                      title={summaryAreaDescription}
                    >
                      {summaryAreaDescription}
                    </p>
                  </div>
                </div>
                {selected && (
                  <BuyerDetail
                    buyer={selected.buyer}
                    records={selected.records}
                    selectedRecordId={selectedRecordId}
                    onSelectRecord={setSelectedRecordId}
                    sortOrder={sortOrder}
                    onSortOrderChange={setSortOrder}
                    embedded
                  />
                )}
              </div>
            </CardContent>
          </Card>
          {!selected && (
            <div
              data-testid={searchQuery.trim() ? "search-empty-state" : undefined}
              className="rounded-2xl border border-dashed border-[#d8ddef] bg-white/60 px-6 py-8 text-center"
            >
              {searchQuery.trim() ? (
                <>
                  <Search className="mx-auto mb-3 h-6 w-6 text-[#a3acc8]" />
                  <p className="text-sm font-medium text-[#636d91]">
                    Nenhum resultado encontrado
                  </p>
                  <p className="mt-1 text-xs text-[#9ca6c4]">
                    Tente outro número de chamado, comprador ou área.
                  </p>
                </>
              ) : (
                <>
                  <UsersRound className="mx-auto mb-3 h-6 w-6 text-[#a3acc8]" />
                  <p className="text-sm font-medium text-[#636d91]">
                    {scope === "geral"
                      ? "Use os filtros acima para explorar a equipe"
                      : "Selecione um comprador para ver o detalhamento"}
                  </p>
                  <p className="mt-1 text-xs text-[#9ca6c4]">
                    Os chamados são recalculados pelas datas de abertura e
                    fechamento.
                  </p>
                </>
              )}
            </div>
          )}{" "}
        </div>
      </main>
    </div>
  );
}

function BuyerTicketPanel({
  records,
  selectedRecordId,
  onSelectRecord,
  dark,
  sortOrder = "default",
  onSortOrderChange = () => undefined,
}: {
  records: GlpiRecord[];
  selectedRecordId: string | null;
  onSelectRecord: (id: string | null) => void;
  dark: boolean;
  sortOrder?: SortOrder;
  onSortOrderChange?: (value: SortOrder) => void;
}) {
  const selectedRecord =
    records.find(record => record.id === selectedRecordId) ?? null;
  const muted = dark ? "text-[#ced4f3]" : "text-[#7781a5]";
  const subtle = dark ? "text-[#aeb7e4]" : "text-[#9ca6c4]";
  const border = dark ? "border-white/10" : "border-[#eef0f3]";
  return (
    <div
      data-testid={dark ? "buyer-summary-inline" : "buyer-summary-card"}
      className={`${dark ? "mt-5 border-white/10 pt-5" : "mt-8 border-[#eef0f3] pt-6"} border-t`}
    >
      {records.length === 0 ? (
        <div className="py-8 text-center">
          <CalendarDays className={`mx-auto mb-3 h-6 w-6 ${subtle}`} />
          <p className={`text-sm font-medium ${muted}`}>
            Sem chamados no período
          </p>
          <p className={`mt-1 text-xs ${subtle}`}>
            Esta aba ainda não possui registros válidos para calcular.
          </p>
        </div>
      ) : (
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]">
          <div className="min-w-0">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <p className={`text-xs font-semibold uppercase tracking-[.12em] ${subtle}`}>
                Chamados do comprador · {records.length}
              </p>
              <div className="w-full sm:w-[240px]">
                <FilterSelect
                  label="Ordenar"
                  value={sortOrder}
                  options={[
                    ["default", "Ordem original"],
                    ["desc", "Maior tempo primeiro"],
                    ["asc", "Menor tempo primeiro"],
                  ]}
                  onChange={value => onSortOrderChange(value as SortOrder)}
                />
              </div>
            </div>
            <div
              data-testid="buyer-ticket-list"
              className="max-h-[332px] space-y-2 overflow-y-auto pr-1"
            >
              {records.map(record => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => onSelectRecord(record.id)}
                  className={`flex h-[60px] w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${selectedRecordId === record.id ? (dark ? "border-[#d7ee58] bg-white/10" : "border-[#312b88] bg-[#f0f0ff]") : dark ? `${border} bg-white/[.04] hover:bg-white/[.08]` : `${border} bg-white hover:border-[#c7ccef] hover:bg-[#fbfbff]`}`}
                >
                  <span className="min-w-0">
                    <span
                      className={`block whitespace-nowrap text-sm font-semibold ${dark ? "text-white" : "text-[#343a73]"}`}
                    >
                      {record.chamado || "Sem número"}
                    </span>
                    <span className={`mt-1 block text-xs ${subtle}`}>
                      {record.status === "valid"
                        ? "Clique para ver o tempo útil"
                        : "Data inválida"}
                    </span>
                  </span>
                  <ChevronRight className={`h-4 w-4 ${subtle}`} />
                </button>
              ))}
            </div>
          </div>
          <div
            className={`min-w-0 rounded-2xl p-5 ${dark ? "border border-white/10 bg-white/[.06]" : "bg-[#f5f5ff]"}`}
          >
            {selectedRecord ? (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p
                      className={`text-xs font-semibold uppercase tracking-[.12em] ${subtle}`}
                    >
                      Detalhe do chamado
                    </p>
                    <h4
                      className={`mt-1 text-xl font-semibold tracking-tight ${dark ? "text-white" : "text-[#263747]"}`}
                    >
                      {selectedRecord.chamado || "Sem número"}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectRecord(null)}
                    className={`text-xs font-semibold underline underline-offset-4 ${dark ? "text-[#c9cff2] hover:text-white" : "text-[#69739a] hover:text-[#312b88]"}`}
                  >
                    Limpar
                  </button>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className={`text-xs ${subtle}`}>Abertura</p>
                    <p
                      className={`mt-1 text-sm font-semibold ${dark ? "text-white" : "text-[#343a73]"}`}
                    >
                      {formatDate(selectedRecord.abertura)}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs ${subtle}`}>Fechamento</p>
                    <p
                      className={`mt-1 text-sm font-semibold ${dark ? "text-white" : "text-[#343a73]"}`}
                    >
                      {formatDate(selectedRecord.fechamento)}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className={`text-xs ${subtle}`}>
                      Tempo útil · segunda a sexta
                    </p>
                    <p
                      className={`mt-1 text-3xl font-semibold tracking-tight ${selectedRecord.status === "valid" ? "text-[#78c2a4]" : "text-[#e6a781]"}`}
                    >
                      {selectedRecord.status === "valid"
                        ? formatDuration(selectedRecord.usefulMinutes)
                        : "Data inválida"}
                    </p>
                    <p className={`mt-2 text-xs leading-5 ${subtle}`}>
                      O cálculo exclui integralmente sábados e domingos, sem
                      descontar feriados ou limitar horário comercial.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[210px] flex-col items-center justify-center text-center">
                <Clock3
                  className={`mb-3 h-6 w-6 ${dark ? "text-[#d7ee58]" : "text-[#c9d64d]"}`}
                />
                <p className={`text-sm font-semibold ${muted}`}>
                  Escolha um chamado
                </p>
                <p className={`mt-1 max-w-xs text-xs leading-5 ${subtle}`}>
                  Clique no número à esquerda para ver as datas e o tempo que
                  levou para ser concluído.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function BuyerDetail({
  buyer,
  records,
  selectedRecordId,
  onSelectRecord,
  sortOrder,
  onSortOrderChange,
  embedded = false,
}: BuyerDetailProps) {
  const valid = records.filter(record => record.status === "valid");
  const total = valid.reduce(
    (sum, record) => sum + (record.usefulMinutes ?? 0),
    0
  );
  const average = valid.length ? Math.round(total / valid.length) : 0;
  const content = (
    <BuyerTicketPanel
      records={records}
      selectedRecordId={selectedRecordId}
      onSelectRecord={onSelectRecord}
      dark={embedded}
      sortOrder={sortOrder}
      onSortOrderChange={onSortOrderChange}
    />
  );
  if (embedded) return content;
  return (
    <Card className="border-[#dce1f0] shadow-[0_12px_35px_rgba(24,43,58,.05)]">
      <CardHeader className="border-b border-[#eef0f3] px-6 py-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#9ca6c4]">
              Resumo do comprador
            </p>
            <CardTitle className="mt-1 text-xl tracking-tight">
              {buyer}
            </CardTitle>
            <p className="mt-1 text-sm text-[#7781a5]">
              Selecione um número para consultar o tempo de cada chamado.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-[#f0f0ff] text-[#312b88] hover:bg-[#f0f0ff]">
              {valid.length} chamados
            </Badge>
            <Badge className="bg-[#fbf3e4] text-[#737f20] hover:bg-[#fbf3e4]">
              total {formatDuration(total, true)}
            </Badge>
            <Badge className="bg-[#f0f6d4] text-[#5f7515] hover:bg-[#f0f6d4]">
              média {formatDuration(average, true)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5">{content}</CardContent>
    </Card>
  );
}

function UnifiedFilters({
  year,
  years,
  semester,
  dateFrom,
  dateTo,
  onYear,
  onSemester,
  onDateFrom,
  onDateTo,
  showArea,
  activeArea,
  onArea,
  buyers,
  selectedBuyer,
  onBuyer,
  query,
  onQueryChange,
  onExport,
  exportDisabled,
  resultCount,
  driveError,
  driveDiagnostics,
  reportsSource,
}: {
  year: number;
  years: number[];
  semester: SemesterChoice;
  dateFrom: string;
  dateTo: string;
  onYear: (value: number) => void;
  onSemester: (value: SemesterChoice) => void;
  onDateFrom: (value: string) => void;
  onDateTo: (value: string) => void;
  showArea: boolean;
  activeArea: AreaKey | "all";
  onArea: (value: AreaKey | "all") => void;
  buyers: SemesterReport["buyers"];
  selectedBuyer: string | null;
  onBuyer: (value: string | null) => void;
  query: string;
  onQueryChange: (value: string) => void;
  onExport: () => void;
  exportDisabled: boolean;
  resultCount: number;
  driveError: boolean;
  driveDiagnostics?: DriveDiagnosticsView;
  reportsSource: "drive" | "cache" | "initial";
}) {
  return (
    <Card
      data-testid="search-export-bar"
      className="min-w-0 border-[#dce1f0] bg-white/90 shadow-[0_8px_25px_rgba(24,43,58,.04)]"
    >
      <CardContent className="space-y-4 p-4 md:p-5">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FilterSelect
            label="Ano"
            value={String(year)}
            options={years.map(item => [String(item), String(item)])}
            onChange={value => onYear(Number(value))}
          />
          <FilterSelect
            label="Semestre"
            value={semester}
            options={[
              ["all", "Todos os semestres"],
              ["first", "1º semestre"],
              ["second", "2º semestre"],
            ]}
            onChange={value => onSemester(value as SemesterChoice)}
          />
          <DateFilter label="De" value={dateFrom} onChange={onDateFrom} />
          <DateFilter label="Até" value={dateTo} onChange={onDateTo} />
        </div>

        <div className={`grid min-w-0 gap-3 ${showArea ? "lg:grid-cols-2" : "lg:grid-cols-1"}`}>
          {showArea && (
            <div data-testid="area-filter" className="min-w-0">
              <FilterSelect
                label="Filtrar área"
                value={activeArea}
                options={[["all", "Todas as áreas"], ...Object.entries(areaLabels)]}
                onChange={value => onArea(value as AreaKey | "all")}
              />
            </div>
          )}
          <div data-testid="buyer-filter" className="min-w-0">
            <label className="flex min-w-0 flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-[#7781a5]">
              <span>Filtrar comprador</span>
              <select
                aria-label="Filtrar comprador"
                value={selectedBuyer ?? ""}
                onChange={event => onBuyer(event.target.value || null)}
                className="h-10 w-full rounded-xl border border-[#d8ddef] bg-white px-3 text-sm font-medium normal-case tracking-normal text-[#343a73] outline-none transition-colors focus:border-[#312b88] focus:ring-2 focus:ring-[#312b88]/10"
              >
                <option value="">Todos os compradores</option>
                {buyers.map(buyer => (
                  <option key={buyer.buyer} value={buyer.buyer}>
                    {buyer.buyer}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {(driveError || driveDiagnostics?.hasIssues) && (
          <div className="rounded-xl border border-[#e7dfad] bg-[#fffced] px-4 py-3 text-sm text-[#817328]">
            <p className="font-semibold">
              {driveError ? "Drive indisponível" : "Sincronização parcial do Drive"}
            </p>
            <p className="mt-1">
              {driveError
                ? reportsSource === "initial"
                  ? "Não foi possível concluir a consulta. A base inicial local permanece visível; os arquivos originais não foram modificados."
                  : "Não foi possível concluir a consulta. A última base válida permanece visível; os arquivos originais não foram modificados."
                : "A consulta terminou, mas uma ou mais áreas, anos ou arquivos apresentaram falha. A base anterior foi preservada; verifique os alertas antes de interpretar uma área vazia como ausência de chamados."}
            </p>
            {driveDiagnostics?.hasIssues && (
              <ul className="mt-2 space-y-1 text-xs">
                {Object.entries(driveDiagnostics.areas)
                  .flatMap(([area, diagnostic]) => diagnostic.errors.map(error => ({ area, ...error })))
                  .slice(0, 4)
                  .map(error => (
                    <li key={`${error.area}-${error.scope}-${error.year ?? "all"}-${error.file ?? "area"}`}>
                      <span className="font-semibold">{error.area}</span>{error.year ? ` · ${error.year}` : ""}{error.file ? ` · ${error.file}` : ""}: {error.message}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}

        <div className="grid min-w-0 items-end gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
          <label className="flex min-w-0 flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-[#7781a5]">
            <span>Buscar chamados ou área</span>
            <span className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca6c4]" />
              <input
                aria-label="Buscar chamados ou área"
                type="search"
                value={query}
                onChange={event => onQueryChange(event.target.value)}
                placeholder="Número do chamado, comprador ou área"
                className="h-10 w-full rounded-xl border border-[#d8ddef] bg-white pl-9 pr-3 text-sm font-medium normal-case tracking-normal text-[#343a73] outline-none transition-colors placeholder:text-[#a3acc8] focus:border-[#312b88] focus:ring-2 focus:ring-[#312b88]/10"
              />
            </span>
          </label>
          <div className="flex min-w-0 items-center justify-between gap-3 xl:justify-end">
            <span className="text-xs text-[#7781a5]">
              {resultCount} {resultCount === 1 ? "chamado encontrado" : "chamados encontrados"}
            </span>
            <button
              data-testid="export-filtered"
              type="button"
              onClick={onExport}
              disabled={exportDisabled}
              className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[#312b88] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#4741a3] focus:outline-none focus:ring-2 focus:ring-[#312b88]/20 disabled:cursor-not-allowed disabled:bg-[#cfd4e4]"
            >
              <Download className="h-4 w-4" />
              Exportar filtrado
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SearchExportBar({
  query,
  onQueryChange,
  sortOrder,
  onSortOrderChange,
  onExport,
  exportDisabled,
  resultCount,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  sortOrder: SortOrder;
  onSortOrderChange: (value: SortOrder) => void;
  onExport: () => void;
  exportDisabled: boolean;
  resultCount: number;
}) {
  return (
    <Card
      data-testid="search-export-bar"
      className="min-w-0 border-[#dce1f0] bg-white/90 shadow-[0_8px_25px_rgba(24,43,58,.04)]"
    >
      <CardContent className="flex min-w-0 flex-col gap-3 p-4 lg:flex-row lg:flex-nowrap lg:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-[#7781a5]">
          <span>Buscar chamados ou área</span>
          <span className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca6c4]" />
            <input
              aria-label="Buscar chamados ou área"
              type="search"
              value={query}
              onChange={event => onQueryChange(event.target.value)}
              placeholder="Número do chamado, comprador ou área"
              className="h-10 w-full rounded-xl border border-[#d8ddef] bg-white pl-9 pr-3 text-sm font-medium normal-case tracking-normal text-[#343a73] outline-none transition-colors placeholder:text-[#a3acc8] focus:border-[#312b88] focus:ring-2 focus:ring-[#312b88]/10"
            />
          </span>
        </label>
        <FilterSelect
          label="Ordenar"
          value={sortOrder}
          options={[
            ["default", "Ordem original"],
            ["desc", "Maior tempo primeiro"],
            ["asc", "Menor tempo primeiro"],
          ]}
          onChange={value => onSortOrderChange(value as SortOrder)}
        />
        <div className="flex items-center justify-between gap-3 md:pb-0.5">
          <span className="text-xs text-[#7781a5]">
            {resultCount}{" "}
            {resultCount === 1 ? "chamado encontrado" : "chamados encontrados"}
          </span>
          <button
            data-testid="export-filtered"
            type="button"
            onClick={onExport}
            disabled={exportDisabled}
            className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[#312b88] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#4741a3] focus:outline-none focus:ring-2 focus:ring-[#312b88]/20 disabled:cursor-not-allowed disabled:bg-[#cfd4e4]"
          >
            <Download className="h-4 w-4" />
            Exportar filtrado
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterBar({
  year,
  years,
  semester,
  dateFrom,
  dateTo,
  onYear,
  onSemester,
  onDateFrom,
  onDateTo,
}: {
  year: number;
  years: number[];
  semester: SemesterChoice;
  dateFrom: string;
  dateTo: string;
  onYear: (value: number) => void;
  onSemester: (value: SemesterChoice) => void;
  onDateFrom: (value: string) => void;
  onDateTo: (value: string) => void;
}) {
  return (
    <Card className="min-w-0 border-[#dce1f0] bg-white/90 shadow-[0_8px_25px_rgba(24,43,58,.04)]">
      <CardContent className="flex min-w-0 flex-col gap-3 p-4 lg:flex-row lg:flex-nowrap lg:items-end">
        <FilterSelect
          label="Ano"
          value={String(year)}
          options={years.map(item => [String(item), String(item)])}
          onChange={value => onYear(Number(value))}
        />
        <FilterSelect
          label="Semestre"
          value={semester}
          options={[
            ["all", "Todos os semestres"],
            ["first", "1º semestre"],
            ["second", "2º semestre"],
          ]}
          onChange={value => onSemester(value as SemesterChoice)}
        />
        <DateFilter label="De" value={dateFrom} onChange={onDateFrom} />
        <DateFilter label="Até" value={dateTo} onChange={onDateTo} />
      </CardContent>
    </Card>
  );
}

function DateFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-[150px] flex-1 flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-[#7781a5]">
      <span>{label}</span>
      <input
        type="date"
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-10 rounded-xl border border-[#d8ddef] bg-white px-3 text-sm font-medium normal-case tracking-normal text-[#343a73] outline-none transition-colors focus:border-[#312b88] focus:ring-2 focus:ring-[#312b88]/10"
      />
    </label>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[][];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-[150px] flex-1 flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-[#7781a5]">
      <span>{label}</span>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-10 rounded-xl border border-[#d8ddef] bg-white px-3 text-sm font-medium normal-case tracking-normal text-[#343a73] outline-none transition-colors focus:border-[#312b88] focus:ring-2 focus:ring-[#312b88]/10"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function BuyerFilter({
  buyers,
  selectedBuyer,
  onSelect,
}: {
  buyers: SemesterReport["buyers"];
  selectedBuyer: string | null;
  onSelect: (buyer: string | null) => void;
}) {
  return (
    <Card
      data-testid="buyer-filter"
      className="min-w-0 border-[#dce1f0] bg-white/90 shadow-[0_8px_25px_rgba(24,43,58,.04)]"
    >
      <CardContent className="p-4">
        <label className="flex min-w-0 flex-col gap-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-[#7781a5]">
          <span>Filtrar comprador</span>
          <select
            aria-label="Filtrar comprador"
            value={selectedBuyer ?? ""}
            onChange={event => onSelect(event.target.value || null)}
            className="h-10 w-full rounded-xl border border-[#d8ddef] bg-white px-3 text-sm font-medium normal-case tracking-normal text-[#343a73] outline-none transition-colors focus:border-[#312b88] focus:ring-2 focus:ring-[#312b88]/10"
          >
            <option value="">Todos os compradores</option>
            {buyers.map(buyer => (
              <option key={buyer.buyer} value={buyer.buyer}>
                {buyer.buyer}
              </option>
            ))}
          </select>
        </label>
      </CardContent>
    </Card>
  );
}

function AreaFilter({
  active,
  onSelect,
}: {
  active: AreaKey | "all";
  onSelect: (area: AreaKey | "all") => void;
}) {
  const options: string[][] = [
    ["all", "Todas as áreas"],
    ...Object.entries(areaLabels),
  ];
  return (
    <Card data-testid="area-filter" className="min-w-0 border-[#dce1f0] bg-white/90 shadow-[0_8px_25px_rgba(49,43,136,.06)]">
      <CardContent className="p-4">
        <FilterSelect
          label="Filtrar área"
          value={active}
          options={options}
          onChange={value => onSelect(value as AreaKey | "all")}
        />
      </CardContent>
    </Card>
  );
}


function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[.06] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[.11em] text-[#aeb7e4]">
        {label}
      </p>
      <p className="mt-2 truncate text-base font-semibold text-white" title={value}>
        {value}
      </p>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  accent: "blue" | "gold" | "green";
}) {
  const colors = {
    blue: "bg-[#ececff] text-[#312b88]",
    gold: "bg-[#fbf3e4] text-[#b2771d]",
    green: "bg-[#f0f6d4] text-[#5f7515]",
  };
  return (
    <Card className="min-w-0 border-[#dce1f0] shadow-[0_12px_35px_rgba(24,43,58,.05)]">
      <CardContent className="p-5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-[#7781a5]">{label}</p>
            <p className="mt-3 text-[25px] font-semibold tracking-[-.04em] text-[#263747]">
              {value}
            </p>
            <p className="mt-1 text-xs text-[#9ca6c4]">{detail}</p>
          </div>
          <div
            className={`grid h-10 w-10 place-items-center rounded-xl ${colors[accent]}`}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
