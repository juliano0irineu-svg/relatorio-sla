import { describe, expect, it } from "vitest";
import { normalizeRecord, summarizeBuyer, usefulWeekdayMinutes } from "./glpi";

describe("usefulWeekdayMinutes", () => {
  it("calcula um chamado no mesmo dia útil", () => {
    expect(usefulWeekdayMinutes(new Date("2026-07-13T09:00:00"), new Date("2026-07-13T11:30:00"))).toBe(150);
  });

  it("remove integralmente o fim de semana entre sexta e segunda", () => {
    expect(usefulWeekdayMinutes(new Date("2026-07-24T10:44:00"), new Date("2026-07-27T09:01:00"))).toBe(1337);
  });

  it("mantém somente minutos de dias úteis atravessando vários fins de semana", () => {
    expect(usefulWeekdayMinutes(new Date("2026-07-17T10:00:00"), new Date("2026-07-27T10:00:00"))).toBe(8640);
  });

  it("retorna nulo para datas ausentes, inválidas ou invertidas", () => {
    expect(usefulWeekdayMinutes(null, new Date("2026-07-13T11:00:00"))).toBeNull();
    expect(usefulWeekdayMinutes(new Date("invalid"), new Date("2026-07-13T11:00:00"))).toBeNull();
    expect(usefulWeekdayMinutes(new Date("2026-07-14T11:00:00"), new Date("2026-07-13T11:00:00"))).toBeNull();
  });
});

describe("GLPI summaries", () => {
  it("marca datas inválidas sem quebrar o relatório", () => {
    const record = normalizeRecord({ chamado: "ABC", abertura: "not-a-date", fechamento: "2026-07-13T11:00:00" }, 0);
    expect(record.status).toBe("invalid");
    expect(record.usefulMinutes).toBeNull();
  });

  it("representa uma aba vazia com contadores zerados", () => {
    const summary = summarizeBuyer("Gabrielly", []);
    expect(summary.count).toBe(0);
    expect(summary.totalUsefulMinutes).toBe(0);
    expect(summary.averageUsefulMinutes).toBe(0);
  });
});
