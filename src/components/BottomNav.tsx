import { ChartColumn, Home, MessageCircle, Target } from "lucide-react";

export type Tab = "home" | "assistant" | "consumption" | "goals";

const TABS: { id: Tab; label: string; Icon: typeof Home }[] = [
  { id: "home", label: "Home", Icon: Home },
  { id: "assistant", label: "Assistant", Icon: MessageCircle },
  { id: "consumption", label: "Consumption", Icon: ChartColumn },
  { id: "goals", label: "Recommendations", Icon: Target },
];

export function BottomNav({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <nav className="bottom-nav">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={`nav-btn${active === id ? " active" : ""}`}
          onClick={() => onChange(id)}
          aria-current={active === id ? "page" : undefined}
        >
          <span className="nav-icon">
            <Icon size={20} strokeWidth={active === id ? 2.4 : 2} />
          </span>
          <span className="nav-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
