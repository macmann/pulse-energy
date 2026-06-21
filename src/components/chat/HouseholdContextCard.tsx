import { Sun, Battery, Thermometer, Car } from "lucide-react";

type Props = { data: any };

export function HouseholdContextCard({ data }: Props) {
  const h = data ?? {};
  const assets = h.assets ?? {};
  const tariff = h.tariff ?? {};

  // Check if each asset is present
  const hasPv = assets.solar_pv_kwp != null && assets.solar_pv_kwp > 0;
  const hasBattery = assets.battery_kwh != null && assets.battery_kwh > 0;
  const hasHeatPump = !!assets.heat_pump;
  const hasEv = !!assets.ev_charger;

  return (
    <div className="card tool-result household-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{h.name ?? "Household Setup"}</div>
          <div className="muted" style={{ fontSize: 13 }}>
            {h.city ?? "—"} · {h.residents ?? "?"} residents
          </div>
        </div>
      </div>

      {(hasPv || hasBattery || hasHeatPump || hasEv) && (
        <div className="assets-grid" style={{ marginTop: 10 }}>
          {hasPv && (
            <div className="asset-item">
              <Sun size={16} />
              <span>PV {assets.solar_pv_kwp} kWp</span>
            </div>
          )}
          {hasBattery && (
            <div className="asset-item">
              <Battery size={16} />
              <span>Battery {assets.battery_kwh} kWh</span>
            </div>
          )}
          {hasHeatPump && (
            <div className="asset-item">
              <Thermometer size={16} />
              <span>Heat Pump {assets.heat_pump_kw ? `(${assets.heat_pump_kw} kW)` : "✓"}</span>
            </div>
          )}
          {hasEv && (
            <div className="asset-item">
              <Car size={16} />
              <span>EV Charger {assets.ev_battery_kwh ? `(${assets.ev_battery_kwh} kWh)` : "✓"}</span>
            </div>
          )}
        </div>
      )}

      {(tariff.name || tariff.type) && (
        <div style={{ marginTop: 12, fontSize: 13, color: "var(--muted)", borderTop: "1px solid var(--line)", paddingTop: 8 }}>
          Tariff: <strong style={{ color: "var(--ink)" }}>{tariff.name ?? "—"}</strong>
          {tariff.type && <span> ({tariff.type === "dynamic_hourly" ? "Dynamic" : "Fixed"})</span>}
        </div>
      )}
    </div>
  );
}
