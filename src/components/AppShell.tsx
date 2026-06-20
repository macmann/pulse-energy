import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronDown, Home, MessageCircle, Sparkles } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import households from "@/data/raw/households.json";
import { DEFAULT_HOUSEHOLD_ID } from "@/lib/demo-config";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/chat", label: "Chat", icon: MessageCircle },
  { to: "/insights", label: "Insights", icon: Sparkles },
] as const;

type HouseholdLite = { household_id: string; name: string; city: string };

const HOUSEHOLDS = households as HouseholdLite[];

export function useActiveHouseholdId(): string {
  const search = useSearch({ strict: false }) as { hh?: string };
  const id = search.hh;
  return id && HOUSEHOLDS.some((h) => h.household_id === id) ? id : DEFAULT_HOUSEHOLD_ID;
}

export function AppShell({ children }: { children: ReactNode }) {
  const activeId = useActiveHouseholdId();
  const active = useMemo(
    () => HOUSEHOLDS.find((h) => h.household_id === activeId) ?? HOUSEHOLDS[0],
    [activeId],
  );
  const navigate = useNavigate();

  const onChange = (id: string) => {
    navigate({ to: ".", search: (prev: Record<string, unknown>) => ({ ...prev, hh: id }) });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="bg-navy text-white">
        <div className="mx-auto max-w-5xl px-5 py-4 flex items-center justify-between gap-4">
          <Link to="/" search={{ hh: activeId }} className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-cta flex items-center justify-center">
              <span className="text-navy font-display text-lg">E</span>
            </div>
            <div className="leading-tight">
              <div className="font-display text-lg text-white">Enpal Pulse</div>
              <div className="text-xs text-white/60 -mt-0.5 hidden sm:block">Smart energy companion</div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {/* Household picker */}
            <label className="relative">
              <span className="sr-only">Switch household</span>
              <select
                value={activeId}
                onChange={(e) => onChange(e.target.value)}
                className="appearance-none bg-white/10 hover:bg-white/15 transition text-white text-sm font-semibold rounded-xl pl-3 pr-9 py-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cta"
                aria-label="Active household"
              >
                {HOUSEHOLDS.map((h) => (
                  <option key={h.household_id} value={h.household_id} className="text-navy">
                    {h.name} · {h.city}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-white/70" />
            </label>

            <nav className="hidden sm:flex items-center gap-1 ml-2">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  search={{ hh: activeId }}
                  className="px-3 py-2 rounded-xl text-sm font-semibold text-white/70 hover:text-white hover:bg-white/5 transition"
                  activeProps={{ className: "px-3 py-2 rounded-xl text-sm font-semibold text-navy bg-cta" }}
                  activeOptions={{ exact: true }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
        {active && (
          <div className="mx-auto max-w-5xl px-5 pb-3 text-xs text-white/55 sm:hidden">
            Viewing as {active.name}
          </div>
        )}
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-5 py-8 pb-28 sm:pb-12">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-border z-50">
        <div className="mx-auto max-w-5xl grid grid-cols-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                search={{ hh: activeId }}
                className="flex flex-col items-center gap-1 py-3 text-stone"
                activeProps={{ className: "flex flex-col items-center gap-1 py-3 text-navy" }}
                activeOptions={{ exact: true }}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-semibold">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
