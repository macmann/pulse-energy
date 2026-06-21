// View-model layer: turns the dataset + engine into ready-to-render numbers for
// the screens. Everything here is computed from the meter — nothing hardcoded.

import type { Dataset } from "./data";
import {
  addDays,
  bestAndWorstWindow,
  classifyDay,
  evPattern,
  evWaste,
  kmNotDriven,
  rankRecommendations,
  recordsBetween,
  recordsForDate,
  round,
  savedThisMonth,
  surplusSummary,
  type HourBand,
  type Recommendation,
} from "./engine";
import { DEMO_TODAY } from "./demo";
import { eur } from "./format";
import {
  getDashboardInsightCards,
  getTimeseriesSummary,
} from "./dashboardMetrics";

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
  // The arrow shows the DIRECTION the metric moved; the color (changeGood)
  // encodes whether that move is good or bad — direction and meaning are separate.
  changeText: string;
  changeUp: boolean;
  changeGood: boolean;
};

export type HomeView = {
  thisWeek: WeekStats;
  lastWeek: WeekStats;
  metrics: Metric[];
  reminders: Recommendation[]; // top items from the same ranked list as Goals
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
      label: "Money saved",
      value: eur(thisWeek.savedEur), // €X.XX
      changeText: `${eur(Math.abs(savedDelta))} vs last week`,
      changeUp: savedDelta >= 0,
      changeGood: savedDelta >= 0, // saving more is good
    },
    {
      id: "report-export",
      label: "Energy sent to grid",
      value: `${thisWeek.givenKwh.toFixed(1)} kWh`, // kWh 1 decimal
      changeText: `${Math.abs(givenDelta).toFixed(1)} kWh ${
        givenDelta >= 0 ? "more" : "less"
      }`,
      changeUp: givenDelta >= 0,
      changeGood: givenDelta <= 0, // giving away MORE free solar is bad
    },
    {
      id: "report-selfsuf",
      label: "Self-sufficiency",
      value: `${thisWeek.selfSuffPct}%`, // % integer
      changeText: `${Math.abs(selfDelta)} pts vs last week`,
      changeUp: selfDelta >= 0,
      changeGood: selfDelta >= 0, // more self-sufficient is good
    },
  ];

  // Home reminders are the top 1–2 non-minor items from the same ranked list the
  // Goals screen uses, so the two screens always agree.
  const reminders = rankRecommendations(ds.records, DEMO_TODAY)
    .filter((r) => !r.minor)
    .slice(0, 2);

  return { thisWeek, lastWeek, metrics, reminders };
}

// ---- Energy Profile ----

export type ProfileStat = {
  label: string;
  value: string;
  detail?: string;
};

export type AnnualTotals = {
  consumptionKwh: number;
  pvProductionKwh: number;
  gridImportKwh: number;
  gridExportKwh: number;
  billTotalEur: number;
  energyCostEur: number;
  baseFeesEur: number;
  feedInCreditEur: number;
  avgImportPriceEurPerKwh: number;
  selfSufficiencyPct: number;
  solarSelfUseKwh: number;
  solarSelfUsePct: number;
  batteryChargeKwh: number;
  batteryDischargeKwh: number;
};

export type EnergyFlow = {
  ownSupplyKwh: number;
  gridSupplyKwh: number;
  selfUsedSolarKwh: number;
  exportedSolarKwh: number;
  feedInEarnedEur: number;
  exportOpportunityEur: number;
  importToExportPriceRatio: number;
};

export type MonthlyTrendPoint = {
  month: string;
  bill: number;
  consumption: number;
  pv: number;
  import: number;
  export: number;
  selfsuf: number;
  ev: number;
  heatpump: number;
};

export type HourlyTariffPoint = {
  hour: number;
  avgRetailPrice: number;
  gridImportKwh: number;
  importCostEur: number;
  consumptionKwh: number;
};

