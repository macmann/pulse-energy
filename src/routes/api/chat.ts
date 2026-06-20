import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { agentTools } from "@/lib/agent-tools.server";

const SYSTEM_PROMPT = `You are Enpal Pulse, the smart energy assistant for an Enpal solar/battery/heat-pump customer in Germany.

You answer questions about THIS specific household — their solar production, battery, heat pump, EV charging, tariff, contract, bills and recent consumption.

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

        const { messages }: { messages: UIMessage[] } = await request.json();
        const gateway = createLovableAiGatewayProvider(apiKey);

        const modelMessages = await convertToModelMessages(messages);
        console.log("[chat] msg in:", messages.length, "model msgs:", Array.isArray(modelMessages), modelMessages?.length);

        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system: SYSTEM_PROMPT,
          messages: modelMessages,
          tools: agentTools,
          stopWhen: stepCountIs(50),
        });

        return result.toUIMessageStreamResponse();
      },
    },
  },
});
