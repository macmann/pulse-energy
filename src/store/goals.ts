// Shared store for the recommend -> act -> impact loop. Home reminders, the AI
// assistant and the Recommendations screen all read/write the same per-recommendation
// "done" state, so acting in one place updates the others.
//
// "done" (banks savings into the Goals total) and "remind" (the reminder pill on
// the action card) are independent — acting and reminding are separate intents.

import { create } from "zustand";
import type { ActionId } from "../lib/engine";

type GoalsState = {
  done: Partial<Record<ActionId, boolean>>;
  remind: Partial<Record<ActionId, boolean>>;
  toggle: (id: ActionId) => void;
  setDone: (id: ActionId, value: boolean) => void;
  isDone: (id: ActionId) => boolean;
  toggleRemind: (id: ActionId) => void;
  isReminded: (id: ActionId) => boolean;
};

export const useGoals = create<GoalsState>((set, get) => ({
  done: {},
  remind: {},
  toggle: (id) => set((s) => ({ done: { ...s.done, [id]: !s.done[id] } })),
  setDone: (id, value) => set((s) => ({ done: { ...s.done, [id]: value } })),
  isDone: (id) => !!get().done[id],
  toggleRemind: (id) =>
    set((s) => ({ remind: { ...s.remind, [id]: !s.remind[id] } })),
  isReminded: (id) => !!get().remind[id],
}));
