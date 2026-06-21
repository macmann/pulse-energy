// Shared data shapes for the Pulse Energy dataset (HH-1001 demo household).

export type Household = {
  household_id: string;
  name: string;
  city: string;
  residents: number;
  pv_kwp: number;
  battery_kwh: number;
  battery_power_kw: number;
  heat_pump: boolean;
  ev_charger: boolean;
  tariff_id: string;
  timeseries_file: string;
};

export type Tariff =
  | {
      tariff_id: "dynamic";
      name: string;
      type: "dynamic_hourly";
      description: string;
      spot_adder_eur_per_kwh: number;
      base_fee_eur_per_month: number;
      feed_in_eur_per_kwh: number;
      price_source: string;
    }
  | {
      tariff_id: "fixed";
      name: string;
      type: "fixed_rate";
      description: string;
      energy_rate_eur_per_kwh: number;
      base_fee_eur_per_month: number;
      feed_in_eur_per_kwh: number;
    };

export type MonthlyBill = {
  household_id: string;
  month: string; // "YYYY-MM"
  consumption_kwh: number;
  pv_production_kwh: number;
  grid_import_kwh: number;
  grid_export_kwh: number;
  energy_cost_eur: number;
  base_fee_eur: number;
  feed_in_credit_eur: number;
  total_bill_eur: number;
  self_sufficiency_pct: number;
};

export type InsightEvent = {
  household_id: string;
  type: "anomaly" | "nudge" | "insight";
  severity: "high" | "info" | string;
  period: string;
  title: string;
  detail: string;
  suggested_action: string;
};

export type SpotPrice = { timestamp: string; spot_price_eur_per_kwh: number };

export type Contract = {
  household_id: string;
  customer_name: string;
  supply_address: { city: string; country: string };
  provider: string;
  tariff_id: string;
  tariff_name: string;
  contract_start: string;
  contract_end: string;
  minimum_term_months: number;
  notice_period_weeks: number;
  auto_renew_months: number;
  base_fee_eur_per_month: number;
  energy_pricing: Record<string, string | number>;
  feed_in_eur_per_kwh: number;
  assets: Record<string, boolean | number>;
  contract_terms_text: string;
};

export type TimeseriesRecord = {
  timestamp: string;
  outdoor_temp_c: number;
  pv_production_kw: number;
  house_load_kw: number;
  heatpump_kw: number;
  ev_charging_kw: number;
  total_consumption_kw: number;
  battery_charge_kw: number;
  battery_discharge_kw: number;
  battery_soc_kwh: number;
  battery_soc_pct: number;
  grid_import_kw: number;
  grid_export_kw: number;
  price_eur_per_kwh: number;
};
