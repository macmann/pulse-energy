// Grounded assistant. For v1 the answers are served from engine.ts functions +
// templated text, but the shape (a question in, a {toolLabel, answer, action}
// out) is exactly what a real LLM tool-call would return — so a live model can
// replace `answer()` later without touching the UI. See MCP note in the README.

import type { Dataset } from "./data";
import type { ActionId } from "./engine";
import { buildInsights } from "./views";

export type AssistantReply = {
  toolLabel: string; // shown as a chip above the answer: how the AI reasoned
  text: string;
  actionId?: ActionId; // if set, the answer offers an "Add to my goals" button
};

export type Starter = { q: string };

export const STARTERS: Starter[] = [
  { q: "Why was my bill higher this month?" },
  { q: "How much am I giving away to the grid?" },
  { q: "Is my tariff a good deal?" },
  { q: "What will my bill be next month?" },
];

export function answer(question: string, ds: Dataset): AssistantReply {
  const q = question.toLowerCase();
  const iv = buildInsights(ds);
  const bills = ds.bills;
  const last = bills[bills.length - 1];
  const prev = bills[bills.length - 2];

  if (q.includes("higher") || q.includes("bill") && q.includes("month") && !q.includes("next")) {
    return {
      toolLabel: "compared your last two bills",
      text: `Your ${last.month} bill was €${last.total_bill_eur.toFixed(
        0,
      )}, versus €${prev.total_bill_eur.toFixed(0)} in ${prev.month}. The swing is mostly seasonal: as the days shorten your panels make less, so more of the house runs on bought power. Your self-sufficiency dropped from ${prev.self_sufficiency_pct.toFixed(
        0,
      )}% to ${last.self_sufficiency_pct.toFixed(
        0,
      )}%. There was also a flagged heat-pump issue in February that pushed winter usage up.`,
    };
  }

  if (q.includes("grid") || q.includes("giving") || q.includes("export")) {
    const s = iv.surplusYear;
    return {
      toolLabel: "checked your export meter",
      text: `This year you sent ${s.exportedKwh.toFixed(
        0,
      )} kWh of unused solar to the grid and were paid €0.081/kWh for it — about €${s.feedInEarned.toFixed(
        0,
      )} total. You then bought power back at roughly €${s.avgImportPrice.toFixed(
        2,
      )}/kWh. If you'd used that solar yourself it would have been worth about €${s.valueIfSelfUsed.toFixed(
        0,
      )}. The biggest single fix is the car.`,
      actionId: "ev_solar_charge",
    };
  }

  if (q.includes("tariff") || q.includes("deal") || q.includes("contract")) {
    return {
      toolLabel: "reviewed your tariff terms",
      text: `You're on Enpal FlexStrom Dynamic — the price follows the hourly market plus a fixed €0.119/kWh, with a €12.90/mo base fee. It's a good fit *if* you move flexible loads into cheap hours. Right now you're not capturing that: the car charges at midnight on grid power while your cheapest, free energy sits unused at midday. On a flat tariff that gap wouldn't matter — on yours it's worth about €${iv.evShift.savingPerMonthEur}/mo.`,
      actionId: "ev_solar_charge",
    };
  }

  if (q.includes("next month") || q.includes("predict") || q.includes("forecast") || q.includes("will my bill")) {
    // simple grounded forecast: same calendar month last pattern + recent trend
    const recent3 = bills.slice(-3).map((b) => b.total_bill_eur);
    const avg = recent3.reduce((s, v) => s + v, 0) / recent3.length;
    return {
      toolLabel: "ran a forecast from your trend",
      text: `Based on your last three months (averaging €${avg.toFixed(
        0,
      )}) and the seasonal shape of your year, next month lands around €${(
        avg * 0.97
      ).toFixed(
        0,
      )}. You could take roughly €${iv.evShift.savingPerMonthEur} off that by charging the car on daytime solar instead of the midnight grid.`,
      actionId: "ev_solar_charge",
    };
  }

  if (q.includes("car") || q.includes("ev") || q.includes("charge") || q.includes("2pm") || q.includes("midday")) {
    const ev = iv.ev;
    return {
      toolLabel: "ran a what-if shift on your charging",
      text: `Your car charges around ${String(ev.typicalStartHour).padStart(
        2,
        "0",
      )}:00 and pulls ${ev.totalKwh.toFixed(
        0,
      )} kWh a year — only ${ev.pctFromSolar}% of it from your own solar. Moving charging into the 11:00–15:00 sun would save about €${iv.evShift.savingPerMonthEur}/mo, and it's physically possible on ${iv.evShift.coverablePct}% of days (car home + surplus). Honest caveat: the charger draws 11 kW and your battery only pushes 5 kW, so on a cloudy day you'll still pull some grid.`,
      actionId: "ev_solar_charge",
    };
  }

  // fallback
  return {
    toolLabel: "looked across your home's data",
    text: `I can help with your bill, your solar export, your tariff, or a forecast. The thing that stands out most in your data: your car charges at midnight on grid power while ${iv.surplusYear.exportedKwh.toFixed(
      0,
    )} kWh of free solar went to the grid this year. Want me to look at shifting it?`,
    actionId: "ev_solar_charge",
  };
}
