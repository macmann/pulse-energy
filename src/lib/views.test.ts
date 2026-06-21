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
import { buildConsumptionView, buildHome } from "./views";

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
  const events = readJson<InsightEvent[]>("insight_events.json");
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
    events: events.filter((i) => i.household_id === HOUSEHOLD_ID),
    spotPrices: prices.prices,
    records: ts.records,
  };
}

describe("Consumption view model", () => {
  const ds = loadDataset();
  const view = buildConsumptionView(ds);

  it("uses the full HH-1001 15-minute record set", () => {
    expect(ds.records.length).toBe(35040);
    expect(view.overview.dataPeriod).toBe("2025-01-01 to 2025-12-31");
  });

  it("computes annual totals from records and bills", () => {
    const consumption = ds.records.reduce(
      (sum, r) => sum + r.total_consumption_kw * STEP_H,
      0,
    );
    const billTotal = ds.bills.reduce((sum, b) => sum + b.total_bill_eur, 0);

    expect(view.annualTotals.consumptionKwh).toBeCloseTo(consumption, 1);
    expect(view.annualTotals.billTotalEur).toBeCloseTo(billTotal, 2);
    expect(view.annualTotals.gridImportKwh).toBeGreaterThan(0);
    expect(view.annualTotals.pvProductionKwh).toBeGreaterThan(0);
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

    expect(view.tariffFit.hourly[hour].avgRetailPrice).toBe(expected);
  });

  it("includes EV, heat pump, and household load fingerprints", () => {
    expect(view.loadBreakdown.map((l) => l.id)).toEqual([
      "household",
      "heatpump",
      "ev",
    ]);
    expect(view.loadBreakdown.every((l) => l.kwh > 0)).toBe(true);
    expect(view.ev.totalKwh).toBeGreaterThan(2500);
  });

  it("does not embed Home anomaly or nudge event copy", () => {
    const serialized = JSON.stringify(view);
    expect("alerts" in view).toBe(false);
    expect(serialized).not.toContain("Heat pump consumed");
    expect(serialized).not.toContain("Cheapest power is around");
  });
});

describe("Home view", () => {
  it("loads all meter-backed event categories for recommendations", () => {
    const ds = loadDataset();

    expect([...new Set(ds.events.map((event) => event.type))].sort()).toEqual([
      "anomaly",
      "insight",
      "nudge",
    ]);
  });

  it("filters anomaly and nudge events into Home alerts", () => {
    const home = buildHome(loadDataset());

    expect(home.alerts.map((alert) => alert.type).sort()).toEqual([
      "anomaly",
      "nudge",
    ]);
    expect(home.alerts.every((alert) => alert.type !== "insight")).toBe(true);
  });

  it("uses ranked recommendations for reminders", () => {
    const home = buildHome(loadDataset());

    expect(home.reminders.length).toBeGreaterThan(0);
    expect(home.reminders.length).toBeLessThanOrEqual(2);
    expect(home.reminders.every((r) => !r.minor)).toBe(true);
  });
});
