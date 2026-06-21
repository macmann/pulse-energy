import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  Contract,
  Household,
  InsightEvent,
  MonthlyBill,
  SpotPrice,
  Tariff,
  TimeseriesRecord,
} from "../types";
import type { Dataset } from "./data";
import { buildEnergyProfile, buildHome } from "./views";

const HOUSEHOLD_ID = "HH-1001";
const STEP_H = 0.25;

function readJson<T>(path: string): T {
  return JSON.parse(
    readFileSync(resolve(__dirname, "../../public/data", path), "utf8"),
  ) as T;
}

function loadDataset(): Dataset {
  const households = readJson<Household[]>("households.json");
  const contracts = readJson<Contract[]>("contracts.json");
  const tariffs = readJson<Tariff[]>("tariffs.json");
  const bills = readJson<MonthlyBill[]>("monthly_bills.json");
  const insights = readJson<InsightEvent[]>("insight_events.json");
  const prices = readJson<{ prices: SpotPrice[] }>("dynamic_prices.json");
  const ts = readJson<{ records: TimeseriesRecord[] }>(
    "energy_timeseries_HH-1001.json",
  );

  const household = households.find((h) => h.household_id === HOUSEHOLD_ID)!;
  return {
    household,
    contract: contracts.find((c) => c.household_id === HOUSEHOLD_ID)!,
    tariff: tariffs.find((t) => t.tariff_id === household.tariff_id)!,
    bills: bills.filter((b) => b.household_id === HOUSEHOLD_ID),
    insights: insights.filter((i) => i.household_id === HOUSEHOLD_ID),
    spotPrices: prices.prices,
    records: ts.records,
  };
}

describe("Energy Profile view model", () => {
  const ds = loadDataset();
  const profile = buildEnergyProfile(ds);

  it("uses the full HH-1001 15-minute record set", () => {
    expect(ds.records.length).toBe(35040);
    expect(profile.overview.dataPeriod).toBe("2025-01-01 to 2025-12-31");
  });

  it("computes annual totals from records and bills", () => {
    const consumption = ds.records.reduce(
      (sum, r) => sum + r.total_consumption_kw * STEP_H,
      0,
    );
    const billTotal = ds.bills.reduce((sum, b) => sum + b.total_bill_eur, 0);

    expect(profile.annualTotals.consumptionKwh).toBeCloseTo(consumption, 1);
    expect(profile.annualTotals.billTotalEur).toBeCloseTo(billTotal, 2);
    expect(profile.annualTotals.gridImportKwh).toBeGreaterThan(0);
    expect(profile.annualTotals.pvProductionKwh).toBeGreaterThan(0);
  });

  it("builds dynamic retail prices from spot prices plus tariff adder", () => {
    if (ds.tariff.type !== "dynamic_hourly") {
      throw new Error("HH-1001 should use the dynamic tariff");
    }

    const hour = 0;
    const spotAdder = ds.tariff.spot_adder_eur_per_kwh;
    const hourPrices = ds.spotPrices.filter(
      (p) => Number(p.timestamp.slice(11, 13)) === hour,
    );
    const expected =
      Math.round(
        (hourPrices.reduce(
          (sum, p) => sum + p.spot_price_eur_per_kwh + spotAdder,
          0,
        ) /
          hourPrices.length) *
          1000,
      ) / 1000;

    expect(profile.tariffFit.hourly[hour].avgRetailPrice).toBe(expected);
  });

  it("includes EV, heat pump, and household load fingerprints", () => {
    expect(profile.loadBreakdown.map((l) => l.id)).toEqual([
      "household",
      "heatpump",
      "ev",
    ]);
    expect(profile.loadBreakdown.every((l) => l.kwh > 0)).toBe(true);
    expect(profile.ev.totalKwh).toBeGreaterThan(2500);
  });

  it("does not embed Home anomaly or nudge event copy", () => {
    const serialized = JSON.stringify(profile);
    expect("alerts" in profile).toBe(false);
    expect(serialized).not.toContain("Heat pump consumed");
    expect(serialized).not.toContain("Cheapest power is around");
  });
});

describe("Home alert view", () => {
  it("filters Home alerts to anomalies and nudges only", () => {
    const home = buildHome(loadDataset());

    expect(home.alerts.length).toBe(2);
    expect(home.alerts.map((a) => a.type).sort()).toEqual(["anomaly", "nudge"]);
    expect(home.alerts.some((a) => a.title.includes("Highest bill"))).toBe(false);
  });
});
