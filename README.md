# Pulse Energy

Pulse Energy is a modern web application built for exploring household energy usage, dynamic pricing (EPEX spot prices), §14a EnWG time-variable grid fees, smart routines, and AI-driven energy optimization analysis.

It features an **Agentic AI Assistant ("Pulse")** that helps users simulate energy-shifting options, analyze and compare tariffs using historical data, request missing information when necessary, and configure automated routine reminders.

---

## Technical Stack

- **Frontend**: React 19, TypeScript, Vite, Zustand (state management), Lucide React (icons), Recharts (data visualization).
- **Backend**: Express.js, TypeScript, tsx (runtime), Vercel AI SDK (with OpenAI `gpt-4o` / `gpt-4o-mini`).
- **Data Source**: Local cached JSON datasets representing 4 distinct German households (`public/data/`).

---

## Features

1. **AI Assistant ("Pulse")**:
   - Streams responses in real time using the Vercel AI SDK.
   - Intelligently routes queries using a dynamic router: `gpt-4o-mini` for simple questions/greetings and `gpt-4o` for complex calculations.
   - Proactively calls custom tools:
     - `get_household_context` (household & hardware settings)
     - `calculate_shift_savings` (appliance time-shifting savings based on solar surplus and EPEX spot prices)
     - `simulate_tariff_switch` (last 30 days cost simulation comparing dynamic vs. fixed rates)
     - `set_routine_reminder` (schedules routine cards in the local store)
     - `request_missing_info` (requests missing details using clean inline forms)
   - Gracefully falls back to a deterministic offline mode if the API key is not configured or the connection fails.
2. **Dashboard**: Interactive metrics for solar PV generation, household load, spot price trends, and battery status.
3. **Consumption**: A descriptive 2025 household dossier covering assets, contract, bills, energy flows, load patterns, and dynamic-pricing fit.
4. **Routines**: Configurable smart scheduling cards for home automation.

---

## Local Development & Setup

### 1. Requirements
- Node.js v22 or newer is recommended.
- An OpenAI API key (for online AI mode).

### 2. Installation
Install dependencies for both the client and server:
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory (you can copy `.env.example` as a template):
```bash
cp .env.example .env
```
Open `.env` and add your OpenAI API key:
```env
OPENAI_API_KEY=sk-proj-YourOpenAiKeyHere...
```

### 4. Running the App
Start both the Express backend (port 3001) and Vite frontend (port 5173 with proxy configuration) concurrently:
```bash
npm run dev
```

Visit the app at `http://localhost:5173`.

---

## Production & Deployment

### Build for Production
To build the client bundle and bundle the assets:
```bash
npm run build
```

### Start Production Server
In production, the Express backend serves the compiled static files from `dist/` and runs the API routes:
```bash
npm start
```

### Deploying to Render
This project contains a `render.yaml` file for easy deployment as a Node.js web service:
1. Connect your repository to Render.
2. Select the Blueprint deployment style.
3. Add your `OPENAI_API_KEY` under the Environment variables during the Render setup.
4. Render will build using `npm ci && npm run build` and launch using `npm start`.
