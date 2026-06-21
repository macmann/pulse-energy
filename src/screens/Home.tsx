import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Maximize2,
  Plus,
  Sparkles,
} from "lucide-react";
import type { Dataset } from "../lib/data";
import { buildHome } from "../lib/views";
import { ActionCard } from "../components/ActionCard";

export function Home({
  ds,
  onOpenReport,
}: {
  ds: Dataset;
  onOpenReport: (id: string) => void;
}) {
  const home = useMemo(() => buildHome(ds), [ds]);
  const hh = ds.household;

  return (
    <div className="screen screen-pad-top">
      <div className="greeting">Hi, {hh.name}</div>
      <div className="muted tiny" style={{ marginTop: 4 }}>
        {hh.city} · {hh.pv_kwp} kW solar · {hh.battery_kwh} kWh battery · heat
        pump
      </div>

      <div className="metric-grid" style={{ marginTop: 18 }}>
        {home.metrics.map((m) => (
          <button
            key={m.id}
            className="metric-card"
            onClick={() => onOpenReport(m.id)}
          >
            <span className="metric-top">
              <span className="metric-label">{m.label}</span>
              <span
                className="metric-expand"
                role="img"
                aria-label="Open full breakdown"
              >
                <Maximize2 size={15} />
              </span>
            </span>
            <span className="metric-value">{m.value}</span>
            <span className={`metric-change ${m.changeGood ? "good" : "bad"}`}>
              {m.changeUp ? (
                <ArrowUpRight size={13} />
              ) : (
                <ArrowDownRight size={13} />
              )}
              {m.changeText}
            </span>
          </button>
        ))}
        <div className="metric-placeholder">
          <Plus size={18} />
          More soon
        </div>
      </div>

      {home.alerts.length > 0 && (
        <>
          <div className="section-title">Alerts & nudges</div>
          <div className="stack">
            {home.alerts.map((alert) => {
              const Icon = alert.type === "anomaly" ? AlertTriangle : Sparkles;
              return (
                <div
                  key={`${alert.type}-${alert.period}-${alert.title}`}
                  className="card card-pad"
                >
                  <div className="rec-card">
                    <div
                      className={`rec-icon${
                        alert.type === "anomaly" ? " alert" : ""
                      }`}
                    >
                      <Icon size={20} />
                    </div>
                    <div className="rec-body">
                      <div className="between">
                        <div className="rec-title">{alert.title}</div>
                        <span
                          className={`pill ${
                            alert.severity === "high" ? "high" : "info"
                          }`}
                        >
                          {alert.period}
                        </span>
                      </div>
                      <div className="rec-text">{alert.detail}</div>
                      <div className="tiny muted" style={{ marginTop: 6 }}>
                        {alert.suggested_action}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="section-title">Today's actions</div>
      <div className="stack">
        {home.reminders.map((r) => (
          <ActionCard key={r.id} r={r} />
        ))}
      </div>
    </div>
  );
}
