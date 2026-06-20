# Pulse Energy

Pulse Energy is a Vite + React demo app for exploring household energy usage, dynamic pricing, routines, and insight reports. It runs entirely in the browser and loads its sample dataset from JSON files in `public/data`.

## Features

- Home dashboard with energy, solar, cost, and carbon metrics.
- Insight reports with monthly comparisons and usage breakdowns.
- Routine reminders for shifting flexible loads such as EV charging and appliance usage.
- Assistant screen backed by deterministic local demo logic; no backend service is required.
- Static JSON dataset served with the app.

## Tech stack

- React 19
- TypeScript
- Vite
- Vitest
- Zustand
- Recharts
- Lucide React

## Requirements

- Node.js 22 or newer is recommended. The project uses the dependency versions locked in `package-lock.json`.
- npm 10 or newer.

## Local development

Install dependencies:

```bash
npm ci
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

Run tests:

```bash
npm test
```

## Project structure

```text
public/data/              Static demo datasets loaded by the client
src/components/           Shared React components
src/lib/                  Data loading, formatting, assistant, and view logic
src/screens/              App screens
src/store/                Client-side state stores
src/App.tsx               Top-level navigation and data bootstrap
src/main.tsx              React entry point
render.yaml               Render static-site configuration
```

## Deploying on Render

This repository includes a `render.yaml` Blueprint for Render. To deploy it:

1. Push this repository to GitHub or GitLab.
2. In Render, choose **New +** → **Blueprint**.
3. Select this repository and apply the `render.yaml` configuration.
4. Render will run `npm ci && npm run build` and publish the generated `dist` directory.

The app is a single-page application, so `render.yaml` rewrites all routes to `/index.html`. This keeps deep links and browser refreshes working on Render.

### Manual Render settings

If you deploy without the Blueprint, create a **Static Site** with these settings:

- **Build Command:** `npm ci && npm run build`
- **Publish Directory:** `dist`
- **Rewrite Rule:** `/*` → `/index.html`

## Data notes

The app currently targets the demo household configured in `src/lib/demo.ts`. Data is loaded from `public/data`, including a larger time-series file for the selected household. Because there is no server component, any data placed in `public/data` is publicly accessible after deployment.
