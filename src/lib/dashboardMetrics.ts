import type { MonthlyBill, Tariff, TimeseriesRecord } from "../types";

const STEP_H = 0.25;

type FeedInContract = Pick<Tariff, "feed_in_eur_per_kwh">;

export type TimeseriesSummary = {
  importKwh?: number;
  importCostEur?: number;
};

export type DashboardMetricsContext = {
  monthlyBills: MonthlyBill[];
  contract: FeedInContract;
  timeseriesSummary?: TimeseriesSummary;
};

export type DashboardInsightCards = {
  export: {
    title: "Energy sent to grid";
    big: string;
    changeText: string;
    note: string;
    exportKwh: number;
    feedInEarningsEur: number;
    averageImportPriceEurPerKwh: number | null;
    avoidedGridValueEur: number | null;
  };
  selfSufficiency: {
    title: "Self-sufficiency";
    big: string;
    changeText: string;
    note: string;
    latestPct: number | null;
    previousPct: number | null;
  };
  billOpportunity: {
    title: "Solar optimization upside";
    big: string;
    changeText: string;
    note: string;
    billRange: ReturnType<typeof getBillRange>;
  };
};

export function getYearlyExportKwh(monthlyBills: MonthlyBill[]): number {
  return monthlyBills.reduce((sum, bill) => sum + bill.grid_export_kwh, 0);
}

export function getFeedInEarnings(
  monthlyBills: MonthlyBill[],
  contract: FeedInContract,
): number {
  return getYearlyExportKwh(monthlyBills) * contract.feed_in_eur_per_kwh;
}

export function getTimeseriesSummary(
  records: TimeseriesRecord[],
): Required<TimeseriesSummary> {
  return records.reduce(
    (summary, record) => {
      const importKwh = record.grid_import_kw * STEP_H;
      summary.importKwh += importKwh;
      summary.importCostEur += importKwh * record.price_eur_per_kwh;
      return summary;
    },
    { importKwh: 0, importCostEur: 0 },
  );
}

export function getAverageImportPrice(
  monthlyBills: MonthlyBill[],
  timeseriesSummary?: TimeseriesSummary,
): number | null {
  if (
    timeseriesSummary?.importKwh &&
    timeseriesSummary.importKwh > 0 &&
    timeseriesSummary.importCostEur != null
  ) {
    return timeseriesSummary.importCostEur / timeseriesSummary.importKwh;
  }

  const importKwh = monthlyBills.reduce((sum, bill) => sum + bill.grid_import_kwh, 0);
  const importCost = monthlyBills.reduce((sum, bill) => sum + bill.energy_cost_eur, 0);
  return importKwh > 0 ? importCost / importKwh : null;
}

export function getAvoidedGridValue(
  exportKwh: number,
  averageImportPrice: number | null,
): number | null {
  return averageImportPrice == null ? null : exportKwh * averageImportPrice;
}

export function getLatestSelfSufficiency(monthlyBills: MonthlyBill[]): number | null {
  return monthlyBills.at(-1)?.self_sufficiency_pct ?? null;
}

export function getPreviousSelfSufficiency(monthlyBills: MonthlyBill[]): number | null {
  return monthlyBills.at(-2)?.self_sufficiency_pct ?? null;
}

export function getBillRange(monthlyBills: MonthlyBill[]) {
  if (monthlyBills.length === 0) {
    return {
      minBill: null,
      maxBill: null,
      difference: null,
      averageBill: null,
      minMonth: null,
      maxMonth: null,
    };
  }

  const min = monthlyBills.reduce((lowest, bill) =>
    bill.total_bill_eur < lowest.total_bill_eur ? bill : lowest,
  );
  const max = monthlyBills.reduce((highest, bill) =>
    bill.total_bill_eur > highest.total_bill_eur ? bill : highest,
  );
  const average =
    monthlyBills.reduce((sum, bill) => sum + bill.total_bill_eur, 0) /
    monthlyBills.length;

  return {
    minBill: min.total_bill_eur,
    maxBill: max.total_bill_eur,
    difference: max.total_bill_eur - min.total_bill_eur,
    averageBill: average,
    minMonth: min.month,
    maxMonth: max.month,
  };
}

