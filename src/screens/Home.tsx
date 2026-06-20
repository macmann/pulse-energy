import { useMemo } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Car,
  Check,
  Leaf,
  Maximize2,
  Plus,
  Thermometer,
  WashingMachine,
} from "lucide-react";
import type { Dataset } from "../lib/data";
import { buildHome } from "../lib/views";
import { DEMO_NOW_HOUR } from "../lib/demo";
import { useGoals } from "../store/goals";
import { eur } from "../lib/format";

const ICONS = { ev: Car, preheat: Thermometer, appliances: WashingMachine };

export function Home({
  ds,
  onOpenReport,
}: {
  ds: Dataset;
  onOpenReport: (id: string) => void;
  onGoAssistant: () => void;
}) {
  const home = useMemo(() => buildHome(ds), [ds]);
  const hh = ds.household;
  const { toggle, isDone } = useGoals();

  return (
    <div className="screen screen-pad-top">
      <div className="greeting">Hi, the Beckers</div>
      <div className="muted tiny" style={{ marginTop: 4 }}>
        {hh.city} · {hh.pv_kwp} kW solar · {hh.battery_kwh} kWh battery · heat
        pump · EV
      </div>
      <div className="muted tiny" style={{ marginTop: 2 }}>
        as of {String(DEMO_NOW_HOUR).padStart(2, "0")}:00
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

      <div className="section-title">Reminders for you</div>
      <div className="stack">
        {home.reminders.map((r) => {
          const Icon = ICONS[r.icon];
          const set = isDone(r.id);
          return (
            <div key={r.id} className="card card-pad">
              <div className="rec-card">
                <div className="rec-icon">
                  <Icon size={20} />
                </div>
                <div className="rec-body">
                  <div className="rec-title">{r.title}</div>
                  <div className="rec-text">{r.sentence}</div>
                </div>
              </div>
              <div className="impact-row">
                <span className="tag tag-money">＋{eur(r.todaySaveEur)} today</span>
                <span className="tag tag-co2">
                  <Leaf size={12} /> {r.todayCo2Kg.toFixed(1)} kg
                </span>
                <button
                  className={`btn btn-done ${set ? "is-done" : "btn-ghost"}`}
                  onClick={() => toggle(r.id)}
                  aria-pressed={set}
                >
                  {set ? (
                    <>
                      <Check size={15} /> Reminder set
                    </>
                  ) : (
                    "Set reminder"
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
