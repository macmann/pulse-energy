import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { buildAgentTools } from "@/lib/agent-tools.server";
import { DEFAULT_HOUSEHOLD_ID } from "@/lib/demo-config";
import { getHousehold } from "@/lib/data-loader.server";

const SYSTEM_PROMPT = (householdLine: string) => `You are Enpal Pulse, the smart energy assistant for an Enpal solar/battery/heat-pump customer in Germany.

${householdLine}

Rules:
- Always call a tool to ground your answer in the customer's real data before answering. Never invent numbers.
- Be concise. Lead with a direct answer in 1–2 sentences, then a short bullet of supporting numbers.
- Use EUR with comma-friendly amounts (e.g. "€0.42/kWh"). Times in 24h. Energy in kWh.
- For "should I run X now?" style questions, use estimate_appliance_cost and/or find_best_charging_window.
- For contract/maintenance questions, use get_contract.
- For "why was my bill higher?" use get_monthly_bills and get_insights.
- If a question is outside the household's energy/contract scope, briefly decline and steer back.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const body = (await request.json()) as {
          messages: UIMessage[];
          householdId?: string;
        };
        const householdId = body.householdId ?? DEFAULT_HOUSEHOLD_ID;
        let householdLine = "You answer questions about THIS specific household — their solar production, battery, heat pump, EV charging, tariff, contract, bills and recent consumption.";
        try {
          const hh = getHousehold(householdId);
          householdLine = `You are speaking with ${hh.name} in ${hh.city} (household ${hh.household_id}). ${householdLine}`;
        } catch {
          // fall back to generic line
        }

        const origin = new URL(request.url).origin;
        const gateway = createLovableAiGatewayProvider(apiKey);

        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system: SYSTEM_PROMPT(householdLine),
          messages: await convertToModelMessages(body.messages),
          tools: buildAgentTools(householdId, origin),
          stopWhen: stepCountIs(50),
        });

        return result.toUIMessageStreamResponse();
      },
    },
  },
});
