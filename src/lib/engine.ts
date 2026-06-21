// engine.ts — pure functions over the 15-minute meter records.
//
// The core idea: rank energy use by a VALUE HIERARCHY, not by grid price alone.
//   1. solar surplus  — free power the panels are making right now
//   2. battery        — already-stored free power (no solar)
//   3. cheap grid     — dynamic price sitting in its daily low band
//   4. avoid          — evening peak, no solar, battery empty
//
// The insight a plain price-recommender MISSES: this household charges its EV at
// midnight from the grid (cheap on the price curve) while exporting free solar at
// midday and buying it back at ~3x. We surface that here, honestly: the EV's
// 11 kW draw outruns the 5 kW battery, so grid import happens even with a battery.

import type { TimeseriesRecord } from "../types";
import { FEED_IN } from "./demo";

const STEP_H = 0.25; // each record is a 15-minute interval

export type HourClass = "solar" | "battery" | "cheap" | "avoid";

export function dateKey(ts: string): string {
  return ts.slice(0, 10);
}
export function hourOf(ts: string): number {
  return Number(ts.slice(11, 13));
}

export function recordsForDate(
  records: TimeseriesRecord[],
  date: string,
): TimeseriesRecord[] {
  return records.filter((r) => dateKey(r.timestamp) === date);
}

