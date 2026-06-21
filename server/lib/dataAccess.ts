import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  Household,
  Tariff,
  SpotPrice,
  MonthlyBill,
  InsightEvent,
  TimeseriesRecord,
} from '../../src/types.ts';

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
  energy_pricing: {
    model: string;
    spot_adder_eur_per_kwh?: number;
    energy_rate_eur_per_kwh?: number;
  };
  feed_in_eur_per_kwh: number;
  assets: {
    pv_kwp: number;
    battery_kwh: number;
    battery_power_kw: number;
    heat_pump: boolean;
    heat_pump_kw?: number;
    ev_charger: boolean;
    ev_battery_kwh?: number;
  };
  contract_terms_text: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const dataDir = () => join(process.cwd(), 'public', 'data');

function loadJson<T>(filename: string): T {
  const raw = readFileSync(join(dataDir(), filename), 'utf-8');
  return JSON.parse(raw) as T;
}

// ---------------------------------------------------------------------------
// Lazy caches (module-level singletons)
// ---------------------------------------------------------------------------

let _households: Household[] | null = null;
let _contracts: Contract[] | null = null;
let _tariffs: Tariff[] | null = null;
let _spotPrices: SpotPrice[] | null = null;
let _monthlyBills: MonthlyBill[] | null = null;
let _insightEvents: InsightEvent[] | null = null;
const _timeseriesCache = new Map<string, TimeseriesRecord[]>();

// ---------------------------------------------------------------------------
// Households
// ---------------------------------------------------------------------------

export function getHouseholds(): Household[] {
  if (!_households) _households = loadJson<Household[]>('households.json');
  return _households;
}

export function getHousehold(id: string): Household | undefined {
  return getHouseholds().find((h) => h.household_id === id);
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

export function getContracts(): Contract[] {
  if (!_contracts) _contracts = loadJson<Contract[]>('contracts.json');
  return _contracts;
}

export function getContract(id: string): Contract | undefined {
  return getContracts().find((c) => c.household_id === id);
}

// ---------------------------------------------------------------------------
// Tariffs
// ---------------------------------------------------------------------------

export function getTariffs(): Tariff[] {
  if (!_tariffs) _tariffs = loadJson<Tariff[]>('tariffs.json');
  return _tariffs;
}

export function getTariff(id: string): Tariff | undefined {
  return getTariffs().find((t) => t.tariff_id === id);
}

// ---------------------------------------------------------------------------
// Spot Prices (dynamic_prices.json has { prices: SpotPrice[] } wrapper)
// ---------------------------------------------------------------------------

export function getSpotPrices(): SpotPrice[] {
  if (!_spotPrices) {
    const wrapper = loadJson<{ prices: SpotPrice[] }>('dynamic_prices.json');
    _spotPrices = wrapper.prices;
  }
  return _spotPrices;
}

export function getPricesForTimeRange(start: string, end: string): SpotPrice[] {
  const startTs = new Date(start).getTime();
  const endTs = new Date(end).getTime();
  return getSpotPrices().filter((p) => {
    const ts = new Date(p.timestamp).getTime();
    return ts >= startTs && ts <= endTs;
  });
}

// ---------------------------------------------------------------------------
// Monthly Bills
// ---------------------------------------------------------------------------

export function getMonthlyBills(householdId: string): MonthlyBill[] {
  if (!_monthlyBills) _monthlyBills = loadJson<MonthlyBill[]>('monthly_bills.json');
  return _monthlyBills.filter((b) => b.household_id === householdId);
}

// ---------------------------------------------------------------------------
// Insight Events
// ---------------------------------------------------------------------------

export function getInsightEvents(householdId: string): InsightEvent[] {
  if (!_insightEvents) _insightEvents = loadJson<InsightEvent[]>('insight_events.json');
  return _insightEvents.filter((e) => e.household_id === householdId);
}

// ---------------------------------------------------------------------------
// Timeseries (per-household file, cached by household ID)
// ---------------------------------------------------------------------------

export function getTimeseries(householdId: string): TimeseriesRecord[] {
  if (!_timeseriesCache.has(householdId)) {
    const filename = `energy_timeseries_${householdId}.json`;
    const wrapper = loadJson<{ records: TimeseriesRecord[] }>(filename);
    _timeseriesCache.set(householdId, wrapper.records);
  }
  return _timeseriesCache.get(householdId)!;
}

export function getRecordsForTimeRange(
  householdId: string,
  start: string,
  end: string,
): TimeseriesRecord[] {
  const startTs = new Date(start).getTime();
  const endTs = new Date(end).getTime();
  return getTimeseries(householdId).filter((r) => {
    const ts = new Date(r.timestamp).getTime();
    return ts >= startTs && ts <= endTs;
  });
}
