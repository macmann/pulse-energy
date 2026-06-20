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