export function recordsBetween(
  records: TimeseriesRecord[],
  startDate: string,
  endDate: string,
): TimeseriesRecord[] {
  return records.filter((r) => {
    const d = dateKey(r.timestamp);
    return d >= startDate && d <= endDate;
  });
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// classifyHour — the value hierarchy. `dayPrices` is the list of that day's
// per-step (or per-hour) retail prices, used to find the daily low band.
// ---------------------------------------------------------------------------

export function classifyHour(
  row: Pick<
    TimeseriesRecord,
    | "pv_production_kw"
    | "house_load_kw"
    | "total_consumption_kw"
    | "grid_export_kw"
    | "grid_import_kw"
    | "battery_soc_pct"
    | "battery_discharge_kw"
    | "price_eur_per_kwh"
  >,
  dayPrices: number[],
): HourClass {
  // 1. Solar surplus — panels making more than the house needs (or exporting).
  if (row.grid_export_kw > 0.05 || row.pv_production_kw > row.house_load_kw) {
    return "solar";
  }
  // 2. Battery — stored free power covering the load, with little/no grid pull.
  if (
    row.battery_soc_pct > 12 &&
    row.battery_discharge_kw > 0.1 &&
    row.grid_import_kw < 0.5
  ) {
    return "battery";
  }
  // 3. Cheap grid — price sitting in the bottom quarter of today's range.
  const min = Math.min(...dayPrices);
  const max = Math.max(...dayPrices);
  const lowBand = min + 0.25 * (max - min);
  if (row.price_eur_per_kwh <= lowBand) {
    return "cheap";
  }
  // 4. Otherwise avoid — evening peak, no solar, battery empty.
  return "avoid";
}

// Per-hour aggregate used by the Consumption sample-day band.
export type HourBand = {
  hour: number;
  cls: HourClass;
  price_eur_per_kwh: number;
  pv_kwh: number;
  consumption_kwh: number;
};

export function classifyDay(records: TimeseriesRecord[]): HourBand[] {
  const dayPrices = records.map((r) => r.price_eur_per_kwh);
  const byHour = new Map<number, TimeseriesRecord[]>();
  for (const r of records) {
    const h = hourOf(r.timestamp);
    (byHour.get(h) ?? byHour.set(h, []).get(h)!).push(r);
  }
  const out: HourBand[] = [];
  for (let h = 0; h < 24; h++) {
    const rows = byHour.get(h);
    if (!rows || rows.length === 0) continue;
    // Representative row = the hour's mid-point; sums for energy.
    const rep = rows[Math.floor(rows.length / 2)];
    const pv = rows.reduce((s, r) => s + r.pv_production_kw * STEP_H, 0);
    const cons = rows.reduce((s, r) => s + r.total_consumption_kw * STEP_H, 0);
    // Aggregate the hour's flows so classify sees the whole hour, not one step.
    const agg = {
      pv_production_kw: avg(rows, "pv_production_kw"),
      house_load_kw: avg(rows, "house_load_kw"),
      total_consumption_kw: avg(rows, "total_consumption_kw"),
      grid_export_kw: avg(rows, "grid_export_kw"),
      grid_import_kw: avg(rows, "grid_import_kw"),
      battery_soc_pct: rep.battery_soc_pct,
      battery_discharge_kw: avg(rows, "battery_discharge_kw"),
      price_eur_per_kwh: rep.price_eur_per_kwh,
    };
    out.push({
      hour: h,
      cls: classifyHour(agg, dayPrices),
      price_eur_per_kwh: rep.price_eur_per_kwh,
      pv_kwh: round(pv, 2),
      consumption_kwh: round(cons, 2),
    });
  }
  return out;
}

function avg(rows: TimeseriesRecord[], key: keyof TimeseriesRecord): number {
  return rows.reduce((s, r) => s + (r[key] as number), 0) / rows.length;
}

// Best contiguous window of `solar` hours, and the worst run of `avoid` hours.
export function bestAndWorstWindow(band: HourBand[]): {
  best: { start: number; end: number } | null;
  worst: { start: number; end: number } | null;
} {
  return {
    best: longestRun(band, "solar"),
    worst: longestRun(band, "avoid"),
  };
}

function longestRun(band: HourBand[], cls: HourClass) {
  let best: { start: number; end: number } | null = null;
  let runStart = -1;
  for (let i = 0; i <= band.length; i++) {
    const match = i < band.length && band[i].cls === cls;
    if (match && runStart === -1) runStart = band[i].hour;
    if (!match && runStart !== -1) {
      const end = band[i - 1].hour + 1;
      if (!best || end - runStart > best.end - best.start)
        best = { start: runStart, end };
      runStart = -1;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// surplusSummary — how much free solar was given to the grid, and what that
// energy would have been worth if the home had used it instead of exporting.
// ---------------------------------------------------------------------------

export type SurplusSummary = {
  exportedKwh: number;
  avgImportPrice: number;
  valueIfSelfUsed: number; // €: avoided import minus the small feed-in forgone
  feedInEarned: number; // € actually earned for exporting it
};

export function surplusSummary(window: TimeseriesRecord[]): SurplusSummary {
  let exportedKwh = 0;
  let importKwh = 0;
  let importPriceW = 0;
  for (const r of window) {
    exportedKwh += r.grid_export_kw * STEP_H;
    const gi = r.grid_import_kw * STEP_H;
    importKwh += gi;
    importPriceW += gi * r.price_eur_per_kwh;
  }
  const avgImportPrice = importKwh > 0 ? importPriceW / importKwh : 0;
  return {
    exportedKwh: round(exportedKwh, 1),
    avgImportPrice: round(avgImportPrice, 3),
    valueIfSelfUsed: round(exportedKwh * (avgImportPrice - FEED_IN), 2),
    feedInEarned: round(exportedKwh * FEED_IN, 2),
  };
}

// ---------------------------------------------------------------------------
// evPattern — when the car charges, how much, and how much of it came from the
// grid versus solar/battery.
// ---------------------------------------------------------------------------

export type EvPattern = {
  totalKwh: number;
  fromGridKwh: number;
  fromSolarKwh: number;
  pctFromSolar: number;
  typicalStartHour: number;
};

export function evPattern(window: TimeseriesRecord[]): EvPattern {
  let total = 0;
  let fromGrid = 0;
  const startHourCount = new Map<number, number>();
  let seenDay = "";
  for (const r of window) {
    const ev = r.ev_charging_kw * STEP_H;
    total += ev;
    // Share of this step's grid import attributable to the EV.
    const evShare =
      r.total_consumption_kw > 0
        ? r.ev_charging_kw / r.total_consumption_kw
        : 0;
    fromGrid += r.grid_import_kw * STEP_H * evShare;

    const d = dateKey(r.timestamp);
    if (r.ev_charging_kw > 1 && d !== seenDay) {
      const h = hourOf(r.timestamp);
      startHourCount.set(h, (startHourCount.get(h) ?? 0) + 1);
      seenDay = d;
    }
  }
  const fromSolar = Math.max(0, total - fromGrid);
  let typicalStartHour = 0;
  let bestCount = -1;
  for (const [h, c] of startHourCount) {
    if (c > bestCount) {
      bestCount = c;
      typicalStartHour = h;
    }
  }
  return {
    totalKwh: round(total, 1),
    fromGridKwh: round(fromGrid, 1),
    fromSolarKwh: round(fromSolar, 1),
    pctFromSolar: total > 0 ? Math.round((fromSolar / total) * 100) : 0,
    typicalStartHour,
  };
}

// ---------------------------------------------------------------------------
// simulateShift — model moving a flexible load out of one window and into a
// better one. Returns € saved per year and the share of days the shift was
// physically possible (car home + solar surplus available).
// ---------------------------------------------------------------------------

export type ShiftResult = {
  savingEur: number; // € over the window (typically a full year)
  savingPerMonthEur: number;
  shiftedKwh: number;
  coverablePct: number; // share of days the shift was physically possible
  days: number;
  daysCoverable: number;
};

// Generic shift: move energy that was bought from the grid during `fromHours`
// onto same-day solar surplus that was exported during `toHours`.
export function simulateShift(
  window: TimeseriesRecord[],
  opts: {
    load: "ev_charging_kw" | "heatpump_kw" | "house_load_kw";
    fromHours: [number, number]; // [start, end) where the load runs today
    toHours: [number, number]; // [start, end) cheap/solar window to move it to
  },
): ShiftResult {
  const { load, fromHours, toHours } = opts;
  type Day = { gridLoad: number; surplus: number; priceW: number; priceKwh: number };
  const byDay = new Map<string, Day>();

  const inFrom = (h: number) => h >= fromHours[0] && h < fromHours[1];
  const inTo = (h: number) => h >= toHours[0] && h < toHours[1];

  for (const r of window) {
    const d = dateKey(r.timestamp);
    const h = hourOf(r.timestamp);
    const day =
      byDay.get(d) ??
      byDay.set(d, { gridLoad: 0, surplus: 0, priceW: 0, priceKwh: 0 }).get(d)!;

    // Grid energy spent on this load during the "from" window.
    if (inFrom(h) && r[load] > 0.1) {
      const evShare =
        r.total_consumption_kw > 0 ? r[load] / r.total_consumption_kw : 0;
      const gridLoad = r.grid_import_kw * STEP_H * evShare;
      day.gridLoad += gridLoad;
      day.priceW += gridLoad * r.price_eur_per_kwh;
      day.priceKwh += gridLoad;
    }
    // Exported solar surplus available during the "to" window.
    if (inTo(h)) {
      day.surplus += r.grid_export_kw * STEP_H;
    }
  }

  let days = 0;
  let daysCoverable = 0;
  let shiftedKwh = 0;
  let savingEur = 0;
  for (const day of byDay.values()) {
    days++;
    const coverable = Math.min(day.gridLoad, day.surplus);
    if (coverable > 0.5 && day.gridLoad > 0.5) daysCoverable++;
    shiftedKwh += coverable;
    const price = day.priceKwh > 0 ? day.priceW / day.priceKwh : 0;
    savingEur += coverable * (price - FEED_IN);
  }

  return {
    savingEur: round(savingEur, 0),
    savingPerMonthEur: round(savingEur / 12, 0),
    shiftedKwh: round(shiftedKwh, 0),
    coverablePct: days > 0 ? Math.round((daysCoverable / days) * 100) : 0,
    days,
    daysCoverable,
  };
}

// The headline EV-waste simulation: midnight grid charging -> midday solar.
export function evWaste(window: TimeseriesRecord[]): ShiftResult {
  return simulateShift(window, {
    load: "ev_charging_kw",
    fromHours: [0, 6], // overnight grid charging
    toHours: [9, 16], // midday solar surplus
  });
}

export function round(n: number, d = 0): number {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

// ---------------------------------------------------------------------------
// Recommendations — ranked by money impact (€ first, CO₂ second).
//
// Every recommendation's numbers are COMPUTED from the meter, never hardcoded,
// so personalization falls out automatically: a fixed-tariff home has no
// time-of-day grid savings, so its ranking is driven by solar self-consumption
// alone — no special-casing required.
// ---------------------------------------------------------------------------

// CO₂ intensity of the German grid mix, ~0.38 kg CO₂e per kWh (UBA, 2023).
// Self-consuming a kWh of your own solar avoids importing one grid kWh.
export const CO2_KG_PER_KWH = 0.38;
// Petrol car ~0.12 kg CO₂ per km — used to express avoided CO₂ as "km not driven".
export const CO2_KG_PER_KM = 0.12;
// Actions worth less than this per day are "minor" and rolled away so the
// screen leads with what matters.
export const MINOR_EUR_PER_DAY = 0.2;

export type ActionId =
  | "ev_solar_charge"
  | "preheat_cheap_window"
  | "appliances_midday";

export type ActionDef = {
  id: ActionId;
  icon: "ev" | "preheat" | "appliances";
  title: string;
  sentence: string;
  load: "ev_charging_kw" | "heatpump_kw" | "house_load_kw";
  fromHours: [number, number]; // when the load runs on grid today
  toHours: [number, number]; // cheap/solar window to move it into
};

export const ACTION_DEFS: ActionDef[] = [
  {
    id: "ev_solar_charge",
    icon: "ev",
    title: "Charge the car on solar",
    sentence:
      "Start charging around midday instead of overnight, so the car runs on your own sunshine.",
    load: "ev_charging_kw",
    fromHours: [0, 6],
    toHours: [11, 15],
  },
  {
    id: "preheat_cheap_window",
    icon: "preheat",
    title: "Pre-heat in the sunny window",
    sentence:
      "Let the heat pump warm the house at midday instead of the expensive evening peak.",
    load: "heatpump_kw",
    fromHours: [17, 21],
    toHours: [11, 16],
  },
  {
    id: "appliances_midday",
    icon: "appliances",
    title: "Run appliances at midday",
    sentence:
      "Set the dishwasher and laundry to run while your panels are making free power.",
    load: "house_load_kw",
    fromHours: [18, 22],
    toHours: [11, 15],
  },
];

function inHours(h: number, [a, b]: [number, number]) {
  return h >= a && h < b;
}

// Average energy (kWh) this load uses during `fromHours` on a typical day across
// the whole history. The `from` windows are night/evening with little or no sun,
// so this energy effectively comes from the grid (or battery) — it's exactly the
// chunk a shift onto midday solar would cover. Using the typical day (not whether
// the load happened to run on one date) keeps today's estimate stable.
function typicalDailyShiftable(records: TimeseriesRecord[], def: ActionDef): number {
  let load = 0;
  const days = new Set<string>();
  for (const r of records) {
    days.add(dateKey(r.timestamp));
    if (inHours(hourOf(r.timestamp), def.fromHours)) load += r[def.load] * STEP_H;
  }
  return days.size > 0 ? load / days.size : 0;
}

// Solar surplus (exported kWh) available to absorb a shifted load during `hours`.
function windowSurplus(window: TimeseriesRecord[], hours: [number, number]): number {
  let s = 0;
  for (const r of window) {
    if (inHours(hourOf(r.timestamp), hours)) s += r.grid_export_kw * STEP_H;
  }
  return s;
}

// Average retail price during `hours` — the per-kWh price a shift would avoid.
function windowAvgPrice(window: TimeseriesRecord[], hours: [number, number]): number {
  let sum = 0;
  let n = 0;
  for (const r of window) {
    if (inHours(hourOf(r.timestamp), hours)) {
      sum += r.price_eur_per_kwh;
      n++;
    }
  }
  if (n > 0) return sum / n;
  // fall back to the whole day's average price
  const all = window.reduce((a, r) => a + r.price_eur_per_kwh, 0);
  return window.length > 0 ? all / window.length : 0;
}

// Today's opportunity for an action: shift the load's typical grid usage onto
// the solar surplus actually available today. € per shifted kWh = the grid price
// you'd avoid minus the feed-in you'd forgo (≈ price − 0.081).
function todayOpportunity(
  records: TimeseriesRecord[],
  today: TimeseriesRecord[],
  def: ActionDef,
): { eur: number; kwh: number } {
  const typical = typicalDailyShiftable(records, def);
  const surplus = windowSurplus(today, def.toHours);
  const coverable = Math.min(typical, surplus);
  const price = windowAvgPrice(today, def.fromHours);
  return { kwh: coverable, eur: Math.max(0, coverable * (price - FEED_IN)) };
}

// Money already captured for an action: load that ran in its solar/cheap window
// covered by your own solar (not the grid), valued at price − feed-in.
function realized(
  window: TimeseriesRecord[],
  def: ActionDef,
): { eur: number; kwh: number } {
  let eur = 0;
  let kwh = 0;
  for (const r of window) {
    const h = hourOf(r.timestamp);
    if (h < def.toHours[0] || h >= def.toHours[1]) continue;
    const loadKwh = r[def.load] * STEP_H;
    if (loadKwh <= 0) continue;
    const gridShare =
      r.total_consumption_kw > 0 ? r.grid_import_kw / r.total_consumption_kw : 0;
    const solarLoadKwh = loadKwh * Math.max(0, 1 - gridShare);
    kwh += solarLoadKwh;
    eur += solarLoadKwh * (r.price_eur_per_kwh - FEED_IN);
  }
  return { eur, kwh };
}

function monthStart(date: string): string {
  return date.slice(0, 8) + "01";
}

export type Recommendation = {
  id: ActionId;
  icon: ActionDef["icon"];
  title: string;
  sentence: string;
  todaySaveEur: number;
  todayCo2Kg: number;
  monthlyPotentialEur: number;
  monthlyPotentialCo2Kg: number;
  minor: boolean; // worth < MINOR_EUR_PER_DAY today
};

// Ranked recommendations (€ desc). The Recommendations screen and Home reminders both
// read this list, so they stay consistent.
export function rankRecommendations(
  records: TimeseriesRecord[],
  date: string,
): Recommendation[] {
  const today = recordsForDate(records, date);
  const DAYS_PER_MONTH = 30;
  const recs: Recommendation[] = ACTION_DEFS.map((def) => {
    const t = todayOpportunity(records, today, def);
    return {
      id: def.id,
      icon: def.icon,
      title: def.title,
      sentence: def.sentence,
      todaySaveEur: round(t.eur, 2),
      todayCo2Kg: round(t.kwh * CO2_KG_PER_KWH, 1),
      monthlyPotentialEur: round(t.eur * DAYS_PER_MONTH, 2),
      monthlyPotentialCo2Kg: round(t.kwh * DAYS_PER_MONTH * CO2_KG_PER_KWH, 1),
      minor: t.eur < MINOR_EUR_PER_DAY,
    };
  });
  return recs.sort((a, b) => b.todaySaveEur - a.todaySaveEur);
}

// Real running total captured this month so far for the recommended actions —
// the "saved this month" hero figure. Computed, never hardcoded.
export function savedThisMonth(
  records: TimeseriesRecord[],
  date: string,
): { eur: number; kwh: number; co2Kg: number } {
  const window = recordsBetween(records, monthStart(date), date);
  let eur = 0;
  let kwh = 0;
  for (const def of ACTION_DEFS) {
    const r = realized(window, def);
    eur += r.eur;
    kwh += r.kwh;
  }
  return { eur: round(eur, 2), kwh: round(kwh, 1), co2Kg: round(kwh * CO2_KG_PER_KWH, 1) };
}

export function kmNotDriven(co2Kg: number): number {
  return co2Kg / CO2_KG_PER_KM;
}
