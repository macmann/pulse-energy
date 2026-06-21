import { Sun } from "lucide-react";

type Props = { data: any };

function friendlyName(raw: string): string {
  if (!raw) return "Appliance";
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmt(n: number): string {
  return `€${n.toFixed(2)}`;
}

export function ShiftSavingsCard({ data }: Props) {
  const d = data ?? {};
  const currentCost = d.current_cost_eur;
  const proposedCost = d.proposed_cost_eur;
  const savings = d.savings_eur ?? 0;
  const isPositive = savings >= 0;

  return (
    <div className="card tool-result shift-card">
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
        {friendlyName(d.appliance)} Cycle Cost
      </div>

      <div className="cost-row">
        <span>Cost at {d.current_time ?? "now"}</span>
        <span style={{ fontWeight: 600 }}>
          {currentCost != null ? fmt(currentCost) : "—"}
        </span>
      </div>

      <div className="cost-row">
        <span>Cost at {d.proposed_time ?? "optimal time"}</span>
        <span style={{ fontWeight: 600 }}>
          {proposedCost != null ? fmt(proposedCost) : "—"}
        </span>
      </div>

      <div className="cost-row" style={{ borderBottom: "none" }}>
        <span style={{ fontWeight: 600 }}>
          {isPositive ? "You save" : "Extra cost"}
        </span>
        <span className={`savings ${isPositive ? "" : "negative"}`}>
          {isPositive ? "" : "+"}{fmt(Math.abs(savings))}
        </span>
      </div>

      {d.pv_available && (
        <div className="solar-badge">
          <Sun size={13} /> Solar surplus covers this!
        </div>
      )}

      {d.reason && (
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 10, lineHeight: 1.5 }}>
          {d.reason}
        </p>
      )}
    </div>
  );
}
