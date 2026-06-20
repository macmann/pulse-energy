import { Battery, Car, Flame, Home, Sun, Zap } from "lucide-react";

export type EnergyFlowSnapshot = {
  pv_kw: number;
  house_load_kw: number;
  heatpump_kw: number;
  ev_kw: number;
  battery_charge_kw: number;
  battery_discharge_kw: number;
  battery_soc_pct: number;
  grid_import_kw: number;
  grid_export_kw: number;
  price_eur_per_kwh: number;
};

// Brand-tuned colors (Enpal): Grass Green for production / export flow,
// CTA Yellow accents on key totals, a brand-friendly red for consumption /
// grid import flow. All on the Downriver navy surface.
const C = {
  produce: "#76BE74", // Grass Green
  consume: "#FF6B6B", // brand-friendly red (not the harsh destructive)
  idle: "#1B3A5C",
  border: "rgba(255,255,255,0.10)",
  text: "rgba(255,255,255,0.65)",
  white: "#ffffff",
  cta: "#FFD233",
} as const;

function fmt(kw: number) {
  return kw < 0.05 ? "0.0" : kw.toFixed(1);
}

type FlowProps = {
  d: string;
  active: boolean;
  produce: boolean; // true = green producing-to-house / exporting; false = red consuming
  magnitude: number; // kW
  reverse?: boolean;
};

function Flow({ d, active, produce, magnitude, reverse }: FlowProps) {
  if (!active) {
    return <path d={d} stroke={C.idle} strokeWidth={2} fill="none" strokeLinecap="round" />;
  }
  const color = produce ? C.produce : C.consume;
  const width = Math.max(2.2, Math.min(5, 2 + magnitude * 0.7));
  // duration shrinks with magnitude — bigger flow moves faster.
  const dur = Math.max(0.9, 2.8 - Math.min(2, magnitude * 0.35));
  return (
    <>
      <path d={d} stroke={C.idle} strokeWidth={2} fill="none" strokeLinecap="round" />
      <path
        d={d}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray="6 10"
        fill="none"
        style={{
          filter: `drop-shadow(0 0 6px ${color}66)`,
        }}
      >
        <animate
          attributeName="stroke-dashoffset"
          from={reverse ? "0" : "16"}
          to={reverse ? "16" : "0"}
          dur={`${dur}s`}
          repeatCount="indefinite"
        />
      </path>
    </>
  );
}

function Node({
  cx,
  cy,
  icon,
  label,
  value,
  unit,
  tone,
  size = 56,
}: {
  cx: number;
  cy: number;
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  tone: "produce" | "consume" | "idle" | "house";
  size?: number;
}) {
  const ring =
    tone === "produce"
      ? C.produce
      : tone === "consume"
        ? C.consume
        : tone === "house"
          ? C.cta
          : "rgba(255,255,255,0.20)";
  const valColor =
    tone === "produce" ? C.produce : tone === "consume" ? C.consume : tone === "house" ? C.cta : C.text;
  return (
    <foreignObject x={cx - 60} y={cy - size / 2 - 4} width={120} height={size + 56}>
      <div className="flex flex-col items-center text-center select-none">
        <div
          className="flex items-center justify-center rounded-2xl"
          style={{
            width: size,
            height: size,
            background: tone === "house" ? "rgba(255,210,51,0.10)" : "rgba(255,255,255,0.04)",
            border: `1.5px solid ${ring}`,
            boxShadow: tone !== "idle" ? `0 0 24px -6px ${ring}55` : "none",
            color: tone === "house" ? C.cta : tone === "produce" ? C.produce : tone === "consume" ? C.consume : C.white,
          }}
        >
          {icon}
        </div>
        <div className="mt-2 text-[11px] uppercase tracking-[0.14em] font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>
          {label}
        </div>
        <div className="mt-0.5 leading-none">
          <span className="text-base font-semibold" style={{ color: valColor }}>
            {value}
          </span>
          <span className="text-[11px] ml-1" style={{ color: "rgba(255,255,255,0.50)" }}>
            {unit}
          </span>
        </div>
      </div>
    </foreignObject>
  );
}

