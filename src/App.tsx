import { useEffect, useState } from "react";
import { BottomNav, type Tab } from "./components/BottomNav";
import { loadDataset, type Dataset } from "./lib/data";
import { Home } from "./screens/Home";
import { Insights } from "./screens/Insights";
import { Routines } from "./screens/Routines";
import { Assistant } from "./screens/Assistant";

export function App() {
  const [ds, setDs] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  // When a Home card deep-links into Insights, we stash the anchor id here.
  const [scrollTo, setScrollTo] = useState<string | null>(null);

  useEffect(() => {
    loadDataset()
      .then(setDs)
      .catch((e) => setError(String(e)));
  }, []);

  // Navigate to Insights and remember which report to scroll to.
  function openReport(reportId: string) {
    setScrollTo(reportId);
    setTab("insights");
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
      {tab === "home" && <Home ds={ds} onOpenReport={openReport} onGoAssistant={() => setTab("assistant")} />}
      {tab === "routines" && <Routines ds={ds} />}
      {tab === "assistant" && <Assistant ds={ds} onGoRoutines={() => setTab("routines")} />}
      {tab === "insights" && (
        <Insights ds={ds} scrollTo={scrollTo} onScrolled={() => setScrollTo(null)} />
      )}
      <BottomNav active={tab} onChange={setTab} />
    </>
  );
}
