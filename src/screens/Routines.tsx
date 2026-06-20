import { useMemo } from "react";
import { Car, Check, Thermometer, WashingMachine } from "lucide-react";
import type { Dataset } from "../lib/data";
import { buildRoutines } from "../lib/views";
import {
  SEED_ROUTINES,
  streakScore,
  useRoutines,
  type DayMark,
  type Routine,
} from "../store/routines";
import { eur } from "../lib/format";

const ICONS = { ev: Car, appliances: WashingMachine, preheat: Thermometer };
const GOAL = 4; // "on track" = did it at least 4 of 7 days
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function Routines({ ds }: { ds: Dataset }) {
  const { simulateAll, setSimulateAll, hasRoutine } = useRoutines();
  const totalSave = SEED_ROUTINES.reduce((s, r) => s + r.saveEur, 0);
  const view = useMemo(() => buildRoutines(ds, totalSave), [ds, totalSave]);

  const onTrackReal = SEED_ROUTINES.filter(
    (r) => streakScore(r.streak) >= GOAL,
  ).length;
  const onTrack = simulateAll ? 3 : onTrackReal;
  const bill = simulateAll ? view.simulatedBill : view.monthBill;

  return (
    <div className="screen screen-pad-top">
      <h1 style={{ fontSize: 22 }}>Your routines</h1>
      <p className="muted tiny" style={{ marginTop: 4 }}>
        Habits we track against your meter, and what they're worth.
      </p>

      {/* summary cards */}
      <div className="metric-grid" style={{ marginTop: 16 }}>
        <div className="card card-pad">
          <div className="metric-label">This month's bill</div>
          <div className="metric-value">{eur(bill)}</div>
          {simulateAll ? (
            <div className="metric-change good">
              −{eur(totalSave)} modelled
            </div>
          ) : (
            <div className="muted tiny">actual, from your meter</div>
          )}
        </div>
        <div className="card card-pad">
          <div className="metric-label">On track</div>
          <div className="metric-value">{onTrack}/3</div>
          <div className="muted tiny">routines hitting their goal</div>
        </div>
      </div>

      {/* simulate toggle */}
      <div className="card card-pad toggle-row" style={{ marginTop: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            Show me "if I'd followed all 3"
          </div>
          <div className="muted tiny" style={{ marginTop: 2 }}>
            A model of the payoff — not a re-billing.
          </div>
        </div>
        <button
          className={`switch${simulateAll ? " on" : ""}`}
          onClick={() => setSimulateAll(!simulateAll)}
          aria-pressed={simulateAll}
        >
          <span className="switch-knob" />
        </button>
      </div>

      {/* routine cards */}
      <div className="stack" style={{ marginTop: 16 }}>
        {SEED_ROUTINES.map((r) => (
          <RoutineCard
            key={r.id}
            r={r}
            simulate={simulateAll}
            tracking={hasRoutine(r.id)}
          />
        ))}
      </div>

      <p className="muted tiny" style={{ marginTop: 16, lineHeight: 1.5 }}>
        {simulateAll
          ? `Simulation: modelled, not billed. The ${eur(
              totalSave,
            )} saving is stacked — the car is most of it (€31), then pre-heating (€9) and midday appliances (€6).`
          : "Dots are graded from your real meter data this week. Green = you did it, grey = missed."}
      </p>
    </div>
  );
}

function RoutineCard({
  r,
  simulate,
  tracking,
}: {
  r: Routine;
  simulate: boolean;
  tracking: boolean;
}) {
  const Icon = ICONS[r.icon];
  // In simulate mode, missed days become dashed-green "would-have" dots.
  const marks: DayMark[] = simulate
    ? r.streak.map((d) => (d === "did" ? "did" : "would"))
    : r.streak;
  const score = simulate ? 7 : streakScore(r.streak);

  return (
    <div className="card card-pad">
      <div className="rec-card">
        <div className="rec-icon">
          <Icon size={20} />
        </div>
        <div className="rec-body">
          <div className="between">
            <div className="rec-title">{r.title}</div>
            {tracking && (
              <span className="pill info">
                <Check size={11} style={{ verticalAlign: -1 }} /> Tracking
              </span>
            )}
          </div>
          <div className="rec-text">
            {score}/7 this week · worth €{r.saveEur}/mo
          </div>
        </div>
      </div>
      <div className="streak">
        {marks.map((m, i) => (
          <span key={i} className={`streak-dot ${m}`} title={`${WEEKDAYS[i]}`}>
            {m === "did" ? "✓" : m === "would" ? "+" : WEEKDAYS[i]}
          </span>
        ))}
      </div>
    </div>
  );
}
