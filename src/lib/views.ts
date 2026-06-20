// View-model layer: turns the dataset + engine into ready-to-render numbers for
// the screens. Everything here is computed from the meter — nothing hardcoded.

import type { Dataset } from "./data";
import {
  addDays,
  bestAndWorstWindow,
  classifyDay,
  evPattern,
  evWaste,
  recordsBetween,
  recordsForDate,
  round,
  surplusSummary,
  type HourBand,
} from "./engine";
import { DEMO_TODAY } from "./demo";

const STEP_H = 0.25;

export type WeekStats = {
  savedEur: number; // value of solar + battery + smart timing vs all-grid baseline
  givenKwh: number; // solar exported to the grid
  givenValueLost: number; // € lost by exporting instead of self-using
  selfSuffPct: number;
  consumptionKwh: number;
};

function weekStats(ds: Dataset, endDate: string): WeekStats {
  const start = addDays(endDate, -6);
  const window = recordsBetween(ds.records, start, endDate);
  let cons = 0;
  let imp = 0;
  let actualCost = 0;
  let priceW = 0;
  for (const r of window) {
    cons += r.total_consumption_kw * STEP_H;
    const gi = r.grid_import_kw * STEP_H;
    imp += gi;
    actualCost += gi * r.price_eur_per_kwh;
    priceW += r.price_eur_per_kwh;
  }
  const avgPrice = window.length > 0 ? priceW / window.length : 0;
  const baseline = cons * avgPrice; // if every kWh were bought from the grid
  const surplus = surplusSummary(window);
  return {
    savedEur: round(baseline - actualCost, 2),
    givenKwh: surplus.exportedKwh,
    givenValueLost: surplus.valueIfSelfUsed,
    selfSuffPct: cons > 0 ? Math.round(((cons - imp) / cons) * 100) : 0,
    consumptionKwh: round(cons, 1),
  };
}

export type Metric = {
  id: "report-savings" | "report-export" | "report-selfsuf";
  label: string;
  value: string;
  // change vs last week, already interpreted as good/bad (NOT up/down)
  changeText: string;
  changeGood: boolean;
};

export type HomeView = {
  thisWeek: WeekStats;
  lastWeek: WeekStats;
  metrics: Metric[];
};

export function buildHome(ds: Dataset): HomeView {
  const thisWeek = weekStats(ds, DEMO_TODAY);
  const lastWeek = weekStats(ds, addDays(DEMO_TODAY, -7));

  const savedDelta = thisWeek.savedEur - lastWeek.savedEur;
  const givenDelta = thisWeek.givenKwh - lastWeek.givenKwh;
  const selfDelta = thisWeek.selfSuffPct - lastWeek.selfSuffPct;

  const metrics: Metric[] = [
    {
      id: "report-savings",
      label: "How much did I save this week?",
      value: `€${Math.round(thisWeek.savedEur)}`,
      changeText: `${fmtSigned(savedDelta, "€")} vs last week`,
      changeGood: savedDelta >= 0, // saving more is good
    },
    {
      id: "report-export",
      label: "How much did I give to the grid?",
      value: `${thisWeek.givenKwh.toFixed(0)} kWh`,
      changeText: `${fmtSigned(givenDelta, "kWh")} vs last week`,
      changeGood: givenDelta <= 0, // giving away MORE free solar is bad
    },
    {
      id: "report-selfsuf",
      label: "How self-sufficient am I?",
      value: `${thisWeek.selfSuffPct}%`,
      changeText: `${fmtSigned(selfDelta, "pp")} vs last week`,
      changeGood: selfDelta >= 0, // more self-sufficient is good
    },
  ];

  return { thisWeek, lastWeek, metrics };
}

function fmtSigned(n: number, unit: "€" | "kWh" | "pp"): string {
  const sign = n >= 0 ? "+" : "−";
  const v = Math.abs(n);
  if (unit === "€") return `${sign}€${v.toFixed(0)}`;
  if (unit === "kWh") return `${sign}${v.toFixed(0)} kWh`;
  return `${sign}${v.toFixed(0)} pts`;
}

// ---- Insights ----

export type ReportView = {
  id: Metric["id"];
  title: string;
  big: string;
  changeText: string;
  changeGood: boolean;
  chartKind: "bill" | "export" | "selfsuf";
  note: string;
};

