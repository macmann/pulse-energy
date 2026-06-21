import { Home, Repeat, MessageCircle, Sparkles } from "lucide-react";

export type Tab = "home" | "routines" | "assistant" | "insights";

const TABS: { id: Tab; label: string; Icon: typeof Home }[] = [
  { id: "home", label: "Home", Icon: Home },
  { id: "routines", label: "Routines", Icon: Repeat },
  { id: "assistant", label: "Assistant", Icon: MessageCircle },
  { id: "insights", label: "Energy Profile", Icon: Sparkles },
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
