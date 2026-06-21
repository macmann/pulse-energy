import { useEffect, useMemo, useState } from "react";
import { LogOut, Plus, UserRound, X } from "lucide-react";
import type { Dataset } from "../lib/data";

const STORAGE_PREFIX = "pulse-devices-";

type ProfileTab = "devices" | "contracts";

type Props = {
  ds: Dataset;
  onLogout: () => void;
};

export function ProfileMenu({ ds, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<ProfileTab>("devices");
  const storageKey = `${STORAGE_PREFIX}${ds.household.household_id}`;
  const defaultDevices = useMemo(() => {
    const devices = ["Solar PV", "Home battery"];
    if (ds.household.heat_pump) devices.push("Heat pump");
    if (ds.household.ev_charger) devices.push("EV charger");
    return devices;
  }, [ds.household]);
  const [devices, setDevices] = useState<string[]>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? (JSON.parse(saved) as string[]) : defaultDevices;
  });
  const [newDevice, setNewDevice] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    setDevices(saved ? (JSON.parse(saved) as string[]) : defaultDevices);
    setNewDevice("");
    setTab("devices");
  }, [defaultDevices, storageKey]);

  function saveDevices(next: string[]) {
    setDevices(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function addDevice() {
    const name = newDevice.trim();
    if (!name || devices.some((d) => d.toLowerCase() === name.toLowerCase())) return;
    saveDevices([...devices, name]);
    setNewDevice("");
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
                <p className="tiny muted">Add appliances you use so Pulse can include them in consumption estimates and recommendations.</p>
                <div className="device-list">
                  {devices.map((device) => <span className="device-chip" key={device}>{device}</span>)}
                </div>
                <form className="add-device" onSubmit={(e) => { e.preventDefault(); addDevice(); }}>
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
