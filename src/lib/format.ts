// Number formatting helpers. Rule: currency €X.XX, kWh 1 decimal, % integer.

export function round(n: number, d = 0): number {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

export function eur(n: number): string {
  return `€${n.toFixed(2)}`;
}

// Whole-euro form for big headline numbers ("€46").
export function eur0(n: number): string {
  return `€${Math.round(n)}`;
}

export function kwh(n: number): string {
  return `${n.toFixed(1)} kWh`;
}

export function pct(n: number): string {
  return `${Math.round(n)}%`;
}

export function signedEur(n: number): string {
  const v = Math.abs(n);
  return `${n >= 0 ? "+" : "−"}${eur(v)}`;
}

export function hourLabel(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function parseDateParts(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function formatDateShort(date: DateParts): string {
  return `${MONTHS[date.month - 1]} ${date.day}`;
}

function formatMonthPeriod(period: string): string | null {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;

  return `${MONTHS[month - 1]} ${year}`;
}

function formatDateRange(start: DateParts, end: DateParts): string {
  if (start.year === end.year && start.month === end.month) {
    return `${formatDateShort(start)}-${end.day}, ${start.year}`;
  }

  if (start.year === end.year) {
    return `${formatDateShort(start)}-${formatDateShort(end)}, ${start.year}`;
  }

  return `${formatDateShort(start)}, ${start.year}-${formatDateShort(end)}, ${end.year}`;
}

export function formatEventPeriod(period: string): string {
  const trimmed = period.trim();
  if (trimmed.toLowerCase() === "recurring") return "Recurring";

  const monthPeriod = formatMonthPeriod(trimmed);
  if (monthPeriod) return monthPeriod;

  const [startValue, endValue] = trimmed.split("..");
  if (startValue && endValue) {
    const start = parseDateParts(startValue);
    const end = parseDateParts(endValue);
    if (start && end) return formatDateRange(start, end);
  }

  const date = parseDateParts(trimmed);
  if (date) return `${formatDateShort(date)}, ${date.year}`;

  return period;
}
