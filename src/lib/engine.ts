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

// Per-hour aggregate used by the Insights daily band.
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