export function EnergyFlow({ snapshot }: { snapshot: EnergyFlowSnapshot }) {
  const s = snapshot;
  const exporting = s.grid_export_kw > 0.05;
  const charging = s.battery_charge_kw > 0.05;
  const discharging = s.battery_discharge_kw > 0.05;
  const hpOn = s.heatpump_kw > 0.05;
  const evOn = s.ev_kw > 0.05;
  const importing = s.grid_import_kw > 0.05;
  const pvOn = s.pv_kw > 0.05;

  // Layout on a 720 x 460 canvas — house at center, sources orbit around.
  const cx = 360,
    cy = 230;

  // Status line
  const headline = exporting
    ? "Exporting clean energy"
    : pvOn && !importing
      ? "Running on your own solar"
      : importing
        ? "Importing from grid"
        : discharging
          ? "Running on your battery"
          : "Idle";
  const headlineColor = exporting || (pvOn && !importing) || discharging ? C.produce : importing ? C.consume : C.text;

  return (
    <section
      className="relative overflow-hidden rounded-[28px] border"
      style={{
        background:
          "linear-gradient(135deg, #072543 0%, #0a2d52 55%, #0c386a 100%)",
        borderColor: C.border,
        boxShadow: "0 30px 80px -40px rgba(7,37,67,0.55)",
      }}
    >
      {/* ambient glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -left-20 w-[420px] h-[420px] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(118,190,116,0.18), transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-16 w-[420px] h-[420px] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(255,210,51,0.10), transparent 70%)" }}
      />

      <div className="relative px-6 pt-6 md:px-8 md:pt-8 flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.55)" }}>
            Live energy flow
          </div>
          <h2 className="mt-1 text-white" style={{ color: headlineColor }}>
            {headline}
          </h2>
          <div className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
            {s.price_eur_per_kwh > 0
              ? <>Current price <span className="text-white font-semibold">€{s.price_eur_per_kwh.toFixed(2)}/kWh</span></>
              : "—"}
          </div>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.16em]"
          style={{ background: "rgba(118,190,116,0.12)", color: C.produce, border: `1px solid ${C.produce}33` }}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: C.produce }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: C.produce }} />
          </span>
          Live
        </div>
      </div>

      <div className="relative w-full">
        <svg viewBox="0 0 720 500" className="w-full h-auto block" preserveAspectRatio="xMidYMid meet">
          {/* CONNECTORS */}
          {/* Solar (top center) -> House */}
          <Flow d={`M ${cx} 110 Q ${cx} 170 ${cx} ${cy - 38}`} active={pvOn} produce magnitude={s.pv_kw} />
          {/* Battery (left) -> House (discharge) or House -> Battery (charge) */}
          <Flow
            d={`M 130 ${cy} Q 220 ${cy} ${cx - 38} ${cy}`}
            active={charging || discharging}
            produce={discharging}
            magnitude={Math.max(s.battery_charge_kw, s.battery_discharge_kw)}
            reverse={charging}
          />
          {/* Grid (right) <-> House  */}
          <Flow
            d={`M ${cx + 38} ${cy} Q 500 ${cy} 590 ${cy}`}
            active={importing || exporting}
            produce={exporting}
            magnitude={Math.max(s.grid_import_kw, s.grid_export_kw)}
            reverse={exporting}
          />
          {/* House -> Heat pump (bottom left) */}
          <Flow
            d={`M ${cx - 22} ${cy + 30} Q 240 ${cy + 100} 175 ${cy + 150}`}
            active={hpOn}
            produce={false}
            magnitude={s.heatpump_kw}
          />
          {/* House -> EV (bottom right) */}
          <Flow
            d={`M ${cx + 22} ${cy + 30} Q 480 ${cy + 100} 545 ${cy + 150}`}
            active={evOn}
            produce={false}
            magnitude={s.ev_kw}
          />

          {/* NODES */}
          <Node
            cx={cx}
            cy={90}
            icon={<Sun className="w-6 h-6" />}
            label="Solar"
            value={fmt(s.pv_kw)}
            unit="kW"
            tone={pvOn ? "produce" : "idle"}
          />
          <Node
            cx={110}
            cy={cy}
            icon={<Battery className="w-6 h-6" />}
            label={charging ? "Charging" : discharging ? "Discharging" : "Battery"}
            value={`${Math.round(s.battery_soc_pct)}`}
            unit="%"
            tone={discharging ? "produce" : charging ? "consume" : "idle"}
          />
          <Node
            cx={610}
            cy={cy}
            icon={<Zap className="w-6 h-6" />}
            label={exporting ? "Export" : importing ? "Import" : "Grid"}
            value={fmt(exporting ? s.grid_export_kw : s.grid_import_kw)}
            unit="kW"
            tone={exporting ? "produce" : importing ? "consume" : "idle"}
          />
          <Node
            cx={175}
            cy={cy + 170}
            icon={<Flame className="w-5 h-5" />}
            label="Heat pump"
            value={fmt(s.heatpump_kw)}
            unit="kW"
            tone={hpOn ? "consume" : "idle"}
            size={48}
          />
          <Node
            cx={545}
            cy={cy + 170}
            icon={<Car className="w-5 h-5" />}
            label="EV"
            value={fmt(s.ev_kw)}
            unit="kW"
            tone={evOn ? "consume" : "idle"}
            size={48}
          />

          {/* CENTER: House */}
          <Node
            cx={cx}
            cy={cy}
            icon={<Home className="w-7 h-7" />}
            label="Home now"
            value={fmt(s.house_load_kw)}
            unit="kW"
            tone="house"
            size={76}
          />
        </svg>
      </div>
    </section>
  );
}