export type TariffFit = {
  type: "dynamic" | "fixed";
  tariffName: string;
  formula: string;
  avgRetailPrice: number;
  avgImportPaid: number;
  cheapestHours: HourlyTariffPoint[];
  expensiveHours: HourlyTariffPoint[];
  highestImportHours: HourlyTariffPoint[];
  importInCheapestPct: number;
  importInExpensivePct: number;
  hourly: HourlyTariffPoint[];
};

export type LoadBreakdownItem = {
  id: "household" | "heatpump" | "ev";
  label: string;
  kwh: number;
  sharePct: number;
  detail: string;
};

export type EnergyProfileView = {
  overview: {
    householdName: string;
    city: string;
    tariffName: string;
    dataPeriod: string;
    contractPeriod: string;
    assets: string[];
    note: string;
  };
  stats: ProfileStat[];
  annualTotals: AnnualTotals;
  energyFlow: EnergyFlow;
  monthlyTrend: MonthlyTrendPoint[];
  tariffFit: TariffFit;
  loadBreakdown: LoadBreakdownItem[];
  sampleDay: {
    date: string;
    band: HourBand[];
    best: { start: number; end: number } | null;
    worst: { start: number; end: number } | null;
  };
  ev: ReturnType<typeof evPattern>;
  evShift: ReturnType<typeof evWaste>;
  surplusYear: ReturnType<typeof surplusSummary>;
};

type MonthlyLoad = {
  ev: number;
  heatpump: number;
};

export function buildEnergyProfile(
  ds: Dataset,
  bandDate = DEMO_TODAY,
): EnergyProfileView {
  const band = classifyDay(recordsForDate(ds.records, bandDate));
  const { best, worst } = bestAndWorstWindow(band);

  const ev = evPattern(ds.records);
  const evShift = evWaste(ds.records);
  const surplusYear = surplusSummary(ds.records);
  const dashboardCards = getDashboardInsightCards({
    monthlyBills: ds.bills,
    contract: ds.tariff,
    timeseriesSummary: getTimeseriesSummary(ds.records),
  });

  const trend = ds.bills.map((b) => ({
    month: b.month.slice(5), // "MM"
    bill: round(b.total_bill_eur, 0),
    export: round(b.grid_export_kwh, 0),
    selfsuf: round(b.self_sufficiency_pct, 0),
  }));

  const reports: ReportView[] = [
    {
      id: "report-savings",
      title: dashboardCards.billOpportunity.title,
      big: dashboardCards.billOpportunity.big,
      changeText: dashboardCards.billOpportunity.changeText,
      changeGood: true,
      chartKind: "bill",
      note: dashboardCards.billOpportunity.note,
    },
    {
      id: "report-export",
      title: dashboardCards.export.title,
      big: dashboardCards.export.big,
      changeText: dashboardCards.export.changeText,
      changeGood: false,
      chartKind: "export",
      note: dashboardCards.export.note,
    },
    {
      id: "report-selfsuf",
      title: dashboardCards.selfSufficiency.title,
      big: dashboardCards.selfSufficiency.big,
      changeText: dashboardCards.selfSufficiency.changeText,
      changeGood:
        (dashboardCards.selfSufficiency.latestPct ?? 0) >=
        (dashboardCards.selfSufficiency.previousPct ?? 0),
      chartKind: "selfsuf",
      note: dashboardCards.selfSufficiency.note,
    },
  ];

  return {
    overview: {
      householdName: ds.household.name,
      city: ds.household.city,
      tariffName: ds.contract.tariff_name,
      dataPeriod: dataPeriod(ds),
      contractPeriod: `${ds.contract.contract_start} to ${ds.contract.contract_end}`,
      assets: [
        `${ds.contract.assets.pv_kwp} kWp PV`,
        `${ds.contract.assets.battery_kwh} kWh battery`,
        ds.contract.assets.heat_pump
          ? `${ds.contract.assets.heat_pump_kw} kW heat pump`
          : "no heat pump",
        ds.contract.assets.ev_charger
          ? `${ds.contract.assets.ev_battery_kwh} kWh EV`
          : "no EV charger",
      ],
      note: "Synthetic 2025 hackathon data, summarized from bills, contract, dynamic prices and 15-minute meter records.",
    },
    stats,
    annualTotals,
    energyFlow,
    monthlyTrend,
    tariffFit,
    loadBreakdown,
    sampleDay: { date: bandDate, band, best, worst },
    ev,
    evShift,
    surplusYear,
  };
}

