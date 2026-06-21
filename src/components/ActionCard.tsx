// Unified recommendation/action card shared by Home ("Today's actions") and the
// Recommendations screen, so both stay in sync when the design changes.
//
// Layout: money tag · CO₂ tag · [Set reminder] (primary amber pill) · ◯✓ (small
// done icon). The two controls are independent — you can mark done directly
// without setting a reminder first. Marking done banks eurToday + co2Today into
// the Goals total and supersedes the reminder note.

import { Car, Check, Leaf, Thermometer, WashingMachine } from "lucide-react";
import type { Recommendation } from "../lib/engine";
import { useGoals } from "../store/goals";
import { eur } from "../lib/format";

const ICONS = { ev: Car, preheat: Thermometer, appliances: WashingMachine };

export function ActionCard({ r }: { r: Recommendation }) {
  const { isDone, toggle, isReminded, toggleRemind } = useGoals();
  const done = isDone(r.id);
  const reminded = isReminded(r.id);
  const Icon = ICONS[r.icon];

  return (
    <div className="card card-pad">
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
          className={`btn btn-reminder ${reminded ? "is-on" : ""}`}
          onClick={() => toggleRemind(r.id)}
          aria-pressed={reminded}
        >
          {reminded ? (
            <>
              <Check size={15} /> Reminder on
            </>
          ) : (
            "Set reminder"
          )}
        </button>
        <button
          className={`done-check ${done ? "is-done" : ""}`}
          onClick={() => toggle(r.id)}
          aria-pressed={done}
          aria-label={done ? "Mark not done" : "Mark done"}
          title={done ? "Done" : "Mark done"}
        >
          <Check size={16} />
        </button>
      </div>

      {reminded && !done && (
        <div className="reminder-note tiny muted">
          You'll be reminded at {r.remindTime}
        </div>
      )}
    </div>
  );
}
