import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  Maximize2,
  Plus,
  Sparkles,
} from "lucide-react";
import type { Dataset } from "../lib/data";
import type { InsightEvent } from "../types";
import { buildHome } from "../lib/views";
import { ActionCard } from "../components/ActionCard";
import { formatEventPeriod } from "../lib/format";

export function Home({
  ds,
  onOpenReport,
}: {
  ds: Dataset;
  onOpenReport: (id: string) => void;
}) {
  const home = useMemo(() => buildHome(ds), [ds]);
  const [openAlertKeys, setOpenAlertKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const hh = ds.household;

  function toggleAlert(key: string) {
    setOpenAlertKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

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
              const key = alertKey(alert);
              return (
                <HomeAlertCard
                  key={key}
                  alert={alert}
                  expanded={openAlertKeys.has(key)}
                  onToggle={() => toggleAlert(key)}
                />
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

function alertKey(alert: InsightEvent): string {
  return `${alert.type}-${alert.period}-${alert.title}`;
}

function HomeAlertCard({
  alert,
  expanded,
  onToggle,
}: {
  alert: InsightEvent;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = alert.type === "anomaly" ? AlertTriangle : Sparkles;
  const severity = alert.severity === "high" ? "high" : "info";
  return (
    <div className="card home-alert-card">
      <button
        className="home-alert-toggle"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="rec-card">
          <div className={`rec-icon${alert.type === "anomaly" ? " alert" : ""}`}>
            <Icon size={20} />
          </div>
          <div className="rec-body">
            <div className="rec-title">{alert.title}</div>
            <div className="home-alert-meta">
              <span className={`event-period-pill ${severity}`}>
                {formatEventPeriod(alert.period)}
              </span>
            </div>
          </div>
        </div>
        <ChevronDown
          className={`home-alert-chevron${expanded ? " open" : ""}`}
          size={18}
          aria-hidden="true"
        />
      </button>
      {expanded && (
        <div className="home-alert-body">
          <div className="rec-text">{alert.detail}</div>
          <div className="tiny muted" style={{ marginTop: 6 }}>
            {alert.suggested_action}
          </div>
        </div>
      )}
    </div>
  );
}