function buildAnnualTotals(ds: Dataset): AnnualTotals {
  let consumptionKwh = 0;
  let pvProductionKwh = 0;
  let gridImportKwh = 0;
  let gridExportKwh = 0;
  let importCostEur = 0;
  let batteryChargeKwh = 0;
  let batteryDischargeKwh = 0;

  for (const r of ds.records) {
    consumptionKwh += r.total_consumption_kw * STEP_H;
    pvProductionKwh += r.pv_production_kw * STEP_H;
    const importKwh = r.grid_import_kw * STEP_H;
    gridImportKwh += importKwh;
    gridExportKwh += r.grid_export_kw * STEP_H;
    importCostEur += importKwh * r.price_eur_per_kwh;
    batteryChargeKwh += r.battery_charge_kw * STEP_H;
    batteryDischargeKwh += r.battery_discharge_kw * STEP_H;
  }

  const billTotalEur = ds.bills.reduce((s, b) => s + b.total_bill_eur, 0);
  const energyCostEur = ds.bills.reduce((s, b) => s + b.energy_cost_eur, 0);
  const baseFeesEur = ds.bills.reduce((s, b) => s + b.base_fee_eur, 0);
  const feedInCreditEur = ds.bills.reduce((s, b) => s + b.feed_in_credit_eur, 0);
  const solarSelfUseKwh = Math.max(0, pvProductionKwh - gridExportKwh);

  return {
    consumptionKwh: round(consumptionKwh, 1),
    pvProductionKwh: round(pvProductionKwh, 1),
    gridImportKwh: round(gridImportKwh, 1),
    gridExportKwh: round(gridExportKwh, 1),
    billTotalEur: round(billTotalEur, 2),
    energyCostEur: round(energyCostEur, 2),
    baseFeesEur: round(baseFeesEur, 2),
    feedInCreditEur: round(feedInCreditEur, 2),
    avgImportPriceEurPerKwh: gridImportKwh > 0 ? round(importCostEur / gridImportKwh, 3) : 0,
    selfSufficiencyPct:
      consumptionKwh > 0
        ? round(((consumptionKwh - gridImportKwh) / consumptionKwh) * 100, 1)
        : 0,
    solarSelfUseKwh: round(solarSelfUseKwh, 1),
    solarSelfUsePct:
      pvProductionKwh > 0 ? round((solarSelfUseKwh / pvProductionKwh) * 100, 1) : 0,
    batteryChargeKwh: round(batteryChargeKwh, 1),
    batteryDischargeKwh: round(batteryDischargeKwh, 1),
  };
}

function buildEnergyFlow(
  annualTotals: AnnualTotals,
  surplusYear: ReturnType<typeof surplusSummary>,
): EnergyFlow {
  const ownSupplyKwh = Math.max(
    0,
    annualTotals.consumptionKwh - annualTotals.gridImportKwh,
  );
  return {
    ownSupplyKwh: round(ownSupplyKwh, 1),
    gridSupplyKwh: annualTotals.gridImportKwh,
    selfUsedSolarKwh: annualTotals.solarSelfUseKwh,
    exportedSolarKwh: annualTotals.gridExportKwh,
    feedInEarnedEur: annualTotals.feedInCreditEur,
    exportOpportunityEur: surplusYear.valueIfSelfUsed,
    importToExportPriceRatio:
      surplusYear.feedInEarned > 0
        ? round(surplusYear.avgImportPrice / 0.081, 1)
        : 0,
  };
}

