/**
 * demoStream.js
 *
 * Simulates the mock SSE server entirely in the browser, using setInterval
 * instead of a real EventSource/HTTP connection. Used only as a fallback
 * for the public Vercel demo, where there is no live backend to connect to.
 *
 * IMPORTANT: this is NOT a real SSE stream. It exists purely so a visitor
 * to the hosted demo link can see the app working end-to-end without
 * needing a separately deployed backend. The actual project includes a
 * real mock-sse-server.js (see /server) and a real EventSource-based
 * client (see sseClient.js) — that combination is what should be run
 * locally to evaluate the real SSE implementation.
 */

import { SSE_STATE } from "./sseClient.js";

const SAME_EVENTS_AS_SERVER = [
  { source: "checkout-api",   metric: "error_rate",  value: 2.1  },
  { source: "checkout-api",   metric: "error_rate",  value: 7.5  },
  { source: "payment-worker", metric: "queue_depth", value: 800  },
  { source: "checkout-api",   metric: "latency_ms",  value: 1200 },
  { source: "checkout-api",   metric: "error_rate",  value: 8.2  },
  { source: "auth-service",   metric: "latency_ms",  value: 45   },
  { source: "payment-worker", metric: "queue_depth", value: 120  },
  { source: "inventory-svc",  metric: "latency_ms",  value: 1500 },
  { source: "user-api",       metric: "error_rate",  value: 9.1  },
];

export class DemoStreamClient {
  constructor({ onEvent, onStateChange }) {
    this.onEvent       = onEvent;
    this.onStateChange = onStateChange;
    this._timer        = null;
    this._index        = 0;
    this._state        = SSE_STATE.IDLE;
  }

  get state() { return this._state; }

  _setState(s) {
    this._state = s;
    this.onStateChange?.(s);
  }

  connect() {
    this.disconnect();
    this._setState(SSE_STATE.CONNECTING);

    setTimeout(() => {
      this._setState(SSE_STATE.CONNECTED);

      this._timer = setInterval(() => {
        const base  = SAME_EVENTS_AS_SERVER[this._index % SAME_EVENTS_AS_SERVER.length];
        const event = {
          ...base,
          id:        `demo-${String(this._index + 1).padStart(3, "0")}`,
          timestamp: new Date().toISOString(),
        };
        this._index += 1;
        this.onEvent?.(event);
      }, 1000);
    }, 400);
  }

  disconnect() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    if (this._state !== SSE_STATE.IDLE) {
      this._setState(SSE_STATE.DISCONNECTED);
    }
  }
}