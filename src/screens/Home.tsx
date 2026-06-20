import { useMemo } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Car,
  Check,
  Plus,
  WashingMachine,
} from "lucide-react";
import type { Dataset } from "../lib/data";
import { buildHome } from "../lib/views";
import { DEMO_NOW_HOUR } from "../lib/demo";
import { SEED_ROUTINES, useRoutines } from "../store/routines";

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
  const { addRoutine, hasRoutine } = useRoutines();

  const reminders = SEED_ROUTINES.filter((r) =>
    ["ev-on-solar", "appliances-midday"].includes(r.id),
  );

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
            <span className="metric-label">{m.label}</span>
            <span className="metric-value">{m.value}</span>
            <span className={`metric-change ${m.changeGood ? "good" : "bad"}`}>
              {m.changeGood ? (
                <ArrowUpRight size={13} />
              ) : (
                <ArrowDownRight size={13} />
              )}
              {m.changeText}
            </span>
            <span className="metric-see">see breakdown →</span>
          </button>
        ))}
        <div className="metric-placeholder">
          <Plus size={18} />
          More soon
        </div>
      </div>

      <div className="section-title">Reminders for you</div>
      <div className="stack">
        {reminders.map((r) => {
          const set = hasRoutine(r.id);
          return (
            <div key={r.id} className="card card-pad rec-card">
              <div className="rec-icon">
                {r.icon === "ev" ? (
                  <Car size={20} />
                ) : (
                  <WashingMachine size={20} />
                )}
              </div>
              <div className="rec-body">
                <div className="rec-title">{r.title}</div>
                <div className="rec-text">
                  {r.body} Worth about €{r.saveEur}/mo.
                </div>
                <button
                  className={`btn btn-set ${set ? "is-set" : "btn-soft"}`}
                  style={{ marginTop: 10 }}
                  onClick={() => addRoutine(r)}
                  disabled={set}
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
