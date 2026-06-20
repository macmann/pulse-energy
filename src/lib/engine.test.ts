import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { TimeseriesRecord } from "../types";
import { evPattern, evWaste, surplusSummary } from "./engine";

function load(): TimeseriesRecord[] {
  const p = resolve(
    __dirname,
    "../../public/data/energy_timeseries_HH-1001.json",
  );
  return JSON.parse(readFileSync(p, "utf8")).records as TimeseriesRecord[];
}

describe("HH-1001 EV-waste insight", () => {
  const records = load();

  it("has a full year of 15-minute records", () => {
    expect(records.length).toBe(35040);
  });

  it("charges the EV overnight, mostly from the grid", () => {
    const ev = evPattern(records);
    expect(ev.typicalStartHour).toBeLessThanOrEqual(1); // around midnight
    expect(ev.totalKwh).toBeGreaterThan(2500);
    expect(ev.pctFromSolar).toBeLessThan(25); // very little is solar
  });

  it("gives thousands of kWh of free solar to the grid", () => {
    const s = surplusSummary(records);
    expect(s.exportedKwh).toBeGreaterThan(3500);
    expect(s.avgImportPrice).toBeGreaterThan(s.feedInEarned / s.exportedKwh); // buy-back >> feed-in
  });

  it("would save ~€25–40/mo by shifting night charging onto midday solar", () => {
    const w = evWaste(records);
    expect(w.savingPerMonthEur).toBeGreaterThanOrEqual(20);
    expect(w.savingPerMonthEur).toBeLessThanOrEqual(45);
    expect(w.coverablePct).toBeGreaterThan(20); // possible on a meaningful share of days
  });
});
