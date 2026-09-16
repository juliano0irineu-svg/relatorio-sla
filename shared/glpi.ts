export type SemesterKey = "first" | "second";

export type GlpiRawRecord = {
  chamado: string | number | null;
  abertura: string | Date | null;
  fechamento: string | Date | null;
  tempo?: string | null;
};

export type GlpiRecord = {
  id: string;
  chamado: string;
  abertura: Date | null;
  fechamento: Date | null;
  reportedDuration: string | null;
  usefulMinutes: number | null;
  status: "valid" | "invalid";
};

export type BuyerReport = {
  buyer: string;
  records: GlpiRecord[];
  count: number;
  totalUsefulMinutes: number;
  averageUsefulMinutes: number;
};

export type SemesterReport = {
  key: SemesterKey;
  label: string;
  buyers: BuyerReport[];
  totalRecords: number;
  totalUsefulMinutes: number;
  averageUsefulMinutes: number;
};

function asDate(value: string | Date | null | undefined): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Counts elapsed minutes while the cursor is on Monday-Friday. Weekends are removed in full. */
export function usefulWeekdayMinutes(start: Date | null, end: Date | null): number | null {
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
  let cursor = new Date(start);
  let total = 0;
  const endTime = end.getTime();

  while (cursor.getTime() < endTime) {
    const day = cursor.getDay();
    const nextMidnight = new Date(cursor);
    nextMidnight.setHours(24, 0, 0, 0);
    const segmentEnd = Math.min(nextMidnight.getTime(), endTime);
    if (day !== 0 && day !== 6) total += segmentEnd - cursor.getTime();
    cursor = nextMidnight;
  }

  return Math.round(total / 60000);
}

export function formatDuration(minutes: number | null, compact = false): string {
  if (minutes === null || !Number.isFinite(minutes)) return "Dados inválidos";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remaining = minutes % 60;
  return compact
    ? `${days}d ${String(hours).padStart(2, "0")}h${String(remaining).padStart(2, "0")}`
    : `${days} dias e ${String(hours).padStart(2, "0")}h${String(remaining).padStart(2, "0")}min`;
}

export function normalizeRecord(raw: GlpiRawRecord, index: number): GlpiRecord {
  const abertura = asDate(raw.abertura);
  const fechamento = asDate(raw.fechamento);
  return {
    id: `${String(raw.chamado ?? "sem-chamado")}-${index}`,
    chamado: String(raw.chamado ?? "").trim(),
    abertura,
    fechamento,
    reportedDuration: raw.tempo ? String(raw.tempo).trim() : null,
    usefulMinutes: usefulWeekdayMinutes(abertura, fechamento),
    status: raw.chamado && abertura && fechamento && fechamento >= abertura ? "valid" : "invalid",
  };
}

export function summarizeBuyer(buyer: string, records: GlpiRecord[]): BuyerReport {
  const valid = records.filter((record) => record.status === "valid" && record.usefulMinutes !== null);
  const totalUsefulMinutes = valid.reduce((sum, record) => sum + (record.usefulMinutes ?? 0), 0);
  return {
    buyer,
    records,
    count: valid.length,
    totalUsefulMinutes,
    averageUsefulMinutes: valid.length ? Math.round(totalUsefulMinutes / valid.length) : 0,
  };
}

function nameKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Names used in old and new workbook tabs for the same buyer.
 * Keep this list explicit so it can be revised without changing source spreadsheets.
 */
export const BUYER_ALIASES: Record<string, string> = {
  "magno": "Alexandre Magno Brandao",
  "magno brandao": "Alexandre Magno Brandao",
  "gabrielly": "Gabrielly Oliveira",
  "mariana": "Mariana Damasceno",
  "luiz": "Luiz Machado",
  "silvia": "Silvia Gonçalves",
};

function canonicalBuyerName(value: string): string {
  const separator = " · ";
  const separatorIndex = value.indexOf(separator);
  const areaPrefix = separatorIndex >= 0 ? value.slice(0, separatorIndex + separator.length) : "";
  const buyerName = separatorIndex >= 0 ? value.slice(separatorIndex + separator.length) : value;
  return `${areaPrefix}${BUYER_ALIASES[nameKey(buyerName)] ?? buyerName}`;
}

/** Consolidates confirmed aliases and safe short-name matches while preserving records. */
export function collapseBuyerAliases(buyers: BuyerReport[]): BuyerReport[] {
  const normalized = buyers.map((buyer) => ({ buyer, key: nameKey(buyer.buyer), parts: nameKey(buyer.buyer).split(" ").filter(Boolean) }));
  const fullNames = normalized.filter(({ parts }) => parts.length > 1);
  const groups = new Map<string, BuyerReport[]>();

  for (const entry of normalized) {
    const configuredName = canonicalBuyerName(entry.buyer.buyer);
    const hasConfiguredName = configuredName !== entry.buyer.buyer;
    const candidates = !hasConfiguredName && entry.parts.length === 1
      ? fullNames.filter(({ parts }) => parts.includes(entry.key))
      : [];
    const canonical = hasConfiguredName
      ? { buyer: configuredName }
      : candidates.length === 1
        ? candidates[0]!.buyer
        : entry.buyer;
    const key = nameKey(canonical.buyer);
    groups.set(key, [...(groups.get(key) ?? []), entry.buyer]);
  }

  return Array.from(groups.values()).map((group) => {
    const canonical = [...group].sort((a, b) => b.buyer.trim().length - a.buyer.trim().length)[0]!;
    return summarizeBuyer(canonicalBuyerName(canonical.buyer), group.flatMap((buyer) => buyer.records));
  });
}

export function summarizeSemester(key: SemesterKey, buyers: BuyerReport[]): SemesterReport {
  const totalRecords = buyers.reduce((sum, buyer) => sum + buyer.count, 0);
  const totalUsefulMinutes = buyers.reduce((sum, buyer) => sum + buyer.totalUsefulMinutes, 0);
  return {
    key,
    label: key === "first" ? "1º semestre" : "2º semestre",
    buyers,
    totalRecords,
    totalUsefulMinutes,
    averageUsefulMinutes: totalRecords ? Math.round(totalUsefulMinutes / totalRecords) : 0,
  };
}

export function formatDate(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(value);
}
