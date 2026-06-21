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
import { HOUSEHOLD_ID } from "./demo";

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
  insights: InsightEvent[];
  spotPrices: SpotPrice[];
  records: TimeseriesRecord[];
};

let cache: Promise<Dataset> | null = null;

export function loadDataset(): Promise<Dataset> {
  if (cache) return cache;
  cache = (async () => {
    const [households, contracts, tariffs, billsAll, insightsAll, prices, ts] =
      await Promise.all([
        getJson<Household[]>("households.json"),
        getJson<Contract[]>("contracts.json"),
        getJson<Tariff[]>("tariffs.json"),
        getJson<MonthlyBill[]>("monthly_bills.json"),
        getJson<InsightEvent[]>("insight_events.json"),
        getJson<{ prices: SpotPrice[] }>("dynamic_prices.json"),
        getJson<{ records: TimeseriesRecord[] }>(
          `energy_timeseries_${HOUSEHOLD_ID}.json`,
        ),
      ]);

    const household = households.find((h) => h.household_id === HOUSEHOLD_ID);
    if (!household) throw new Error(`Unknown household ${HOUSEHOLD_ID}`);
    const contract = contracts.find((c) => c.household_id === HOUSEHOLD_ID);
    if (!contract) throw new Error(`Unknown contract for ${HOUSEHOLD_ID}`);
    const tariff = tariffs.find((t) => t.tariff_id === household.tariff_id);
    if (!tariff) throw new Error(`Unknown tariff ${household.tariff_id}`);

    return {
      household,
      contract,
      tariff,
      bills: billsAll.filter((b) => b.household_id === HOUSEHOLD_ID),
      insights: insightsAll.filter((i) => i.household_id === HOUSEHOLD_ID),
      spotPrices: prices.prices,
      records: ts.records,
    };
  })();
  return cache;
}
