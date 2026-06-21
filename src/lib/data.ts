// Client-side data loaders. No backend in v1 — we read the JSON files in
// /public/data directly. Small reference files load eagerly; the large 15-min
// timeseries (~19 MB) is fetched once and cached in-memory.

import type {
  Contract,
  Household,
  InsightEvent,
  MonthlyBill,
  SpotPrice,
  Tariff,
  TimeseriesRecord,
} from "../types";

const BASE = `${import.meta.env.BASE_URL}data`;

async function getJson<T>(file: string): Promise<T> {
  const res = await fetch(`${BASE}/${file}`);
  if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status}`);
  return (await res.json()) as T;
}

export type Dataset = {
  household: Household;
  contract: Contract;
  tariff: Tariff;
  bills: MonthlyBill[];
  events: InsightEvent[];
  spotPrices: SpotPrice[];
  records: TimeseriesRecord[];
};

const cache = new Map<string, Promise<Dataset>>();

export function loadDataset(householdId: string): Promise<Dataset> {
  const normalizedId = householdId.trim().toUpperCase();
  const cached = cache.get(normalizedId);
  if (cached) return cached;

  const request = (async () => {
    const [households, contracts, tariffs, billsAll, eventsAll, prices] =
      await Promise.all([
        getJson<Household[]>("households.json"),
        getJson<Contract[]>("contracts.json"),
        getJson<Tariff[]>("tariffs.json"),
        getJson<MonthlyBill[]>("monthly_bills.json"),
        getJson<InsightEvent[]>("insight_events.json"),
        getJson<{ prices: SpotPrice[] }>("dynamic_prices.json"),
      ]);

    const household = households.find((h) => h.household_id === normalizedId);
    if (!household) throw new Error(`Unknown household ${normalizedId}`);
    const tariff = tariffs.find((t) => t.tariff_id === household.tariff_id);
    if (!tariff) throw new Error(`Unknown tariff ${household.tariff_id}`);

    const contract = contracts.find((c) => c.household_id === normalizedId);
    if (!contract) throw new Error(`Unknown contract for ${normalizedId}`);
    const ts = await getJson<{ records: TimeseriesRecord[] }>(household.timeseries_file);

    return {
      household,
      contract,
      tariff,
      bills: billsAll.filter((b) => b.household_id === normalizedId),
      events: eventsAll.filter((i) => i.household_id === normalizedId),
      spotPrices: prices.prices,
      records: ts.records,
    };
  })();
  cache.set(normalizedId, request);
  return request;
}
