// Shared store for the recommend -> act -> impact loop. Home reminders, the AI
// assistant and the Goals screen all read/write the same per-recommendation
// "done" state, so acting in one place updates the others.

import { create } from "zustand";
import type { ActionId } from "../lib/engine";

type GoalsState = {
  done: Partial<Record<ActionId, boolean>>;
  toggle: (id: ActionId) => void;
  setDone: (id: ActionId, value: boolean) => void;
  isDone: (id: ActionId) => boolean;
};

export const useGoals = create<GoalsState>((set, get) => ({
  done: {},
  toggle: (id) => set((s) => ({ done: { ...s.done, [id]: !s.done[id] } })),
  setDone: (id, value) => set((s) => ({ done: { ...s.done, [id]: value } })),
  isDone: (id) => !!get().done[id],
}));
