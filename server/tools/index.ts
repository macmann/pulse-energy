import { tool } from 'ai';
import {
  getHouseholdContextSchema,
  requestMissingInfoSchema,
  calculateShiftSavingsSchema,
  simulateTariffSwitchSchema,
  setRoutineReminderSchema,
} from './schemas.ts';
import {
  getHousehold,
  getContract,
  getTariff,
  getTariffs,
  getTimeseries,
  getSpotPrices,
  getRecordsForTimeRange,
} from '../lib/dataAccess.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Demo "today" — all time-relative logic anchors here. */
const DEMO_TODAY = '2025-06-15';

/** Typical power draw per appliance (kW). */
const APPLIANCE_POWER_KW: Record<string, number> = {
  dishwasher: 1.8,
  washing_machine: 2.0,
  dryer: 2.5,
  ev_charger: 11,
  heat_pump: 9,
};

/** Typical cycle duration per appliance (hours). */
const APPLIANCE_DURATION_H: Record<string, number> = {
  dishwasher: 1.5,
  washing_machine: 1.5,
  dryer: 1.5,
  ev_charger: 3,
  heat_pump: 2,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a time string to an hour number (0-23). Handles "14:00", "2025-06-15T14:00:00", etc. */
function parseHour(input: string): number {
  if (/^\d{1,2}:\d{2}$/.test(input)) return parseInt(input.split(':')[0], 10);
  const d = new Date(input);
  if (!isNaN(d.getTime())) return d.getHours();
  const n = parseInt(input, 10);
  return isNaN(n) ? 13 : n; // fallback to 13:00 (demo now)
}

/** Get the spot price for a given hour on DEMO_TODAY. */
function spotPriceAtHour(hour: number): number {
  const prices = getSpotPrices();
  const target = `${DEMO_TODAY}T${String(hour).padStart(2, '0')}:00:00`;
  const match = prices.find((p) => p.timestamp === target);
  return match ? match.spot_price_eur_per_kwh : 0.08; // sensible default
}

/** Find the cheapest hour in DEMO_TODAY. */
function cheapestHourToday(): { hour: number; price: number } {
  const prices = getSpotPrices();
  const todayPrices = prices.filter((p) => p.timestamp.startsWith(DEMO_TODAY));
  if (todayPrices.length === 0) return { hour: 13, price: 0.05 };
  let best = todayPrices[0];
  for (const p of todayPrices) {
    if (p.spot_price_eur_per_kwh < best.spot_price_eur_per_kwh) best = p;
  }
  return {
    hour: new Date(best.timestamp).getHours(),
    price: best.spot_price_eur_per_kwh,
  };
}

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

export function createTools(householdId: string) {
  return {
    get_household_context: tool({
      description:
        'Fetch the household profile, assets (PV, battery, heat pump, EV), tariff, and contract details.',
      parameters: getHouseholdContextSchema,
      execute: async ({ household_id }) => {
        const id = household_id ?? householdId;
        const hh = getHousehold(id);
        if (!hh) return { error: `Household ${id} not found.` };

        const contract = getContract(id);
        const tariff = getTariff(hh.tariff_id);

        return {
          household_id: hh.household_id,
          name: hh.name,
          city: hh.city,
          residents: hh.residents,
          assets: {
            solar_pv_kwp: hh.pv_kwp,
            battery_kwh: hh.battery_kwh,
            battery_power_kw: hh.battery_power_kw,
            heat_pump: hh.heat_pump,
            heat_pump_kw: contract?.assets.heat_pump_kw ?? null,
            ev_charger: hh.ev_charger,
            ev_battery_kwh: contract?.assets.ev_battery_kwh ?? null,
          },
          tariff: tariff
            ? {
                id: tariff.tariff_id,
                name: tariff.name,
                type: tariff.type,
                base_fee_eur_per_month: tariff.base_fee_eur_per_month,
                feed_in_eur_per_kwh: tariff.feed_in_eur_per_kwh,
                ...(tariff.type === 'dynamic_hourly'
                  ? { spot_adder_eur_per_kwh: tariff.spot_adder_eur_per_kwh }
                  : { energy_rate_eur_per_kwh: tariff.energy_rate_eur_per_kwh }),
              }
            : null,
          contract: contract
            ? {
                provider: contract.provider,
                tariff_name: contract.tariff_name,
                start: contract.contract_start,
                end: contract.contract_end,
                min_term_months: contract.minimum_term_months,
                notice_weeks: contract.notice_period_weeks,
                auto_renew_months: contract.auto_renew_months,
                terms_summary: contract.contract_terms_text,
              }
            : null,
        };
      },
    }),

    request_missing_info: tool({
      description:
        'Ask the user for missing information needed to run a calculation. Explain WHY the info is needed.',
      parameters: requestMissingInfoSchema,
      execute: async ({ missing_fields, reason }) => ({
        missing_fields,
        reason,
        status: 'awaiting_user_input' as const,
      }),
    }),

    calculate_shift_savings: tool({
      description:
        'Calculate the euro savings from shifting an appliance to a different time slot. Considers spot prices and solar surplus.',
      parameters: calculateShiftSavingsSchema,
      execute: async ({ household_id, appliance, current_time, proposed_time }) => {
        const id = household_id || householdId;
        const hh = getHousehold(id);
        const contract = getContract(id);
        if (!hh || !contract) return { error: `Household ${id} not found.` };

        const power = APPLIANCE_POWER_KW[appliance] ?? 2.0;
        const duration = APPLIANCE_DURATION_H[appliance] ?? 1.5;
        const currentHour = parseHour(current_time);
        const proposedHour = parseHour(proposed_time);

        // Spot prices at both times
        const spotCurrent = spotPriceAtHour(currentHour);
        const spotProposed = spotPriceAtHour(proposedHour);

        // Adder (dynamic tariff surcharge)
        const adder = contract.energy_pricing.spot_adder_eur_per_kwh ?? 0.119;

        // Retail prices
        const retailCurrent = spotCurrent + adder;
        const retailProposed = spotProposed + adder;

        // Check PV production at proposed time
        const proposedTimestamp = `${DEMO_TODAY}T${String(proposedHour).padStart(2, '0')}:00:00`;
        const records = getTimeseries(id);
        const rec = records.find((r) => r.timestamp === proposedTimestamp);
        const pvAtProposed = rec?.pv_production_kw ?? 0;
        const pvCoversLoad = pvAtProposed >= power;

        // Costs
        const energyNow = power * duration;
        const costNow = +(energyNow * retailCurrent).toFixed(2);
        const costProposed = pvCoversLoad ? 0 : +(energyNow * retailProposed).toFixed(2);
        const savings = +(costNow - costProposed).toFixed(2);

        // Find best window
        const best = cheapestHourToday();
        const bestHourStr = `${String(best.hour).padStart(2, '0')}:00`;

        // Build reason text
        let reason: string;
        if (pvCoversLoad) {
          reason = `At ${String(proposedHour).padStart(2, '0')}:00 your solar panels produce ${pvAtProposed.toFixed(1)} kW, which fully covers the ${appliance.replace('_', ' ')} (${power} kW). The effective cost is €0.00.`;
        } else if (savings > 0) {
          reason = `The EPEX spot price drops from €${spotCurrent.toFixed(4)}/kWh at ${String(currentHour).padStart(2, '0')}:00 to €${spotProposed.toFixed(4)}/kWh at ${String(proposedHour).padStart(2, '0')}:00, saving you €${savings.toFixed(2)} on this cycle.`;
        } else {
          reason = `Running at ${String(proposedHour).padStart(2, '0')}:00 would actually cost €${Math.abs(savings).toFixed(2)} more. Consider ${bestHourStr} instead (cheapest today).`;
        }

        return {
          appliance,
          current_time: `${String(currentHour).padStart(2, '0')}:00`,
          proposed_time: `${String(proposedHour).padStart(2, '0')}:00`,
          current_cost_eur: costNow,
          proposed_cost_eur: costProposed,
          savings_eur: savings,
          reason,
          pv_available: pvCoversLoad,
          best_window_today: bestHourStr,
        };
      },
    }),

    simulate_tariff_switch: tool({
      description:
        'Compare the user\'s current tariff against a different one using their actual last-30-days usage data.',
      parameters: simulateTariffSwitchSchema,
      execute: async ({ household_id, target_tariff }) => {
        const id = household_id || householdId;
        const hh = getHousehold(id);
        const contract = getContract(id);
        if (!hh || !contract) return { error: `Household ${id} not found.` };

        // Last 30 days of records (relative to DEMO_TODAY)
        const endDate = new Date(`${DEMO_TODAY}T23:59:59`);
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 30);
        const records = getRecordsForTimeRange(
          id,
          startDate.toISOString(),
          endDate.toISOString(),
        );

        if (records.length === 0) {
          return { error: 'No timeseries data found for the last 30 days.' };
        }

        // Build a price lookup for spot prices
        const spotPrices = getSpotPrices();
        const spotMap = new Map<string, number>();
        for (const p of spotPrices) {
          // Spot prices are hourly; key by the hour portion
          spotMap.set(p.timestamp, p.spot_price_eur_per_kwh);
        }

        // Tariff details
        const tariffs = getTariffs();
        const currentTariff = tariffs.find((t) => t.tariff_id === hh.tariff_id);
        const targetTariffObj = tariffs.find((t) => t.tariff_id === target_tariff);
        if (!currentTariff || !targetTariffObj) {
          return { error: 'Tariff not found.' };
        }

        let actualTotal = 0;
        let hypotheticalTotal = 0;

        for (const rec of records) {
          const energyKwh = rec.grid_import_kw * 0.25; // 15-min interval → kWh

          // Actual cost under current tariff
          actualTotal += energyKwh * rec.price_eur_per_kwh;

          // Hypothetical cost under target tariff
          if (target_tariff === 'fixed') {
            // Fixed tariff: flat rate
            hypotheticalTotal += energyKwh * 0.349;
          } else {
            // Dynamic tariff: spot + adder
            // Find spot price for this record's hour
            const recDate = new Date(rec.timestamp);
            const hourKey = `${rec.timestamp.substring(0, 11)}${String(recDate.getHours()).padStart(2, '0')}:00:00`;
            const spot = spotMap.get(hourKey) ?? 0.08;
            hypotheticalTotal += energyKwh * (spot + 0.119);
          }
        }

        // Add base fees (30 days ≈ 1 month)
        const currentBaseFee = currentTariff.base_fee_eur_per_month;
        const targetBaseFee = targetTariffObj.base_fee_eur_per_month;
        actualTotal += currentBaseFee;
        hypotheticalTotal += targetBaseFee;

        const diff = +(actualTotal - hypotheticalTotal).toFixed(2);
        actualTotal = +actualTotal.toFixed(2);
        hypotheticalTotal = +hypotheticalTotal.toFixed(2);

        const periodDays = 30;
        let recommendation: string;
        if (diff > 5) {
          recommendation = `Switching to the ${targetTariffObj.name} tariff would have saved you €${diff.toFixed(2)} over the last ${periodDays} days. That's roughly €${(diff * 12).toFixed(0)} per year. Worth considering at your next renewal window.`;
        } else if (diff < -5) {
          recommendation = `Your current tariff is already €${Math.abs(diff).toFixed(2)} cheaper than the ${targetTariffObj.name} over the last ${periodDays} days. Staying put is the better deal.`;
        } else {
          recommendation = `The difference is minimal (€${Math.abs(diff).toFixed(2)} over ${periodDays} days). Other factors like price volatility comfort or contract flexibility may be more important for your decision.`;
        }

        return {
          current_tariff: currentTariff.name,
          target_tariff: targetTariffObj.name,
          actual_total_eur: actualTotal,
          hypothetical_total_eur: hypotheticalTotal,
          difference_eur: diff,
          period_days: periodDays,
          recommendation,
        };
      },
    }),

    set_routine_reminder: tool({
      description:
        'Set a routine or reminder based on an AI recommendation. The client-side UI will handle persistence.',
      parameters: setRoutineReminderSchema,
      execute: async ({ action_name, trigger_time, routine_id }) => ({
        action_name,
        trigger_time,
        routine_id: routine_id ?? null,
        status: 'confirmed' as const,
      }),
    }),
  };
}
