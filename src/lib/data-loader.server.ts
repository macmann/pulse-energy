// Server-only data loader for the Enpal Pulse demo dataset.
//
// Small reference data (households, contracts, tariffs, monthly bills, insight
// events, hourly spot prices) is imported from src/data/raw/ as plain JSON
// modules — those files are small (<1 MB combined) and stay verbatim.
//
// The large 15-minute energy timeseries (one file per household, ~19 MB each)
// is stored as a Lovable Asset (CDN-hosted) and fetched lazily on first use,
// then cached in-memory for the lifetime of the worker.

import households from "@/data/raw/households.json";
import contracts from "@/data/raw/contracts.json";
import tariffs from "@/data/raw/tariffs.json";
import monthlyBills from "@/data/raw/monthly_bills.json";
import insightEvents from "@/data/raw/insight_events.json";
import dynamicPrices from "@/data/raw/dynamic_prices.json";

import asset1001 from "@/data/timeseries/HH-1001.asset.json";
import asset1002 from "@/data/timeseries/HH-1002.asset.json";
import asset1003 from "@/data/timeseries/HH-1003.asset.json";
import asset1004 from "@/data/timeseries/HH-1004.asset.json";

export type Household = {
  household_id: string;
  name: string;
  city: string;
  residents: number;
  pv_kwp: number;
  battery_kwh: number;
  battery_power_kw: number;
  heat_pump: boolean;
  ev_charger: boolean;
  tariff_id: string;
  timeseries_file: string;
};

export type Contract = {
  household_id: string;
  customer_name: string;
  supply_address: { city: string; country: string };
  provider: string;
  tariff_id: string;
  tariff_name: string;
  contract_start: string;
  contract_end: string;
  minimum_term_months: number;
  notice_period_weeks: number;
  auto_renew_months: number;
  base_fee_eur_per_month: number;
  energy_pricing: { model: string; spot_adder_eur_per_kwh: number };
  feed_in_eur_per_kwh: number;
  assets: {
    pv_kwp: number;
    battery_kwh: number;
    battery_power_kw: number;
    heat_pump: boolean;
    heat_pump_kw: number;
    ev_charger: boolean;
    ev_battery_kwh: number;
  };
  contract_terms_text: string;
};

export type Tariff =
  | {
      tariff_id: "dynamic";
      name: string;
      type: "dynamic_hourly";
      description: string;
      spot_adder_eur_per_kwh: number;
      base_fee_eur_per_month: number;
      feed_in_eur_per_kwh: number;
      price_source: string;
    }
  | {
      tariff_id: "fixed";
      name: string;
      type: "fixed_rate";
      description: string;
      energy_rate_eur_per_kwh: number;
      base_fee_eur_per_month: number;
      feed_in_eur_per_kwh: number;
    };

export type MonthlyBill = {
  household_id: string;
  month: string; // "YYYY-MM"
  consumption_kwh: number;
  pv_production_kwh: number;
  grid_import_kwh: number;
  grid_export_kwh: number;
  energy_cost_eur: number;
  base_fee_eur: number;
  feed_in_credit_eur: number;
  total_bill_eur: number;
  self_sufficiency_pct: number;
};

export type InsightEvent = {
  household_id: string;
  type: "anomaly" | "nudge" | "insight";
  severity: "high" | "info" | string;
  period: string;
  title: string;
  detail: string;
  suggested_action: string;
};

export type SpotPrice = { timestamp: string; spot_price_eur_per_kwh: number };

export type TimeseriesRecord = {
  timestamp: string;
  outdoor_temp_c: number;
  pv_production_kw: number;
  house_load_kw: number;
  heatpump_kw: number;
  ev_charging_kw: number;
  total_consumption_kw: number;
  battery_charge_kw: number;
  battery_discharge_kw: number;
  battery_soc_kwh: number;
  battery_soc_pct: number;
  grid_import_kw: number;
  grid_export_kw: number;
  price_eur_per_kwh: number;
};

const HOUSEHOLDS = households as Household[];
const CONTRACTS = contracts as Contract[];
const TARIFFS = tariffs as Tariff[];
const MONTHLY_BILLS = monthlyBills as MonthlyBill[];
const INSIGHT_EVENTS = insightEvents as InsightEvent[];
const SPOT_PRICES = (dynamicPrices as { prices: SpotPrice[] }).prices;

const TIMESERIES_ASSETS: Record<string, { url: string }> = {
  "HH-1001": asset1001,
  "HH-1002": asset1002,
  "HH-1003": asset1003,
  "HH-1004": asset1004,
};

// ----- Simple references -----
export function listHouseholds() {
  return HOUSEHOLDS;
}

export function getHousehold(id: string): Household {
  const hh = HOUSEHOLDS.find((h) => h.household_id === id);
  if (!hh) throw new Error(`Unknown household: ${id}`);
  return hh;
}

export function getContractFor(id: string): Contract {
  const c = CONTRACTS.find((c) => c.household_id === id);
  if (!c) throw new Error(`No contract for household: ${id}`);
  return c;
}

export function getTariff(tariffId: string): Tariff {
  const t = TARIFFS.find((t) => t.tariff_id === tariffId);
  if (!t) throw new Error(`Unknown tariff: ${tariffId}`);
  return t;
}

export function getMonthlyBillsFor(id: string): MonthlyBill[] {
  return MONTHLY_BILLS.filter((b) => b.household_id === id);
}

export function getInsightsFor(id: string): InsightEvent[] {
  return INSIGHT_EVENTS.filter((i) => i.household_id === id);
}

export function getSpotPrices(): SpotPrice[] {
  return SPOT_PRICES;
}

// ----- Timeseries (lazy + cached) -----
const tsCache = new Map<string, Promise<TimeseriesRecord[]>>();

function buildAssetUrl(relative: string, origin: string) {
  return relative.startsWith("http") ? relative : `${origin}${relative}`;
}

export async function getTimeseries(
  householdId: string,
  origin: string,
): Promise<TimeseriesRecord[]> {
  const existing = tsCache.get(householdId);
  if (existing) return existing;
  const asset = TIMESERIES_ASSETS[householdId];
  if (!asset) throw new Error(`No timeseries asset for ${householdId}`);
  const url = buildAssetUrl(asset.url, origin);
  const promise = (async () => {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to load timeseries for ${householdId}: ${res.status}`);
    }
    const json = (await res.json()) as { records: TimeseriesRecord[] };
    return json.records;
  })();
  tsCache.set(householdId, promise);
  try {
    return await promise;
  } catch (err) {
    tsCache.delete(householdId);
    throw err;
  }
}
