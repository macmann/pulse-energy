import { useEffect, useState } from "react";
import { BottomNav, type Tab } from "./components/BottomNav";
import { ProfileMenu } from "./components/ProfileMenu";
import { loadDataset, type Dataset } from "./lib/data";
import { Home } from "./screens/Home";
import { Consumption } from "./screens/Consumption";
import { Goals } from "./screens/Goals";
import { Assistant } from "./screens/Assistant";

const SESSION_KEY = "pulse-household-id";
const LOGO_SRC = "https://i.ibb.co/tTwKJb9z/Gemini-Generated-Image-h9rtruh9rtruh9rt.png";

export function App() {
  const [householdId, setHouseholdId] = useState(() => localStorage.getItem(SESSION_KEY) ?? "");
  const [loginInput, setLoginInput] = useState(householdId);
  const [ds, setDs] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  // When a Home card deep-links into Consumption, we stash the anchor id here.
  const [scrollTo, setScrollTo] = useState<string | null>(null);

  useEffect(() => {
    if (!householdId) return;
    setDs(null);
    setError(null);
    loadDataset(householdId)
      .then(setDs)
      .catch((e) => {
        localStorage.removeItem(SESSION_KEY);
        setHouseholdId("");
        setError(String(e));
      });
  }, [householdId]);

  // Navigate to Consumption and remember which report to scroll to.
  function openReport(reportId: string) {
    setScrollTo(reportId);
    setTab("consumption");
  }

  function login() {
    const nextId = loginInput.trim().toUpperCase();
    if (!nextId) return;
    localStorage.setItem(SESSION_KEY, nextId);
    setHouseholdId(nextId);
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    setHouseholdId("");
    setLoginInput("");
    setDs(null);
    setTab("home");
  }

  if (!householdId) {
    return (
      <div className="login-screen">
        <div className="login-card card card-pad">
          <img className="login-logo" src={LOGO_SRC} alt="Enpal logo" />
          <h1>Log in to Enpal Pulse</h1>
          <p className="muted">Enter your household ID to load that household's data. No password is needed for this prototype.</p>
          {error && <p className="error-text">{error}</p>}
          <form onSubmit={(e) => { e.preventDefault(); login(); }}>
            <label htmlFor="household-id">Household ID</label>
            <input id="household-id" value={loginInput} onChange={(e) => setLoginInput(e.target.value)} placeholder="HH-1001" autoCapitalize="characters" />
            <button className="btn btn-accent btn-block" type="submit">Log in</button>
          </form>
          <p className="tiny muted">Try HH-1001, HH-1002, HH-1003 or HH-1004.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading">
        <p>Couldn't load your energy data.</p>
        <p className="tiny muted">{error}</p>
      </div>
    );
  }

  if (!ds) {
    return (
      <div className="loading">
        <div className="spinner" />
        <p className="muted">Reading your meter…</p>
      </div>
    );
  }

  return (
    <>
      <header className="app-header" aria-label="Enpal Pulse header">
        <img
          className="app-header-logo"
          src={LOGO_SRC}
          alt="Enpal logo"
        />
        <ProfileMenu ds={ds} onLogout={logout} />
      </header>
      {tab === "home" && <Home ds={ds} onOpenReport={openReport} />}
      {tab === "goals" && <Goals ds={ds} />}
      {tab === "assistant" && <Assistant ds={ds} householdId={ds.household.household_id} onGoGoals={() => setTab("goals")} />}
      {tab === "consumption" && (
        <Consumption ds={ds} scrollTo={scrollTo} onScrolled={() => setScrollTo(null)} />
      )}
      <BottomNav active={tab} onChange={setTab} />
    </>
  );
}
