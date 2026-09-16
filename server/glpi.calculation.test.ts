import { describe, expect, it } from "vitest";
import { collapseBuyerAliases, normalizeRecord, summarizeBuyer, usefulWeekdayMinutes } from "../shared/glpi";

describe("GLPI useful duration", () => {
  it("calculates a same-day weekday ticket", () => {
    expect(usefulWeekdayMinutes(new Date("2026-07-13T09:00:00"), new Date("2026-07-13T11:30:00"))).toBe(150);
  });

  it("removes the full weekend from Friday to Monday", () => {
    expect(usefulWeekdayMinutes(new Date("2026-07-24T10:44:00"), new Date("2026-07-27T09:01:00"))).toBe(1337);
  });

  it("keeps only weekdays across multiple weekends", () => {
    expect(usefulWeekdayMinutes(new Date("2026-07-17T10:00:00"), new Date("2026-07-27T10:00:00"))).toBe(8640);
  });

  it("returns null for missing, invalid, or inverted dates", () => {
    expect(usefulWeekdayMinutes(null, new Date("2026-07-13T11:00:00"))).toBeNull();
    expect(usefulWeekdayMinutes(new Date("invalid"), new Date("2026-07-13T11:00:00"))).toBeNull();
    expect(usefulWeekdayMinutes(new Date("2026-07-14T11:00:00"), new Date("2026-07-13T11:00:00"))).toBeNull();
  });

  it("consolidates a short tab into a unique full buyer name", () => {
    const full = summarizeBuyer("Magno Brandao", [normalizeRecord({ chamado: "100", abertura: "2026-07-13T09:00:00", fechamento: "2026-07-13T10:00:00" }, 0)]);
    const short = summarizeBuyer("Magno", [normalizeRecord({ chamado: "101", abertura: "2026-07-14T09:00:00", fechamento: "2026-07-14T11:00:00" }, 0)]);
    expect(collapseBuyerAliases([full, short])).toMatchObject([{ buyer: "Magno Brandao", count: 2 }]);
  });

  it("consolidates observed GLPI aliases under the full tab name", () => {
    const full = summarizeBuyer("Alexandre Magno Brandao", [normalizeRecord({ chamado: "200", abertura: "2026-07-13T09:00:00", fechamento: "2026-07-13T10:00:00" }, 0)]);
    const alias = summarizeBuyer("Magno", [normalizeRecord({ chamado: "201", abertura: "2026-07-14T09:00:00", fechamento: "2026-07-14T10:00:00" }, 0)]);
    const result = collapseBuyerAliases([full, alias]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ buyer: "Alexandre Magno Brandao", count: 2 });
  });

  it("consolidates the other observed buyer aliases under their full names", () => {
    const pairs = [["Gabrielly Oliveira", "Gabrielly"], ["Mariana Damasceno", "Mariana"], ["Luiz Machado", "Luiz"], ["Silvia Gonçalves", "Silvia"]] as const;
    for (const [fullName, alias] of pairs) {
      const result = collapseBuyerAliases([summarizeBuyer(fullName, []), summarizeBuyer(alias, [])]);
      expect(result.map((buyer) => buyer.buyer)).toEqual([fullName]);
    }
  });

  it("keeps a short name separate when more than one full-name candidate exists", () => {
    const first = summarizeBuyer("Ana Silva", []);
    const second = summarizeBuyer("Ana Souza", []);
    const short = summarizeBuyer("Ana", []);
    expect(collapseBuyerAliases([first, second, short]).map((buyer) => buyer.buyer)).toEqual(["Ana Silva", "Ana Souza", "Ana"]);
  });

  it("deduplicates aliases again after semester consolidation", () => {
    const firstSemester = summarizeBuyer("Alexandre Magno Brandao", [normalizeRecord({ chamado: "300", abertura: "2026-07-13T09:00:00", fechamento: "2026-07-13T10:00:00" }, 0)]);
    const secondSemester = summarizeBuyer("Magno", [normalizeRecord({ chamado: "301", abertura: "2026-08-03T09:00:00", fechamento: "2026-08-03T11:00:00" }, 0)]);
    const consolidated = collapseBuyerAliases([firstSemester, secondSemester]);
    expect(consolidated.map((buyer) => buyer.buyer)).toEqual(["Alexandre Magno Brandao"]);
    expect(consolidated[0]?.count).toBe(2);
  });

  it("marks invalid dates and preserves an empty buyer state", () => {
    const record = normalizeRecord({ chamado: "ABC", abertura: "not-a-date", fechamento: "2026-07-13T11:00:00" }, 0);
    const summary = summarizeBuyer("Gabrielly", []);
    expect(record.status).toBe("invalid");
    expect(record.usefulMinutes).toBeNull();
    expect(summary).toMatchObject({ count: 0, totalUsefulMinutes: 0, averageUsefulMinutes: 0 });
  });
});