function buildMonthlyTrend(ds: Dataset): MonthlyTrendPoint[] {
  const loads = monthlyLoads(ds);
  return ds.bills.map((b) => {
    const load = loads.get(b.month) ?? { ev: 0, heatpump: 0 };
    return {
      month: b.month.slice(5),
      bill: round(b.total_bill_eur, 0),
      consumption: round(b.consumption_kwh, 0),
      pv: round(b.pv_production_kwh, 0),
      import: round(b.grid_import_kwh, 0),
      export: round(b.grid_export_kwh, 0),
      selfsuf: round(b.self_sufficiency_pct, 0),
      ev: round(load.ev, 0),
      heatpump: round(load.heatpump, 0),
    };
  });
}

function monthlyLoads(ds: Dataset): Map<string, MonthlyLoad> {
  const loads = new Map<string, MonthlyLoad>();
  for (const r of ds.records) {
    const month = r.timestamp.slice(0, 7);
    const load = loads.get(month) ?? { ev: 0, heatpump: 0 };
    load.ev += r.ev_charging_kw * STEP_H;
    load.heatpump += r.heatpump_kw * STEP_H;
    loads.set(month, load);
  }
  return loads;
}

function buildTariffFit(ds: Dataset, annualTotals: AnnualTotals): TariffFit {
  const hourly = buildHourlyTariffPoints(ds);
  const byCheap = [...hourly].sort((a, b) => a.avgRetailPrice - b.avgRetailPrice);
  const byExpensive = [...hourly].sort((a, b) => b.avgRetailPrice - a.avgRetailPrice);
  const cheapestHours = byCheap.slice(0, 3);
  const expensiveHours = byExpensive.slice(0, 3);
  const highestImportHours = [...hourly]
    .sort((a, b) => b.gridImportKwh - a.gridImportKwh)
    .slice(0, 3);

  const cheapSet = new Set(cheapestHours.map((h) => h.hour));
  const expensiveSet = new Set(expensiveHours.map((h) => h.hour));
  const importInCheapest = hourly
    .filter((h) => cheapSet.has(h.hour))
    .reduce((s, h) => s + h.gridImportKwh, 0);
  const importInExpensive = hourly
    .filter((h) => expensiveSet.has(h.hour))
    .reduce((s, h) => s + h.gridImportKwh, 0);

  const formula =
    ds.tariff.type === "dynamic_hourly"
      ? `spot price + €${ds.tariff.spot_adder_eur_per_kwh.toFixed(3)}/kWh adder`
      : `fixed €${ds.tariff.energy_rate_eur_per_kwh.toFixed(3)}/kWh`;

  return {
    type: ds.tariff.type === "dynamic_hourly" ? "dynamic" : "fixed",
    tariffName: ds.tariff.name,
    formula,
    avgRetailPrice:
      hourly.length > 0
        ? round(hourly.reduce((s, h) => s + h.avgRetailPrice, 0) / hourly.length, 3)
        : 0,
    avgImportPaid: annualTotals.avgImportPriceEurPerKwh,
    cheapestHours,
    expensiveHours,
    highestImportHours,
    importInCheapestPct:
      annualTotals.gridImportKwh > 0
        ? round((importInCheapest / annualTotals.gridImportKwh) * 100, 1)
        : 0,
    importInExpensivePct:
      annualTotals.gridImportKwh > 0
        ? round((importInExpensive / annualTotals.gridImportKwh) * 100, 1)
        : 0,
    hourly,
  };
}

