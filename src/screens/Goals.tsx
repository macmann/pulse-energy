import { useMemo, useState } from "react";
import { Car, Check, Leaf, Thermometer, WashingMachine } from "lucide-react";
import type { Dataset } from "../lib/data";
import type { InsightEvent } from "../types";
import { buildGoals } from "../lib/views";
import { CO2_KG_PER_KM, type Recommendation } from "../lib/engine";
import { useGoals } from "../store/goals";
import { eur } from "../lib/format";

const ICONS = { ev: Car, preheat: Thermometer, appliances: WashingMachine };

type InsightCategory = "all" | InsightEvent["type"];

const CATEGORY_LABEL: Record<InsightCategory, string> = {
  all: "All",
  anomaly: "Anomalies",
  nudge: "Nudges",
  insight: "Insights",
};

const INSIGHT_CATEGORIES: InsightCategory[] = [
  "all",
  "anomaly",
  "nudge",
  "insight",
];

export function Goals({ ds }: { ds: Dataset }) {
  const g = useMemo(() => buildGoals(ds), [ds]);
  const [category, setCategory] = useState<InsightCategory>("all");
  const { done, toggle, isDone } = useGoals();
  const categorizedInsights = useMemo(() => {
    return category === "all"
      ? ds.events
      : ds.events.filter((event) => event.type === category);
  }, [category, ds.events]);

  // Running total = what the meter already captured this month + actions marked
  // done today. This MUST move when an action is toggled, so it reads the store.
  const doneRecs = g.recommendations.filter((r) => done[r.id]);
  const extraEur = doneRecs.reduce((a, r) => a + r.todaySaveEur, 0);
  const extraCo2 = doneRecs.reduce((a, r) => a + r.todayCo2Kg, 0);
  const savedEur = g.baseSavedEur + extraEur;
  const savedCo2 = g.baseSavedCo2Kg + extraCo2;
  const kmNotDriven = savedCo2 / CO2_KG_PER_KM;
  const pct = g.potentialEur > 0 ? Math.min(100, (savedEur / g.potentialEur) * 100) : 0;

  const cards = g.recommendations.filter((r) => !r.minor);
  const minor = g.recommendations.filter((r) => r.minor);
  const minorEur = minor.reduce((a, r) => a + r.todaySaveEur, 0);

  return (
    <div className="screen screen-pad-top">
      <h1 style={{ fontSize: 22 }}>Recommendations</h1>

      {/* Hero — running savings total */}
      <div className="goal-hero" style={{ marginTop: 14 }}>
        <div className="goal-hero-label">SAVED THIS MONTH</div>
        <div className="goal-hero-value">{eur(savedEur)}</div>
        <div className="goal-hero-of">of {eur(g.potentialEur)} possible</div>
        <div className="goal-bar">
          <div className="goal-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="goal-hero-co2">
          <Leaf size={13} /> {savedCo2.toFixed(1)} kg CO₂ avoided · about{" "}
          {Math.round(kmNotDriven)} km not driven
        </div>
      </div>

      <section className="card card-pad actual-insights" style={{ marginTop: 16 }}>
        <div className="between">
          <div>
            <div className="metric-label" style={{ fontSize: 13 }}>
              Actual data insights
            </div>
            <h2 style={{ fontSize: 18, marginTop: 2 }}>Meter-backed categories</h2>
          </div>
          <span className="pill info">{categorizedInsights.length}</span>
        </div>
        <p className="report-note" style={{ marginTop: 8 }}>
          These cards use the existing mock insight categories, but the copy is grounded
          in the loaded household event data instead of placeholder text.
        </p>
        <div className="row category-row" style={{ marginTop: 12, gap: 8 }}>
          {INSIGHT_CATEGORIES.map((c) => (
            <CategoryChip
              key={c}
              label={CATEGORY_LABEL[c]}
              active={category === c}
              onClick={() => setCategory(c)}
            />
          ))}
        </div>
        <div className="stack" style={{ marginTop: 14 }}>
          {categorizedInsights.map((event) => (
            <ActualInsightCard
              key={`${event.type}-${event.period}-${event.title}`}
              event={event}
            />
          ))}
        </div>
      </section>

      {/* Today's actions, ranked by impact */}
      <div className="between" style={{ marginTop: 22, marginBottom: 12 }}>
        <h2 style={{ fontSize: 17 }}>Today's actions</h2>
        <span className="muted tiny">ranked by impact</span>
      </div>

      <div className="stack">
        {cards.map((r) => (
          <ActionCard
            key={r.id}
            r={r}
            done={isDone(r.id)}
            onToggle={() => toggle(r.id)}
          />
        ))}

        {minor.length > 0 && (
          <div className="card card-pad muted tiny">
            Other small wins today add about {eur(minorEur)} more — Pulse will
            surface them when they grow.
          </div>
        )}
      </div>

      <p className="muted tiny" style={{ marginTop: 16, lineHeight: 1.5 }}>
        Tap done when you act, or let Pulse detect it from your meter. Savings are
        estimates based on today's prices and solar.
      </p>
    </div>
  );
}

function ActualInsightCard({ event }: { event: InsightEvent }) {
  const severity = event.severity === "high" ? "high" : "info";
  return (
    <article className={`actual-insight-card ${event.type}`}>
      <div className="between">
        <span className="metric-label">{CATEGORY_LABEL[event.type]}</span>
        <span className={`pill ${severity}`}>{event.period}</span>
      </div>
      <h3>{event.title}</h3>
      <p>{event.detail}</p>
      <div className="actual-action">{event.suggested_action}</div>
    </article>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="chip"
      style={{
        background: active ? "var(--accent)" : "var(--card)",
        color: active ? "#2a2000" : "var(--ink)",
        borderColor: active ? "var(--accent)" : "var(--line)",
      }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ActionCard({
  r,
  done,
  onToggle,
}: {
  r: Recommendation;
  done: boolean;
  onToggle: () => void;
}) {
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
          className={`btn btn-done ${done ? "is-done" : "btn-ghost"}`}
          onClick={onToggle}
          aria-pressed={done}
        >
          {done ? (
            <>
              <Check size={15} /> Done
            </>
          ) : (
            "Mark done"
          )}
        </button>
      </div>
    </div>
  );
}
