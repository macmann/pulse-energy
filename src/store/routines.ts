// Shared store for the loop: recommend -> set routine -> grade against meter ->
// adherence feeds back into the bill. Home reminders, the AI assistant and the
// Routines screen all read/write this.

import { create } from "zustand";

// A 7-day streak. "did" = meter confirms it happened; "missed" = it didn't;
// "would" = counterfactual (only shown when the "if I'd followed all 3" sim is on).
export type DayMark = "did" | "missed" | "would";

export type Routine = {
  id: string;
  title: string;
  body: string; // plain-language description
  icon: "ev" | "appliances" | "preheat";
  load: "ev_charging_kw" | "house_load_kw" | "heatpump_kw";
  window: [number, number]; // target hours [start, end)
  streak: DayMark[]; // length 7, real adherence from the meter
  saveEur: number; // modelled €/month if followed
};

// Seeded from the meter (see engine + Insights). EV is the big one and the meter
// shows it's NOT happening yet (midnight grid charging) -> all 7 missed.
export const SEED_ROUTINES: Routine[] = [
  {
    id: "ev-on-solar",
    title: "Charge the car on sunshine",
    body: "Move EV charging from midnight to the midday solar window (11:00–15:00) on days the car is home.",
    icon: "ev",
    load: "ev_charging_kw",
    window: [11, 15],
    streak: ["missed", "missed", "missed", "missed", "missed", "missed", "missed"],
    saveEur: 31,
  },
  {
    id: "appliances-midday",
    title: "Run appliances at midday",
    body: "Start the dishwasher and laundry between 11:00 and 15:00 when your panels are making free power.",
    icon: "appliances",
    load: "house_load_kw",
    window: [11, 15],
    streak: ["missed", "did", "missed", "missed", "did", "missed", "missed"],
    saveEur: 6,
  },
  {
    id: "preheat-cheap",
    title: "Pre-heat in cheap hours",
    body: "Let the heat pump warm the house during sunny or low-price hours instead of the evening peak.",
    icon: "preheat",
    load: "heatpump_kw",
    window: [11, 16],
    streak: ["did", "missed", "did", "did", "missed", "did", "missed"],
    saveEur: 9,
  },
];

type RoutineState = {
  routines: Routine[];
  simulateAll: boolean; // "if I'd followed all 3" toggle on the Routines screen
  addRoutine: (r: Routine) => void;
  hasRoutine: (id: string) => boolean;
  setSimulateAll: (on: boolean) => void;
};

export const useRoutines = create<RoutineState>((set, get) => ({
  routines: [],
  simulateAll: false,
  addRoutine: (r) =>
    set((s) =>
      s.routines.some((x) => x.id === r.id)
        ? s
        : { routines: [...s.routines, r] },
    ),
  hasRoutine: (id) => get().routines.some((r) => r.id === id),
  setSimulateAll: (on) => set({ simulateAll: on }),
}));

// Count "did" days in a streak (real adherence).
export function streakScore(streak: DayMark[]): number {
  return streak.filter((d) => d === "did").length;
}

// Find a seed routine by id (used by reminders / assistant "Set this routine").
export function seedRoutine(id: string): Routine | undefined {
  return SEED_ROUTINES.find((r) => r.id === id);
}
