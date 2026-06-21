import { Wrench } from "lucide-react";
import { HouseholdContextCard } from "./HouseholdContextCard";
import { ShiftSavingsCard } from "./ShiftSavingsCard";
import { RoutineConfirmationButton } from "./RoutineConfirmationButton";
import { MissingInfoForm } from "./MissingInfoForm";

type Props = {
  toolName: string;
  state: string;
  args: any;
  result: any;
  onSubmitInfo?: (text: string) => void;
};

function friendlyToolName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function TariffSummaryCard({ data }: { data: any }) {
  const d = data ?? {};
  const current = d.actual_total_eur;
  const proposed = d.hypothetical_total_eur;
  const diff = d.difference_eur;
  const isBetter = diff > 0;

  return (
    <div className="card tool-result tariff-summary">
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
        30-Day Tariff Comparison
      </div>

      <div className="tariff-row" style={{ fontWeight: 600, color: "var(--muted)", borderBottom: "1.5px solid var(--line)" }}>
        <span>Tariff Plan</span>
        <span>Cost (30 Days)</span>
      </div>

      <div className="tariff-row">
        <span>{d.current_tariff ?? "Current Plan"}</span>
        <span style={{ fontWeight: 600 }}>
          {current != null ? `€${Number(current).toFixed(2)}` : "—"}
        </span>
      </div>

      <div className="tariff-row">
        <span>{d.target_tariff ?? "Simulated Plan"}</span>
        <span style={{ fontWeight: 600 }}>
          {proposed != null ? `€${Number(proposed).toFixed(2)}` : "—"}
        </span>
      </div>

      {diff != null && (
        <div className={`verdict ${isBetter ? "better" : "worse"}`} style={{ marginTop: 12 }}>
          {diff > 0
            ? `Switching saves €${Math.abs(diff).toFixed(2)} / month`
            : diff < 0
              ? `Switching costs €${Math.abs(diff).toFixed(2)} / month more`
              : "Both plans cost the same"}
        </div>
      )}

      {d.recommendation && (
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 12, lineHeight: 1.5 }}>
          {d.recommendation}
        </p>
      )}
    </div>
  );
}

export function ToolRenderer({ toolName, state, result, onSubmitInfo }: Props) {
  // Partial call — the model is still deciding arguments
  if (state === "partial-call") {
    return (
      <div className="tool-loading">
        <div className="spinner-small" />
        <span>Thinking…</span>
      </div>
    );
  }

  // Call sent, waiting for server result
  if (state === "call") {
    return (
      <div className="tool-loading">
        <div className="spinner-small" />
        <span>
          <Wrench size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
          {friendlyToolName(toolName)}…
        </span>
      </div>
    );
  }

  // Result arrived — render the right card
  if (state === "result") {
    switch (toolName) {
      case "get_household_context":
        return <HouseholdContextCard data={result} />;
      case "calculate_shift_savings":
        return <ShiftSavingsCard data={result} />;
      case "set_routine_reminder":
        return <RoutineConfirmationButton data={result} />;
      case "request_missing_info":
        return (
          <MissingInfoForm
            data={result}
            onSubmit={onSubmitInfo ?? (() => {})}
          />
        );
      case "simulate_tariff_switch":
        return <TariffSummaryCard data={result} />;
      default:
        return (
          <div className="card tool-result" style={{ padding: 14, fontSize: 13 }}>
            <div className="tool-chip">
              <Wrench size={12} /> {friendlyToolName(toolName)}
            </div>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: "8px 0 0" }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        );
    }
  }

  return null;
}
