// The dataset is a fixed 2025 history. We pick one demo "today" and one winter
// day the user can toggle where relevant. Never label anything "live" — use
// "as of <time>" instead.

export const HOUSEHOLD_ID = "HH-1001";

export const DEMO_TODAY = "2025-06-15"; // summer demo day
export const DEMO_WINTER = "2025-01-20"; // winter demo day
export const DEMO_NOW_HOUR = 13; // "as of 13:00"

// Tariff constants for HH-1001 (Enpal FlexStrom Dynamic).
export const SPOT_ADDER = 0.119; // retail = spot + adder
export const FEED_IN = 0.081; // €/kWh earned on export
export const BASE_FEE = 12.9; // €/month
