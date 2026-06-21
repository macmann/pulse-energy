import { z } from 'zod';

export const getHouseholdContextSchema = z.object({
  household_id: z
    .string()
    .optional()
    .describe(
      'Household ID (e.g. HH-1001). If omitted, uses the current session household.',
    ),
});

export const requestMissingInfoSchema = z.object({
  missing_fields: z
    .array(z.string())
    .describe('List of field names needed from the user'),
  reason: z
    .string()
    .describe(
      'Plain-language explanation of why this information is needed to give an accurate answer',
    ),
});

export const calculateShiftSavingsSchema = z.object({
  household_id: z.string().describe('Household ID'),
  appliance: z
    .enum(['dishwasher', 'washing_machine', 'ev_charger', 'heat_pump', 'dryer'])
    .describe('The appliance to shift'),
  current_time: z
    .string()
    .describe(
      'ISO timestamp or hour (e.g. "14:00") of when the user wants to run it now',
    ),
  proposed_time: z
    .string()
    .describe('ISO timestamp or hour of the suggested better time'),
});

export const simulateTariffSwitchSchema = z.object({
  household_id: z.string().describe('Household ID'),
  target_tariff: z
    .enum(['dynamic', 'fixed'])
    .describe('The tariff type to simulate switching to'),
});

export const setRoutineReminderSchema = z.object({
  action_name: z
    .string()
    .describe('Human-readable name of the routine (e.g. "Charge EV at 2 PM")'),
  trigger_time: z
    .string()
    .describe('When to trigger: ISO timestamp or cron expression'),
  routine_id: z
    .string()
    .optional()
    .describe(
      'Optional ID of a predefined routine to activate (ev-on-solar, appliances-midday, preheat-cheap)',
    ),
});