export function getDashboardInsightCards(
  context: DashboardMetricsContext,
): DashboardInsightCards {
  const { monthlyBills, contract, timeseriesSummary } = context;
  const exportKwh = getYearlyExportKwh(monthlyBills);
  const feedInEarnings = getFeedInEarnings(monthlyBills, contract);
  const averageImportPrice = getAverageImportPrice(monthlyBills, timeseriesSummary);
  const avoidedGridValue = getAvoidedGridValue(exportKwh, averageImportPrice);
  const latestSelfSufficiency = getLatestSelfSufficiency(monthlyBills);
  const previousSelfSufficiency = getPreviousSelfSufficiency(monthlyBills);
  const billRange = getBillRange(monthlyBills);

  const roundedExportKwh = Math.round(exportKwh);
  const roundedFeedIn = Math.round(feedInEarnings);
  const importPriceText =
    averageImportPrice == null ? "your average import price" : `€${averageImportPrice.toFixed(3)}/kWh`;
  const avoidedValueText =
    avoidedGridValue == null ? "unknown" : `€${Math.round(avoidedGridValue).toLocaleString("en-US")}`;
  const feedInRateText = `€${contract.feed_in_eur_per_kwh.toFixed(3)}/kWh`;

  const selfChangeText =
    latestSelfSufficiency == null || previousSelfSufficiency == null
      ? "latest month unavailable"
      : `latest month; ${latestSelfSufficiency >= previousSelfSufficiency ? "up" : "down"} from ${Math.round(
          previousSelfSufficiency,
        )}% last month`;

  const minBillText =
    billRange.minBill == null ? "—" : `€${Math.round(billRange.minBill)}`;
  const maxBillText =
    billRange.maxBill == null ? "—" : `€${Math.round(billRange.maxBill)}`;
  const differenceText =
    billRange.difference == null ? "—" : `€${Math.round(billRange.difference)}`;
  const minMonthName = formatMonthName(billRange.minMonth);
  const maxMonthName = formatMonthName(billRange.maxMonth);

  return {
    export: {
      title: "Energy sent to grid",
      big: `${roundedExportKwh.toLocaleString("en-US")} kWh`,
      changeText:
        avoidedGridValue == null
          ? `earned €${roundedFeedIn} — self-use value unavailable`
          : `earned €${roundedFeedIn} — worth ~${avoidedValueText} if self-used at your average import price`,
      note:
        avoidedGridValue == null || averageImportPrice == null
          ? `You exported ${roundedExportKwh.toLocaleString("en-US")} kWh of solar this year and earned ${feedInRateText} for each kWh. Add import-price data to estimate what that energy would be worth if used at home.`
          : `You exported ${roundedExportKwh.toLocaleString("en-US")} kWh of solar this year and earned €${roundedFeedIn} at ${feedInRateText}. At your weighted average import price of ${importPriceText}, using that energy at home would avoid about ${avoidedValueText} of grid purchases. Red bars = months you exported the most. → Shift flexible loads into the midday surplus.`,
      exportKwh,
      feedInEarningsEur: feedInEarnings,
      averageImportPriceEurPerKwh: averageImportPrice,
      avoidedGridValueEur: avoidedGridValue,
    },
    selfSufficiency: {
      title: "Self-sufficiency",
      big: latestSelfSufficiency == null ? "—" : `${Math.round(latestSelfSufficiency)}%`,
      changeText: selfChangeText,
      note:
        "Self-sufficiency is the share of your energy covered by your own solar and battery. It peaked in spring and dipped in darker or higher-consumption months.",
      latestPct: latestSelfSufficiency,
      previousPct: previousSelfSufficiency,
    },
    billOpportunity: {
      title: "Solar optimization upside",
      big: `${minBillText}–${maxBillText} bill range`,
      changeText: `${differenceText} difference between lowest and highest bill`,
      note:
        billRange.minBill == null || billRange.maxBill == null
          ? "Bill range is unavailable because monthly bill data is missing."
          : `Your bill ranged from ${minBillText} in ${minMonthName} to ${maxBillText} in ${maxMonthName}. The biggest remaining opportunity is flexible usage: shift EV charging, laundry, dishwasher, and heat-pump pre-heating into cheap or sunny hours.`,
      billRange,
    },
  };
}

function formatMonthName(month: string | null): string {
  if (!month) return "an unavailable month";
  const date = new Date(`${month}-01T00:00:00Z`);
  return new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(date);
}
