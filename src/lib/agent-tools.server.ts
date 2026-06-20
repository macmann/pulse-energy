import { tool } from "ai";
import { z } from "zod";

import {
  buildLast30Days,
  buildTodayView,
  buildWeeklyView,
} from "./aggregations.server";
import {
  getContractFor,
  getHousehold,
  getInsightsFor,
  getMonthlyBillsFor,
  getTariff,
} from "./data-loader.server";
import { DEMO_NOW_HOUR } from "./demo-config";

// Build the per-request tool set for the agent. We close over the active
// householdId and the request origin (needed to fetch the CDN-hosted
// timeseries asset).
export function buildAgentTools(householdId: string, origin: string) {
  return {
    get_household_profile: tool({
      description:
        "Get the customer's household profile: name, city, residents, PV size, battery, heat pump, EV charger, tariff.",
      inputSchema: z.object({}),
      execute: async () => getHousehold(householdId),
    }),

    get_contract: tool({
      description:
        "Get the customer's Enpal contract: dates, term, notice period, auto-renew, base fee, feed-in rate, assets, and contract terms text.",
      inputSchema: z.object({}),
      execute: async () => getContractFor(householdId),
    }),

    get_tariff: tool({
      description:
        "Get the customer's electricity tariff details (dynamic hourly or fixed flat rate), including base fee and feed-in rate.",
      inputSchema: z.object({}),
      execute: async () => getTariff(getHousehold(householdId).tariff_id),
    }),

    get_current_price: tool({
      description:
        "Get the current retail electricity price (EUR/kWh) right now, plus the next 12 hours of prices for today, and the cheapest 3h window.",
      inputSchema: z.object({}),
      execute: async () => {
        const today = await buildTodayView(householdId, origin);
        const cur = today.hourly.find((h) => h.hour === DEMO_NOW_HOUR) ?? today.hourly[0];
        return {
          date: today.date,
          current_hour: cur.hour,
          current_price_eur_per_kwh: cur.price_eur_per_kwh,
          next_12h: today.hourly
            .slice(DEMO_NOW_HOUR, DEMO_NOW_HOUR + 12)
            .map((h) => ({ hour: h.hour, price_eur_per_kwh: h.price_eur_per_kwh })),
          cheapest_3h_window_today: today.cheapest_3h_window,
        };
      },
    }),

    estimate_appliance_cost: tool({
      description:
        "Estimate the cost in EUR to run an appliance of a given power (kW) for a given number of hours, starting now, using the current dynamic price.",
      inputSchema: z.object({
        power_kw: z.number().describe("Appliance power draw in kW (e.g. dishwasher ~1.5 kW)"),
        hours: z.number().describe("Run-time in hours"),
      }),
      execute: async ({ power_kw, hours }) => {
        const today = await buildTodayView(householdId, origin);
        const slice = today.hourly.slice(DEMO_NOW_HOUR, DEMO_NOW_HOUR + Math.ceil(hours));
        const avgPrice =
          slice.reduce((s, h) => s + h.price_eur_per_kwh, 0) / Math.max(slice.length, 1);
        const kwh = power_kw * hours;
        const cost = kwh * avgPrice;
        return {
          kwh_used: round(kwh, 2),
          avg_price_eur_per_kwh: round(avgPrice, 4),
          estimated_cost_eur: round(cost, 2),
          starting_hour: DEMO_NOW_HOUR,
        };
      },
    }),

    find_best_charging_window: tool({
      description:
        "Find the cheapest contiguous time window today to charge an EV or run a flexible load.",
      inputSchema: z.object({
        duration_hours: z.number().min(1).max(12).default(3),
      }),
      execute: async ({ duration_hours }) => {
        const today = await buildTodayView(householdId, origin);
        const hours = today.hourly;
        let bestStart = 0;
        let bestAvg = Infinity;
        for (let i = 0; i <= hours.length - duration_hours; i++) {
          const slice = hours.slice(i, i + duration_hours);
          const avg = slice.reduce((s, h) => s + h.price_eur_per_kwh, 0) / duration_hours;
          if (avg < bestAvg) {
            bestAvg = avg;
            bestStart = i;
          }
        }
        return {
          start_hour: hours[bestStart].hour,
          end_hour: hours[bestStart + duration_hours - 1].hour + 1,
          avg_price_eur_per_kwh: round(bestAvg, 4),
          duration_hours,
        };
      },
    }),

    get_monthly_bills: tool({
      description:
        "Get the list of monthly bills for the household (consumption, PV, grid import/export, cost, feed-in credit, total bill, self-sufficiency).",
      inputSchema: z.object({}),
      execute: async () => getMonthlyBillsFor(householdId),
    }),

    get_insights: tool({
      description:
        "Get pre-detected proactive insights: anomalies (e.g. heat pump faults), nudges (cheapest hours), and bill spikes.",
      inputSchema: z.object({}),
      execute: async () => getInsightsFor(householdId),
    }),

    get_today_summary: tool({
      description:
        "Get today's energy summary: PV produced, total consumption, grid import/export, heat pump kWh, EV kWh, energy cost, self-sufficiency, current battery %.",
      inputSchema: z.object({}),
      execute: async () => (await buildTodayView(householdId, origin)).summary,
    }),

    get_weekly_summary: tool({
      description:
        "Get this week's per-day summary plus total actual cost, baseline cost, savings, and loads-shifted info.",
      inputSchema: z.object({}),
      execute: async () => buildWeeklyView(householdId, origin),
    }),

    get_recent_consumption: tool({
      description:
        "Get a daily summary of the last N days (max 30) of energy use (PV, consumption, grid import/export, cost, self-sufficiency).",
      inputSchema: z.object({
        last_n_days: z.number().min(1).max(30).default(7),
      }),
      execute: async ({ last_n_days }) => {
        const r = await buildLast30Days(householdId, origin);
        return { days: r.days.slice(-last_n_days) };
      },
    }),
  };
}

function round(n: number, d: number) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}