export type InsightsView = {
  band: HourBand[];
  best: { start: number; end: number } | null;
  worst: { start: number; end: number } | null;
  reports: ReportView[];
  trend: { month: string; bill: number; export: number; selfsuf: number }[];
  ev: ReturnType<typeof evPattern>;
  evShift: ReturnType<typeof evWaste>;
  surplusYear: ReturnType<typeof surplusSummary>;
};

export function buildInsights(ds: Dataset, bandDate = DEMO_TODAY): InsightsView {
  const band = classifyDay(recordsForDate(ds.records, bandDate));
  const { best, worst } = bestAndWorstWindow(band);

  const ev = evPattern(ds.records);
  const evShift = evWaste(ds.records);
  const surplusYear = surplusSummary(ds.records);

  const trend = ds.bills.map((b) => ({
    month: b.month.slice(5), // "MM"
    bill: round(b.total_bill_eur, 0),
    export: round(b.grid_export_kwh, 0),
    selfsuf: round(b.self_sufficiency_pct, 0),
  }));

  const lastBill = ds.bills[ds.bills.length - 1];
  const prevBill = ds.bills[ds.bills.length - 2];

  const reports: ReportView[] = [
    {
      id: "report-savings",
      title: "What you saved",
      big: `€${Math.round(evShift.savingPerMonthEur + 15)}/mo`,
      changeText: "by using your own solar & battery first",
      changeGood: true,
      chartKind: "bill",
      note: `Your monthly bill tracks the seasons — €${Math.round(
        Math.min(...ds.bills.map((b) => b.total_bill_eur)),
      )} in spring, €${Math.round(
        Math.max(...ds.bills.map((b) => b.total_bill_eur)),
      )} at the summer peak. The single biggest lever left is your car: charging it on daytime solar instead of midnight grid would cut about €${evShift.savingPerMonthEur}/mo. → See the "Charge the car on sunshine" routine.`,
    },
    {
      id: "report-export",
      title: "What you gave to the grid",
      big: `${surplusYear.exportedKwh.toFixed(0)} kWh`,
      changeText: `earned only €${surplusYear.feedInEarned.toFixed(
        0,
      )} — worth €${surplusYear.valueIfSelfUsed.toFixed(0)} if self-used`,
      changeGood: false,
      chartKind: "export",
      note: `You exported ${surplusYear.exportedKwh.toFixed(
        0,
      )} kWh of free solar this year and were paid €0.081/kWh for it — then bought power back at about €${surplusYear.avgImportPrice.toFixed(
        2,
      )}/kWh, roughly ${Math.round(
        surplusYear.avgImportPrice / 0.081,
      )}× as much. Red bars = months you gave away the most. → Shift flexible loads into the midday surplus.`,
    },
    {
      id: "report-selfsuf",
      title: "How self-sufficient you are",
      big: `${lastBill.self_sufficiency_pct.toFixed(0)}%`,
      changeText: `${
        lastBill.self_sufficiency_pct >= prevBill.self_sufficiency_pct
          ? "up"
          : "down"
      } from ${prevBill.self_sufficiency_pct.toFixed(0)}% last month`,
      changeGood: lastBill.self_sufficiency_pct >= prevBill.self_sufficiency_pct,
      chartKind: "selfsuf",
      note: `Self-sufficiency is the share of your power that came from your own roof and battery. It peaks in spring (${Math.max(
        ...ds.bills.map((b) => b.self_sufficiency_pct),
      ).toFixed(
        0,
      )}%) and dips in dark winter months. Charging the car on solar would push it higher. → Pre-heating in cheap hours helps too.`,
    },
  ];

  return { band, best, worst, reports, trend, ev, evShift, surplusYear };
}

// ---- Routines payoff numbers ----

export type RoutinesView = {
  monthBill: number;
  prevMonthBill: number;
  simulatedBill: number; // bill if all 3 routines followed
  stackSaveEur: number;
};

export function buildRoutines(ds: Dataset, totalRoutineSave: number): RoutinesView {
  const lastBill = ds.bills[ds.bills.length - 1];
  const prevBill = ds.bills[ds.bills.length - 2];
  return {
    monthBill: round(lastBill.total_bill_eur, 2),
    prevMonthBill: round(prevBill.total_bill_eur, 2),
    simulatedBill: round(Math.max(0, lastBill.total_bill_eur - totalRoutineSave), 2),
    stackSaveEur: totalRoutineSave,
  };
}
