# Design Notes

## Main components

| File | Role |
|------|------|
| `server/mock-sse-server.js` | Mock SSE server, Node.js built-ins only |
| `client/src/lib/ruleEngine.js` | Pure functions: validate events, evaluate rules, build alerts |
| `client/src/lib/sseClient.js` | `EventSource` lifecycle wrapper with state callbacks |
| `client/src/lib/store.js` | Central state: wires SSE → rule engine → alerts, persists to localStorage |
| `client/src/main.js` | DOM rendering and event delegation — no framework |

## Data flow: SSE event → alert