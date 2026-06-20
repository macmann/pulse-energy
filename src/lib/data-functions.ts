import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import { z } from "zod";

import {
  buildLast30Days,
  buildTodayView,
  buildWeeklyView,
  getContractView,
  getHouseholdView,
  getInsightsView,
  getMonthlyBillsView,
} from "./aggregations.server";
import { listHouseholds } from "./data-loader.server";

const householdInput = z.object({ householdId: z.string() });

function origin() {
  return getRequestURL().origin;
}

export const listHouseholdsFn = createServerFn({ method: "GET" }).handler(async () => {
  return listHouseholds();
});

export const getHouseholdSummaryFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => householdInput.parse(input))
  .handler(async ({ data }) => {
    const [view, today, bills, insights] = await Promise.all([
      Promise.resolve(getHouseholdView(data.householdId)),
      buildTodayView(data.householdId, origin()),
      Promise.resolve(getMonthlyBillsView(data.householdId)),
      Promise.resolve(getInsightsView(data.householdId)),
    ]);
    return { ...view, today, bills, insights };
  });

export const getWeeklyViewFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => householdInput.parse(input))
  .handler(async ({ data }) => {
    const [weekly, insights, bills] = await Promise.all([
      buildWeeklyView(data.householdId, origin()),
      Promise.resolve(getInsightsView(data.householdId)),
      Promise.resolve(getMonthlyBillsView(data.householdId)),
    ]);
    return { weekly, insights, bills };
  });

export const getContractFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => householdInput.parse(input))
  .handler(async ({ data }) => getContractView(data.householdId));

export const getLast30Fn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => householdInput.parse(input))
  .handler(async ({ data }) => buildLast30Days(data.householdId, origin()));
