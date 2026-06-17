// mock-sse-server.js
//
// Run locally with: node mock-sse-server.js
// Test with:        curl -N http://localhost:4000/events
//
// Deployed version reads PORT from environment (Render sets this automatically).
//
// Uses ONLY Node.js built-in modules — nothing to install.

const http = require("http");

// Cycles through these events. Values are picked so the spec's example
// rule ("checkout-api error_rate > 5") alternates between not-triggering
// and triggering, so cooldown behavior is visibly demonstrable.
const baseEvents = [
  { source: "checkout-api",   metric: "error_rate",  value: 2.1  }, // below threshold
  { source: "checkout-api",   metric: "error_rate",  value: 7.5  }, // triggers
  { source: "payment-worker", metric: "queue_depth", value: 800  }, // triggers (different rule)
  { source: "checkout-api",   metric: "latency_ms",  value: 1200 }, // triggers (different rule)
  { source: "checkout-api",   metric: "error_rate",  value: 8.2  }, // would trigger, but in cooldown
  { source: "auth-service",   metric: "latency_ms",  value: 45   }, // no rule matches
  { source: "payment-worker", metric: "queue_depth", value: 120  }, // below threshold
  { source: "inventory-svc",  metric: "latency_ms",  value: 1500 }, // triggers (wildcard-source rule)
  { source: "user-api",       metric: "error_rate",  value: 9.1  }, // no rule scoped to user-api
];

const PORT = process.env.PORT || 4000;

const server = http.createServer((req, res) => {
  // CORS preflight support — needed because client and server are on
  // different domains once deployed (Vercel vs Render)
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (req.url === "/health") {
    res.writeHead(200, {
      "Content-Type": "text/plain",
      "Access-Control-Allow-Origin": "*",
    });
    res.end("ok");
    return;
  }

  if (req.url !== "/events") {
    res.writeHead(404, { "Access-Control-Allow-Origin": "*" });
    res.end("Not found. Try /events");
    return;
  }

  res.writeHead(200, {
    "Content-Type":                "text/event-stream",
    "Cache-Control":                "no-cache",
    "Connection":                   "keep-alive",
    "Access-Control-Allow-Origin":  "*",
    "X-Accel-Buffering":            "no", // disables proxy buffering on some hosts
  });

  // Initial comment line — tells the client the stream is alive even
  // before the first real event. Comments start with ":" per the SSE spec.
  res.write(": connected\n\n");

  let index = 0;
  const timer = setInterval(() => {
    const base = baseEvents[index % baseEvents.length];
    const event = {
      ...base,
      id:        `evt-${String(index + 1).padStart(3, "0")}`,
      timestamp: new Date().toISOString(),
    };

    res.write(`id: ${event.id}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    index += 1;
  }, 1000);

  // Clean up when the client disconnects (closes tab, navigates away)
  req.on("close", () => {
    clearInterval(timer);
    res.end();
  });
});

server.listen(PORT, () => {
  console.log(`SSE mock server running on port ${PORT}`);
  console.log(`Events:  http://localhost:${PORT}/events`);
  console.log(`Health:  http://localhost:${PORT}/health`);
});