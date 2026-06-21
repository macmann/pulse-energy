# Product & Technical Specification: "Pulse" AI Energy Companion

## 1. Project Overview & Context
This project is a React/Vite web application built for an energy hackathon. The goal is to solve a massive pain point in the German energy market: households with complex, distributed energy assets (Solar PV, Batteries, Heat Pumps, EV Chargers) are overwhelmed by data silos and confusing tariff structures. 

The core feature of this app is an **Agentic AI Assistant**. Instead of a standard text chatbot, the AI acts as a proactive financial advisor. It uses **Generative UI (Tool Calling)** to run real-time simulations against the user's historical data, answering complex "What-If" scenarios and generating actionable React components (buttons, charts) directly inside the chat stream.

**Market Context to Integrate:** 
The German energy market is shifting rapidly. The AI must account for the **§14a EnWG (Module 3)** regulation (effective April 2025), which introduced time-variable grid fees (Netzentgelte). Therefore, the "true cost" of electricity is the EPEX spot price *plus* these dynamic grid fees and taxes.

## 2. Core Architecture
The Assistant relies on an Agentic Loop architecture. It does not load all JSON data into the prompt. Instead, it uses function calling to fetch specific slices of local data when the user asks a question.

*   **Framework:** React + Vite (Demo environment).
*   **AI SDK:** Vercel AI SDK (`ai` and `@ai-sdk/react`).
*   **Model:** OpenAI `gpt-4o` or Anthropic `claude-3-5-sonnet` (must support robust tool calling).
*   **Data Source:** Local synthetic JSON files (`public/data/monthly_bills.json`, `dynamic_prices.json`, `energy_timeseries.json`, `contracts.json`, `user_profile.json`).

## 3. The Persona & System Prompt
The LLM must follow these strict behavioral rules. Copy this into the `system` parameter of the Vercel AI SDK `streamText` function.

```text
You are 'Pulse', an expert, financial-first energy advisor for German households. 
Your goal is to help users save money and maximize their renewable assets.

Rules:
1. Adaptive Literacy: Adjust your technical depth based on the user's profile. If unknown, use simple analogies (e.g., "Your battery is like a bucket of water" instead of "State-of-Charge"). Never use 'kW' or 'kWh' when you can use 'Euros' or 'Time'.
2. Polite Autonomy: Never issue commands. Use conditional framing: "If you wait until 3 PM, you will save €0.85. Would you like me to remind you?"
3. Certainty vs. Probability: Use definitive language for historical data or day-ahead spot prices. Use probabilistic language ("likely", "typically") for weather or future forecasts.
4. Grounded Reasoning: Briefly explain the "why". Mention EPEX spot market prices, Solar surplus, or Section 14a EnWG time-variable grid fees as the reason for price drops.
5. Directness: Omit conversational filler. Never start with "I'd be happy to help with that."

4. Tool Registry (Function Calling)
Implement the following tools using Zod schemas within the Vercel AI SDK. The execute blocks of these tools must query the local JSON files.

Tool 1: get_household_context
Description: Fetches the user's profile, assets (PV, EV, Battery sizes), and current tariff details.

Parameters: none (Resolves via session).

Execute Logic: Reads user_profile.json and contracts.json. Returns the active hardware and contract terms.

Tool 2: request_missing_info
Description: Asks the user for missing profile information required to run a calculation.

Parameters:

missing_fields (Array of strings, e.g., ["tariff_type", "ev_battery_size"])

reason (String: Explanation of why this data is needed to save them money).

Generative UI: Renders a <MissingInfoForm /> component in the chat.

Tool 3: calculate_shift_savings
Description: Calculates the Euro delta between running an appliance now vs. a proposed future time.

Parameters:

appliance (String: e.g., "dishwasher", "ev_charger")

current_time (String: ISO timestamp)

proposed_time (String: ISO timestamp)

Execute Logic:

Look up power footprint of appliance.

Fetch EPEX spot price + §14a grid fees from dynamic_prices.json for both timestamps.

Calculate estimated PV surplus from pv_production_kw. If surplus covers the load, the cost is €0.00.

Return the Euro difference.

Tool 4: simulate_tariff_switch
Description: Calculates how much the user would have paid historically on a different tariff type.

Parameters:

target_tariff (Enum: "dynamic" | "fixed")

Execute Logic: Reads the last 30 days of 15-min intervals from energy_timeseries.json. Multiplies usage by the target_tariff pricing model. Returns the hypothetical total vs. actual total.

Generative UI: Renders a <CostComparisonChart /> component in the chat showing the savings.

Tool 5: set_routine_reminder
Description: Sets a routine or notification based on an AI recommendation.

Parameters:

action_name (String: e.g., "Charge EV at 2 PM")

trigger_time (String: ISO timestamp or cron)

Generative UI: Renders a <RoutineConfirmationButton /> component in the chat.

5. Implementation Sequence for the Developer
Setup: Install dependencies: npm i ai @ai-sdk/react @ai-sdk/openai zod lucide-react recharts.

Data Layer: Create src/lib/dataAccess.ts. Write helper functions that fetch() and parse the JSON files in the public/data/ folder. Write a function to simulate a database query (e.g., getPricesForTimeRange(start, end)).

API Route: Create the backend endpoint (e.g., api/chat/route.ts). Initialize the Vercel AI SDK streamText function. Apply the System Prompt.

Tool Wiring: Define the 5 tools above in the tools object of streamText. Use Zod to enforce the parameter schemas. Link the execute functions to your dataAccess helpers.

UI Components: Build the React components for Generative UI (e.g., src/components/chat/CostComparisonChart.tsx).

Frontend Integration: In your main Assistant page, implement useChat. Map the toolInvocations stream to your custom React components so they render inline when the AI triggers them.

6. Example Desired Output
User: "Should I run the dishwasher now?"
Internal AI Steps:

Calls get_household_context -> User has Solar and Dynamic Tariff.

Calls calculate_shift_savings -> Now: €0.40. 2 PM: -€0.15 (Negative spot price).
AI Chat Output: "Right now, grid prices are standard. If you wait until 2:00 PM, the EPEX spot market prices drop into the negative, and your solar will be peaking. This would actually earn you about €0.15 to run the wash. Would you like to wait? I can remind you once it's time."
Generative UI Render: [Button: Remind me at 2:00 PM]