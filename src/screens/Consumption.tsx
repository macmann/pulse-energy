import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Dataset } from "../lib/data";
import { DEMO_TODAY, DEMO_WINTER } from "../lib/demo";
import { eur, hourLabel, kwh, pct } from "../lib/format";
import { buildConsumptionView, type HourlyTariffPoint } from "../lib/views";

const CLS_LABEL: Record<string, string> = {
  solar: "Free solar",
  battery: "Battery",
  cheap: "Cheap grid",
  avoid: "Grid-heavy",
};

export function Consumption({
  ds,
  scrollTo,
  onScrolled,
}: {
  ds: Dataset;
  scrollTo: string | null;
  onScrolled: () => void;
}) {
  const [bandDate, setBandDate] = useState(DEMO_TODAY);
  const view = useMemo(() => buildConsumptionView(ds, bandDate), [ds, bandDate]);

  useEffect(() => {
    if (!scrollTo) return;
    const el = document.getElementById(scrollTo);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    onScrolled();
  }, [scrollTo, onScrolled]);

  const sampleLine =
    view.sampleDay.best && view.sampleDay.worst
      ? `On this sample day, solar-covered hours ran ${hourLabel(
          view.sampleDay.best.start,
        )}-${hourLabel(view.sampleDay.best.end)}; the most grid-heavy stretch was ${hourLabel(
          view.sampleDay.worst.start,
        )}-${hourLabel(view.sampleDay.worst.end)}.`
      : "On this sample day, consumption was read from the 15-minute meter records.";

  return (
    <div className="screen screen-pad-top">
      <div className="consumption-hero">
        <div className="metric-label">Consumption view</div>
        <h1 style={{ fontSize: 24 }}>Consumption</h1>
        <p className="report-note">
          {view.overview.householdName} in {view.overview.city} ·{" "}
          {view.overview.dataPeriod}
        </p>
        <p className="report-note">
          {view.overview.tariffName} · contract {view.overview.contractPeriod}
        </p>
        <div className="consumption-chip-row">
          {view.overview.assets.map((asset) => (
            <span key={asset} className="chip chip-static">
              {asset}
            </span>
          ))}
        </div>
        <p className="report-note">{view.overview.note}</p>
      </div>

      <section className="consumption-section" id="consumption-overview">
        <div className="section-title">At a glance</div>
        <div className="consumption-stat-grid">
          {view.stats.map((stat) => (
            <div key={stat.label} className="card card-pad consumption-stat">
              <div className="metric-label">{stat.label}</div>
              <div className="report-big">{stat.value}</div>
              {stat.detail && <div className="muted tiny">{stat.detail}</div>}
            </div>
          ))}
        </div>
      </section>

      <section id="report-export" className="card card-pad report consumption-section">
        <SectionHead
          label="Energy flow"
          title="How energy moved through the home"
          note={`In 2025, ${kwh(
            view.energyFlow.ownSupplyKwh,
          )} of consumption was covered by solar and battery, while ${kwh(
            view.energyFlow.gridSupplyKwh,
          )} came from the grid.`}
        />
        <FlowRows
          rows={[
            {
              label: "Consumed from own system",
              value: view.energyFlow.ownSupplyKwh,
              total: view.annualTotals.consumptionKwh,
              tone: "good",
            },
            {
              label: "Imported from grid",
              value: view.energyFlow.gridSupplyKwh,
              total: view.annualTotals.consumptionKwh,
              tone: "bad",
            },
            {
              label: "Solar self-used",
              value: view.energyFlow.selfUsedSolarKwh,
              total: view.annualTotals.pvProductionKwh,
              tone: "good",
            },
            {
              label: "Solar exported",
              value: view.energyFlow.exportedSolarKwh,
              total: view.annualTotals.pvProductionKwh,
              tone: "bad",
            },
          ]}
        />
        <p className="report-note">
          Exported solar earned {eur(view.energyFlow.feedInEarnedEur)} in feed-in
          credit. At the household's average import price, the same energy had an
          avoided-import value of about {eur(view.energyFlow.exportOpportunityEur)}.
        </p>
      </section>

      <section id="report-savings" className="card card-pad report consumption-section">
        <SectionHead
          label="Monthly pattern"
          title="Bills followed seasonality and solar output"
          note={`The 2025 bill total was ${eur(
            view.annualTotals.billTotalEur,
          )}. Energy charges were ${eur(
            view.annualTotals.energyCostEur,
          )}, base fees were ${eur(view.annualTotals.baseFeesEur)}, and feed-in credits were ${eur(
            view.annualTotals.feedInCreditEur,
          )}.`}
        />
        <div className="chart-wrap">
          <MonthlyConsumptionChart data={view.monthlyTrend} />
        </div>
        <p className="report-note">
          Bars show imported and exported grid energy. The line shows the monthly
          bill, so cost can be read next to seasonal solar surplus.
        </p>
      </section>

      <section id="report-selfsuf" className="card card-pad report consumption-section">
        <SectionHead
          label="Self-sufficiency"
          title={`${pct(view.annualTotals.selfSufficiencyPct)} of consumption was not imported`}
          note={`The household used ${kwh(
            view.annualTotals.solarSelfUseKwh,
          )} of its own solar production and exported ${kwh(
            view.annualTotals.gridExportKwh,
          )}. Battery throughput was ${kwh(view.annualTotals.batteryDischargeKwh)} discharged across the year.`}
        />
        <div className="chart-wrap compact">
          <SelfSufficiencyChart data={view.monthlyTrend} />
        </div>
      </section>

      <section className="card card-pad report consumption-section">
        <SectionHead
          label={view.tariffFit.type === "dynamic" ? "Dynamic tariff fit" : "Tariff fit"}
          title={view.tariffFit.tariffName}
          note={`The tariff was modeled as ${view.tariffFit.formula}. The average hourly retail price from dynamic_prices.json was €${view.tariffFit.avgRetailPrice.toFixed(
            3,
          )}/kWh; actual imported energy averaged €${view.tariffFit.avgImportPaid.toFixed(
            3,
          )}/kWh.`}
        />
        <div className="mini-grid">
          <MiniList title="Cheapest hours" items={view.tariffFit.cheapestHours} />
          <MiniList title="Costliest hours" items={view.tariffFit.expensiveHours} />
        </div>
        <div className="chart-wrap">
          <TariffFitChart data={view.tariffFit.hourly} />
        </div>
        <p className="report-note">
          {pct(view.tariffFit.importInCheapestPct)} of grid import happened in the
          three cheapest average hours. {pct(view.tariffFit.importInExpensivePct)}{" "}
          happened in the three costliest average hours. The highest import hours
          were {hourList(view.tariffFit.highestImportHours)}.
        </p>
      </section>

      <section className="card card-pad report consumption-section">
        <SectionHead
          label="Load fingerprints"
          title="What used the electricity"
          note="The 15-minute records split total consumption into household base load, heat pump, and EV charging."
        />
        <div className="load-list">
          {view.loadBreakdown.map((load) => (
            <div key={load.id} className="load-row">
              <div className="between">
                <div>
                  <div className="rec-title">{load.label}</div>
                  <div className="muted tiny">{load.detail}</div>
                </div>
                <div className="load-value">
                  {kwh(load.kwh)}
                  <span>{pct(load.sharePct)}</span>
                </div>
              </div>
              <div className="flow-track">
                <div
                  className="flow-fill good"
                  style={{ width: `${Math.min(100, load.sharePct)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="report-note">
          EV charging totaled {kwh(view.ev.totalKwh)}; {kwh(view.ev.fromGridKwh)}{" "}
          was supplied by grid import and {kwh(view.ev.fromSolarKwh)} by solar or
          battery.
        </p>
      </section>

      <section className="card card-pad report consumption-section">
        <SectionHead
          label="Sample day"
          title={`Meter view for ${view.sampleDay.date}`}
          note={sampleLine}
        />
        <div className="row" style={{ marginTop: 12, gap: 8 }}>
          <DayToggle
            label="Summer sample"
            active={bandDate === DEMO_TODAY}
            onClick={() => setBandDate(DEMO_TODAY)}
          />
          <DayToggle
            label="Winter sample"
            active={bandDate === DEMO_WINTER}
            onClick={() => setBandDate(DEMO_WINTER)}
          />
        </div>
        <div className="band" style={{ marginTop: 12 }}>
          {Array.from({ length: 24 }, (_, h) => {
            const seg = view.sampleDay.band.find((b) => b.hour === h);
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
      </section>
    </div>
  );
}

function SectionHead({
  label,
  title,
  note,
}: {
  label: string;
  title: string;
  note: string;
}) {
  return (
    <>
      <div className="metric-label" style={{ fontSize: 13 }}>
        {label}
      </div>
      <h2 className="consumption-title">{title}</h2>
      <p className="report-note">{note}</p>
    </>
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

function FlowRows({
  rows,
}: {
  rows: { label: string; value: number; total: number; tone: "good" | "bad" }[];
}) {
  return (
    <div className="flow-list">
      {rows.map((row) => {
        const share = row.total > 0 ? (row.value / row.total) * 100 : 0;
        return (
          <div key={row.label} className="flow-row">
            <div className="between">
              <span className="rec-title">{row.label}</span>
              <span className="muted tiny">{kwh(row.value)}</span>
            </div>
            <div className="flow-track">
              <div
                className={`flow-fill ${row.tone}`}
                style={{ width: `${Math.min(100, share)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MiniList({
  title,
  items,
}: {
  title: string;
  items: HourlyTariffPoint[];
}) {
  return (
    <div className="mini-card">
      <div className="metric-label">{title}</div>
      {items.map((h) => (
        <div key={h.hour} className="mini-line">
          <span>{hourLabel(h.hour)}</span>
          <strong>€{h.avgRetailPrice.toFixed(3)}/kWh</strong>
        </div>
      ))}
    </div>
  );
}

function hourList(items: HourlyTariffPoint[]): string {
  return items.map((h) => hourLabel(h.hour)).join(", ");
}

function MonthlyConsumptionChart({
  data,
}: {
  data: { month: string; bill: number; import: number; export: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f2" vertical={false} />
        <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={false} />
        <YAxis yAxisId="left" tick={axis} tickLine={false} axisLine={false} width={34} />
        <YAxis yAxisId="right" orientation="right" hide />
        <Tooltip
          formatter={(v: number, name: string) =>
            name === "bill" ? [`€${v}`, "bill"] : [`${v} kWh`, name]
          }
          labelFormatter={(m) => `Month ${m}`}
        />
        <Bar yAxisId="left" dataKey="import" fill="var(--c-battery)" radius={[3, 3, 0, 0]} />
        <Bar yAxisId="left" dataKey="export" fill="var(--bad)" radius={[3, 3, 0, 0]} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="bill"
          stroke="var(--accent)"
          strokeWidth={2.5}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function SelfSufficiencyChart({ data }: { data: { month: string; selfsuf: number; pv: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f2" vertical={false} />
        <XAxis dataKey="month" tick={axis} tickLine={false} axisLine={false} />
        <YAxis tick={axis} tickLine={false} axisLine={false} width={34} />
        <Tooltip
          formatter={(v: number, name: string) =>
            name === "selfsuf" ? [`${v}%`, "self-sufficient"] : [`${v} kWh`, "PV"]
          }
          labelFormatter={(m) => `Month ${m}`}
        />
        <Bar dataKey="pv" fill="var(--c-solar)" radius={[3, 3, 0, 0]} />
        <Line
          type="monotone"
          dataKey="selfsuf"
          stroke="var(--good)"
          strokeWidth={2.5}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function TariffFitChart({ data }: { data: HourlyTariffPoint[] }) {
  const chartData = data.map((d) => ({
    ...d,
    label: String(d.hour).padStart(2, "0"),
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={chartData} margin={{ top: 8, right: 0, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f2" vertical={false} />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
        <YAxis yAxisId="left" tick={axis} tickLine={false} axisLine={false} width={34} />
        <YAxis yAxisId="right" orientation="right" hide />
        <Tooltip
          formatter={(v: number, name: string) =>
            name === "avgRetailPrice"
              ? [`€${v.toFixed(3)}/kWh`, "retail price"]
              : [`${v} kWh`, "grid import"]
          }
          labelFormatter={(m) => `${m}:00`}
        />
        <Bar yAxisId="left" dataKey="gridImportKwh" fill="var(--c-battery)" radius={[3, 3, 0, 0]} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="avgRetailPrice"
          stroke="var(--bad)"
          strokeWidth={2.5}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

const axis = { fontSize: 10, fill: "#9aa0a6" };
