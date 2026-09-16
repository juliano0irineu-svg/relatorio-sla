import { describe, expect, it } from "vitest";
import { areaReports, buildGeneralReport } from "../client/src/data/glpiData";

describe("GLPI areas", () => {
  it("keeps each area with its own semester reports", () => {
    expect(areaReports.indiretos.first.totalRecords).toBe(7);
    expect(areaReports.suprimentosAdm.first.totalRecords).toBe(0);
    expect(areaReports.transportes.first.totalRecords).toBe(0);
    expect(areaReports.indiretos).not.toBe(areaReports.suprimentosAdm);
  });

  it("keeps empty areas explicit until their real workbooks are uploaded", () => {
    expect(areaReports.suprimentosAdm.second.buyers.length).toBe(0);
    expect(areaReports.transportes.second.totalRecords).toBe(0);
  });

  it("consolidates all areas and responds to a selected area", () => {
    const all = buildGeneralReport(areaReports, "first", "all");
    const indirect = buildGeneralReport(areaReports, "first", "indiretos");
    const admin = buildGeneralReport(areaReports, "first", "suprimentosAdm");
    expect(all.totalRecords).toBe(7);
    expect(indirect.totalUsefulMinutes).toBe(all.totalUsefulMinutes);
    expect(admin.totalRecords).toBe(0);
    expect(admin.averageUsefulMinutes).toBe(0);

    const allSecond = buildGeneralReport(areaReports, "second", "all");
    const indirectSecond = buildGeneralReport(areaReports, "second", "indiretos");
    const transportSecond = buildGeneralReport(areaReports, "second", "transportes");
    expect(allSecond.totalRecords).toBe(0);
    expect(indirectSecond.totalUsefulMinutes).toBe(0);
    expect(transportSecond.averageUsefulMinutes).toBe(0);
  });
});
