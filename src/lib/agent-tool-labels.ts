// Client-safe labels for the tools defined in agent-tools.server.ts.
// Kept separate so the client bundle never imports the server module.
export const toolSourceLabels = {
  get_household_profile: "household profile",
  get_contract: "contract",
  get_tariff: "tariff",
  get_current_price: "live prices",
  estimate_appliance_cost: "live prices",
  find_best_charging_window: "live prices",
  get_monthly_bills: "monthly bills",
  get_insights: "insights",
  get_today_summary: "today's energy",
  get_weekly_summary: "weekly energy",
  get_recent_consumption: "consumption history",
} as const;
