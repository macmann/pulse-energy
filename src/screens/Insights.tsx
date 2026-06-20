import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Dataset } from "../lib/data";
import { buildInsights } from "../lib/views";
import { DEMO_TODAY, DEMO_WINTER } from "../lib/demo";
import { hourLabel } from "../lib/format";

const CLS_LABEL: Record<string, string> = {
  solar: "Free solar",
  battery: "Battery",
  cheap: "Cheap grid",
  avoid: "Avoid",
};

export function Insights({
  ds,
  scrollTo,
  onScrolled,
}: {
  ds: Dataset;
  scrollTo: string | null;
  onScrolled: () => void;
}) {
  const [bandDate, setBandDate] = useState(DEMO_TODAY);
  const iv = useMemo(() => buildInsights(ds, bandDate), [ds, bandDate]);

  useEffect(() => {
    if (!scrollTo) return;
    const el = document.getElementById(scrollTo);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    onScrolled();
  }, [scrollTo, onScrolled]);

  const bestLine =
    iv.best && iv.worst
      ? `Best window today is ${hourLabel(iv.best.start)}–${hourLabel(
          iv.best.end,
        )}; avoid ${hourLabel(iv.worst.start)}–${hourLabel(iv.worst.end)}.`
      : "Use power while the panels are producing.";

  return (
    <div className="screen screen-pad-top">
      <h1 style={{ fontSize: 22 }}>Your energy day</h1>

      {/* day toggle */}
      <div className="row" style={{ marginTop: 12, gap: 8 }}>
        <DayToggle
          label="Summer day"
          active={bandDate === DEMO_TODAY}
          onClick={() => setBandDate(DEMO_TODAY)}
        />
        <DayToggle
          label="Winter day"
          active={bandDate === DEMO_WINTER}
          onClick={() => setBandDate(DEMO_WINTER)}
        />
      </div>

      {/* the 24-hour band */}
      <div className="card card-pad" style={{ marginTop: 12 }}>
        <div className="band">
          {Array.from({ length: 24 }, (_, h) => {
            const seg = iv.band.find((b) => b.hour === h);
            return (
              <div
                key={h}
                className={`band-seg ${seg ? seg.cls : "avoid"}`}
                title={
                  seg
                    ? `${hourLabel(h)} · ${CLS_LABEL[seg.cls]} · €${seg.price_eur_per_kwh.toFixed(
                        2,
                      )}/kWh`
                    : hourLabel(h)
                }
              />
            );
          })}
        </div>
        <div className="band-hours">
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>24</span>
        </div>
        <div className="legend">
          {(["solar", "battery", "cheap", "avoid"] as const).map((c) => (
            <span key={c} className="legend-item">
              <span className={`dot ${c}`} />
              {CLS_LABEL[c]}
            </span>
          ))}
        </div>
        <p className="report-note" style={{ marginTop: 12 }}>
          {bestLine}
        </p>
      </div>

      {/* reports */}
      {iv.reports.map((r) => (
        <section key={r.id} id={r.id} className="card card-pad report" style={{ marginTop: 16 }}>
          <div className="metric-label" style={{ fontSize: 13 }}>
            {r.title}
          </div>
          <div className="report-big">{r.big}</div>
          <div className={`metric-change ${r.changeGood ? "good" : "bad"}`}>
            {r.changeText}
          </div>
          <div style={{ height: 140, marginTop: 14, marginLeft: -8 }}>
            <ReportChart kind={r.chartKind} data={iv.trend} />
          </div>
          <p className="report-note">{r.note}</p>
        </section>
      ))}
    </div>
  );
}

function DayToggle({
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
      className={`chip${active ? "" : ""}`}
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

function ReportChart({
  kind,
  data,
}: {
  kind: "bill" | "export" | "selfsuf";
  data: { month: string; bill: number; export: number; selfsuf: number }[];
}) {
  const axis = { fontSize: 10, fill: "#9aa0a6" };
  if (kind === "export") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef0f2" vertical={false} />
          <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={false} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={32} />
          <Tooltip
            formatter={(v: number) => [`${v} kWh`, "given to grid"]}
            labelFormatter={(m) => `Month ${m}`}
          />
          <Bar dataKey="export" fill="var(--bad)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  const key = kind === "bill" ? "bill" : "selfsuf";
  const color = kind === "bill" ? "var(--accent)" : "var(--good)";
  const unit = kind === "bill" ? "€" : "%";
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f2" vertical={false} />
        <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={false} />
        <YAxis tick={axis} tickLine={false} axisLine={false} width={32} />
        <Tooltip
          formatter={(v: number) => [
            kind === "bill" ? `€${v}` : `${v}${unit}`,
            kind === "bill" ? "bill" : "self-sufficient",
          ]}
          labelFormatter={(m) => `Month ${m}`}
        />
        <Line
          type="monotone"
          dataKey={key}
          stroke={color}
          strokeWidth={2.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
