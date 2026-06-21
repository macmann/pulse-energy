import { useEffect, useMemo, useState } from "react";
import { LogOut, Plus, UserRound, X } from "lucide-react";
import type { Dataset } from "../lib/data";

const STORAGE_PREFIX = "pulse-devices-";

type ProfileTab = "devices" | "contracts";

// Built-in energy assets are shown from the household record and can't be
// edited away, so we keep their names out of the user-added appliance list
// (older saved lists may still contain them).
const CORE_NAMES = ["solar pv", "solar panels", "home battery", "battery", "heat pump", "ev charger"];

type Props = {
  ds: Dataset;
  onLogout: () => void;
};

export function ProfileMenu({ ds, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<ProfileTab>("devices");
  const storageKey = `${STORAGE_PREFIX}${ds.household.household_id}`;

  const coreDevices = useMemo(() => {
    const h = ds.household;
    const list = [
      { key: "solar", emoji: "☀️", title: "Solar panels", spec: `${h.pv_kwp} kWp on the roof` },
      { key: "battery", emoji: "🔋", title: "Battery", spec: `${h.battery_kwh} kWh · up to ${h.battery_power_kw} kW` },
    ];
    if (h.heat_pump) list.push({ key: "heatpump", emoji: "🌡️", title: "Heat pump", spec: "9 kW" });
    if (h.ev_charger) list.push({ key: "ev", emoji: "🚗", title: "EV charger", spec: "Car battery 60 kWh" });
    return list;
  }, [ds.household]);

  const loadAppliances = (): string[] => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return [];
    const list = JSON.parse(saved) as string[];
    return list.filter((d) => !CORE_NAMES.includes(d.trim().toLowerCase()));
  };
  const [appliances, setAppliances] = useState<string[]>(loadAppliances);
  const [newDevice, setNewDevice] = useState("");

  useEffect(() => {
    setAppliances(loadAppliances());
    setNewDevice("");
    setTab("devices");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function saveAppliances(next: string[]) {
    setAppliances(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function addAppliance() {
    const name = newDevice.trim();
    if (!name) return;
    const lower = name.toLowerCase();
    if (CORE_NAMES.includes(lower) || appliances.some((d) => d.toLowerCase() === lower)) return;
    saveAppliances([...appliances, name]);
    setNewDevice("");
  }

  function removeAppliance(name: string) {
    saveAppliances(appliances.filter((d) => d !== name));
  }

  const c = ds.contract;

  return (
    <div className="profile-wrap">
      <button className="profile-button" onClick={() => setOpen(true)} aria-label="Open profile">
        <UserRound size={19} />
      </button>
      {open && (
        <div className="profile-backdrop" onClick={() => setOpen(false)}>
          <aside className="profile-panel" onClick={(e) => e.stopPropagation()} aria-label="My profile">
            <div className="between">
              <div>
                <h2 style={{ fontSize: 18 }}>My profile</h2>
                <div className="tiny muted">{ds.household.name} · {ds.household.household_id}</div>
              </div>
              <button className="icon-button" onClick={() => setOpen(false)} aria-label="Close profile"><X size={18} /></button>
            </div>

            <div className="profile-tabs">
              <button className={tab === "devices" ? "active" : ""} onClick={() => setTab("devices")}>My devices</button>
              <button className={tab === "contracts" ? "active" : ""} onClick={() => setTab("contracts")}>Contracts</button>
            </div>

            {tab === "devices" ? (
              <div className="stack">
                <div className="section-label">Your devices</div>
                <div className="device-cards">
                  {coreDevices.map((d) => (
                    <div className="device-row" key={d.key}>
                      <span className="device-emoji" aria-hidden="true">{d.emoji}</span>
                      <div className="device-info">
                        <div className="device-name">{d.title}</div>
                        <div className="device-spec">{d.spec}</div>
                      </div>
                      <span className="device-status">Active</span>
                    </div>
                  ))}
                  {appliances.map((name) => (
                    <div className="device-row" key={name}>
                      <span className="device-emoji" aria-hidden="true">🔌</span>
                      <div className="device-info">
                        <div className="device-name">{name}</div>
                        <div className="device-spec">Appliance</div>
                      </div>
                      <button
                        className="device-remove"
                        onClick={() => removeAppliance(name)}
                        aria-label={`Remove ${name}`}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="tiny muted">Add appliances you use so Pulse can include them in consumption estimates and recommendations.</p>
                <form className="add-device" onSubmit={(e) => { e.preventDefault(); addAppliance(); }}>
                  <input value={newDevice} onChange={(e) => setNewDevice(e.target.value)} placeholder="e.g. Dishwasher, dryer" />
                  <button className="btn btn-accent" type="submit"><Plus size={16} /> Add</button>
                </form>
              </div>
            ) : (
              <div className="contract-card">
                <div className="contract-title">{c.tariff_name}</div>
                <div className="tiny muted">{c.provider} · {c.supply_address.city}, {c.supply_address.country}</div>
                <dl className="contract-details">
                  <div><dt>Start</dt><dd>{c.contract_start}</dd></div>
                  <div><dt>End</dt><dd>{c.contract_end}</dd></div>
                  <div><dt>Base fee</dt><dd>€{c.base_fee_eur_per_month.toFixed(2)}/month</dd></div>
                  <div><dt>Feed-in</dt><dd>€{c.feed_in_eur_per_kwh.toFixed(3)}/kWh</dd></div>
                  <div><dt>Notice</dt><dd>{c.notice_period_weeks} weeks</dd></div>
                  <div><dt>Renewal</dt><dd>{c.auto_renew_months} months</dd></div>
                </dl>
                <p className="tiny muted">{c.contract_terms_text}</p>
              </div>
            )}

            <button className="btn btn-ghost btn-block" onClick={onLogout}><LogOut size={16} /> Log out</button>
          </aside>
        </div>
      )}
    </div>
  );
}