function buildHourlyTariffPoints(ds: Dataset): HourlyTariffPoint[] {
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    consumptionKwh: 0,
    gridImportKwh: 0,
    importCostEur: 0,
    priceSum: 0,
    priceCount: 0,
  }));

  for (const r of ds.records) {
    const hour = Number(r.timestamp.slice(11, 13));
    const importKwh = r.grid_import_kw * STEP_H;
    hours[hour].consumptionKwh += r.total_consumption_kw * STEP_H;
    hours[hour].gridImportKwh += importKwh;
    hours[hour].importCostEur += importKwh * r.price_eur_per_kwh;
  }

  if (ds.tariff.type === "dynamic_hourly") {
    for (const p of ds.spotPrices) {
      const hour = Number(p.timestamp.slice(11, 13));
      hours[hour].priceSum +=
        p.spot_price_eur_per_kwh + ds.tariff.spot_adder_eur_per_kwh;
      hours[hour].priceCount += 1;
    }
  } else {
    for (const h of hours) {
      h.priceSum = ds.tariff.energy_rate_eur_per_kwh;
      h.priceCount = 1;
    }
  }

  return hours.map((h) => ({
    hour: h.hour,
    avgRetailPrice: h.priceCount > 0 ? round(h.priceSum / h.priceCount, 3) : 0,
    gridImportKwh: round(h.gridImportKwh, 1),
    importCostEur: round(h.importCostEur, 2),
    consumptionKwh: round(h.consumptionKwh, 1),
  }));
}

function buildLoadBreakdown(
  ds: Dataset,
  annualTotals: AnnualTotals,
  ev: ReturnType<typeof evPattern>,
): LoadBreakdownItem[] {
  let householdKwh = 0;
  let heatpumpKwh = 0;
  let evKwh = 0;

  for (const r of ds.records) {
    householdKwh += r.house_load_kw * STEP_H;
    heatpumpKwh += r.heatpump_kw * STEP_H;
    evKwh += r.ev_charging_kw * STEP_H;
  }

  const share = (kwh: number) =>
    annualTotals.consumptionKwh > 0
      ? round((kwh / annualTotals.consumptionKwh) * 100, 1)
      : 0;

  return [
    {
      id: "household",
      label: "Household base load",
      kwh: round(householdKwh, 1),
      sharePct: share(householdKwh),
      detail: "lighting, appliances and background use across the year",
    },
    {
      id: "heatpump",
      label: "Heat pump",
      kwh: round(heatpumpKwh, 1),
      sharePct: share(heatpumpKwh),
      detail: `${ds.contract.assets.heat_pump_kw} kW asset, strongest in colder months`,
    },
    {
      id: "ev",
      label: "EV charging",
      kwh: round(evKwh, 1),
      sharePct: share(evKwh),
      detail: `typical start ${String(ev.typicalStartHour).padStart(
        2,
        "0",
      )}:00, ${ev.pctFromSolar}% supplied by solar/battery`,
    },
  ];
}

function dataPeriod(ds: Dataset): string {
  const first = ds.records[0]?.timestamp.slice(0, 10) ?? "unknown";
  const last = ds.records[ds.records.length - 1]?.timestamp.slice(0, 10) ?? "unknown";
  return `${first} to ${last}`;
}

// ---- Goals ----

export type GoalsView = {
  recommendations: Recommendation[]; // ranked € desc
  baseSavedEur: number; // captured this month so far (computed from the meter)
  baseSavedCo2Kg: number;
  baseKmNotDriven: number;
  potentialEur: number; // sum of active recommendations' monthly potential
  potentialCo2Kg: number;
};

export function buildGoals(ds: Dataset): GoalsView {
  const recommendations = rankRecommendations(ds.records, DEMO_TODAY);
  const s = savedThisMonth(ds.records, DEMO_TODAY);
  const potentialEur = recommendations.reduce(
    (a, r) => a + r.monthlyPotentialEur,
    0,
  );
  const potentialCo2Kg = recommendations.reduce(
    (a, r) => a + r.monthlyPotentialCo2Kg,
    0,
  );
  return {
    recommendations,
    baseSavedEur: s.eur,
    baseSavedCo2Kg: s.co2Kg,
    baseKmNotDriven: kmNotDriven(s.co2Kg),
    potentialEur: round(potentialEur, 2),
    potentialCo2Kg: round(potentialCo2Kg, 1),
  };
}
