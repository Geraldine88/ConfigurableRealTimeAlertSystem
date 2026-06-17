# Configurable Real-time Alert System

A browser-based alert system that consumes a server-sent events (SSE) stream, evaluates user-defined rules, and triggers notifications when conditions are met.

## Architecture

- `client/` — the web app (Vite + vanilla JS), deployable to Vercel
- `server/` — a mock SSE server (Node.js built-ins only), deployable to Render

## Install dependencies

```bash
cd client
npm install
```

The server has no dependencies to install — it uses only Node's built-in `http` module.

## Run the app locally

Open two terminals.

**Terminal 1 — start the mock SSE server:**
```bash
cd server
node mock-sse-server.js
```
Server starts at `http://localhost:4000/events`.

**Terminal 2 — start the client:**
```bash
cd client
npm run dev
```
Open `http://localhost:5173` in your browser. Click **Connect** to start receiving events.

## Run tests

```bash
cd client
npm test
```

24 automated tests covering rule matching, all 5 operators, cooldown behavior, and invalid event handling.

## Example rule to verify the app

The app loads three sample rules automatically on first run:

```json
{
  "name": "Checkout high error rate",
  "source": "checkout-api",
  "metric": "error_rate",
  "operator": ">",
  "threshold": 5,
  "cooldownSeconds": 60,
  "enabled": true
}
```

Expected behavior once connected to the mock server:
- `checkout-api error_rate = 2.1` → no alert (below threshold)
- `checkout-api error_rate = 7.5` → **alert fires**
- `payment-worker queue_depth = 800` → alert fires (different rule)
- `checkout-api latency_ms = 1200` → alert fires (different rule, any-source)
- Later `checkout-api error_rate` values respect the 60s cooldown — no duplicate alert until cooldown expires

## Import / export rules

Use the **Export rules** and **Import rules** buttons in the header to save or load rule sets as JSON.