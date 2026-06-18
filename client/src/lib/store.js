// /**
//  * store.js
//  * Lightweight reactive store. Holds all app state; components subscribe to slices.
//  */

// import { validateEvent, getMatchingRules, buildAlert, validateRule } from "./ruleEngine.js";
// import { SSEClient, SSE_STATE } from "./sseClient.js";
// import { DemoStreamClient } from "./demoStream.js";

// const DEFAULT_SSE_URL = "http://localhost:4000/events";
// const MAX_EVENTS      = 100;
// const MAX_ALERTS      = 200;
// const MAX_ERRORS      = 50;

// // ─── State ───────────────────────────────────────────────────────────────────

// const state = {
//   sseUrl:    localStorage.getItem("sseUrl") || DEFAULT_SSE_URL,
//   sseState:  SSE_STATE.IDLE,
//   rules:     loadRules(),
//   events:    [],
//   alerts:    [],
//   errors:    [],
//   toasts:    [],
// };

// let _listeners = [];
// let _toastTimer = null;

// // ─── Persistence ─────────────────────────────────────────────────────────────

// function loadRules() {
//   try {
//     const raw = localStorage.getItem("alertRules");
//     return raw ? JSON.parse(raw) : defaultRules();
//   } catch {
//     return defaultRules();
//   }
// }

// function saveRules() {
//   localStorage.setItem("alertRules", JSON.stringify(state.rules));
// }

// function defaultRules() {
//   return [
//     {
//       id:              crypto.randomUUID(),
//       name:            "Checkout high error rate",
//       source:          "checkout-api",
//       metric:          "error_rate",
//       operator:        ">",
//       threshold:       5,
//       cooldownSeconds: 60,
//       enabled:         true,
//       lastTriggeredAt: null,
//     },
//     {
//       id:              crypto.randomUUID(),
//       name:            "Any service high latency",
//       source:          "",
//       metric:          "latency_ms",
//       operator:        ">=",
//       threshold:       1000,
//       cooldownSeconds: 30,
//       enabled:         true,
//       lastTriggeredAt: null,
//     },
//     {
//       id:              crypto.randomUUID(),
//       name:            "Payment worker queue depth",
//       source:          "payment-worker",
//       metric:          "queue_depth",
//       operator:        ">",
//       threshold:       500,
//       cooldownSeconds: 60,
//       enabled:         true,
//       lastTriggeredAt: null,
//     },
//   ];
// }

// // ─── SSE client ──────────────────────────────────────────────────────────────

// const sseClient = new SSEClient({
//   url: state.sseUrl,
//   onStateChange: (s) => {
//     state.sseState = s;
//     notify();
//   },
//   onEvent: (raw) => {
//     const result = validateEvent(raw);
//     if (!result.valid) {
//       pushError(result.error);
//       notify();
//       return;
//     }
//     const event = result.event;

//     const now     = new Date();
//     const matched = getMatchingRules(state.rules, event, now);
//     event._matched = matched.length > 0;

//     state.events = [event, ...state.events].slice(0, MAX_EVENTS);

//     matched.forEach((rule) => {
//       const alert = buildAlert(rule, event, now);
//       state.alerts = [alert, ...state.alerts].slice(0, MAX_ALERTS);
//       rule.lastTriggeredAt = now.toISOString();
//       showToast(alert);
//     });

//     if (matched.length) saveRules();
//     notify();
//   },
//   onParseError: (msg) => {
//     pushError(msg);
//     notify();
//   },
// });

// // ─── Mutations ───────────────────────────────────────────────────────────────

// export function connectSSE(url) {
//   if (url) {
//     state.sseUrl = url;
//     localStorage.setItem("sseUrl", url);
//   }
//   sseClient.connect(state.sseUrl);
//   notify();
// }

// export function disconnectSSE() {
//   sseClient.disconnect();
//   notify();
// }

// export function addRule(fields) {
//   const errors = validateRule(fields);
//   if (errors.length) return { ok: false, errors };

//   state.rules = [
//     ...state.rules,
//     {
//       id:              crypto.randomUUID(),
//       name:            fields.name.trim(),
//       source:          fields.source?.trim() ?? "",
//       metric:          fields.metric.trim(),
//       operator:        fields.operator,
//       threshold:       Number(fields.threshold),
//       cooldownSeconds: Number(fields.cooldownSeconds ?? 60),
//       enabled:         true,
//       lastTriggeredAt: null,
//     },
//   ];
//   saveRules();
//   notify();
//   return { ok: true };
// }

// export function toggleRule(id) {
//   state.rules = state.rules.map((r) =>
//     r.id === id ? { ...r, enabled: !r.enabled } : r
//   );
//   saveRules();
//   notify();
// }

// export function deleteRule(id) {
//   state.rules = state.rules.filter((r) => r.id !== id);
//   saveRules();
//   notify();
// }

// export function importRules(json) {
//   let parsed;
//   try { parsed = JSON.parse(json); } catch { return { ok: false, errors: ["Invalid JSON"] }; }
//   const arr = Array.isArray(parsed) ? parsed : [parsed];
//   const errors = [];
//   const valid  = [];
//   arr.forEach((r, i) => {
//     const errs = validateRule(r);
//     if (errs.length) errors.push(`Rule ${i + 1}: ${errs.join(", ")}`);
//     else valid.push({
//       ...r,
//       id:              crypto.randomUUID(),
//       enabled:         r.enabled ?? true,
//       lastTriggeredAt: null,
//     });
//   });
//   if (valid.length) {
//     state.rules = [...state.rules, ...valid];
//     saveRules();
//     notify();
//   }
//   return { ok: errors.length === 0, errors, imported: valid.length };
// }

// export function exportRules() {
//   return JSON.stringify(state.rules.map(({ lastTriggeredAt, ...r }) => r), null, 2);
// }

// export function acknowledgeAlert(id) {
//   state.alerts = state.alerts.map((a) =>
//     a.id === id ? { ...a, acknowledged: true } : a
//   );
//   notify();
// }

// export function clearAlerts() {
//   state.alerts = [];
//   notify();
// }

// export function dismissError(i) {
//   state.errors = state.errors.filter((_, idx) => idx !== i);
//   notify();
// }

// // ─── Toasts ──────────────────────────────────────────────────────────────────

// function showToast(alert) {
//   const toast = {
//     id:      crypto.randomUUID(),
//     message: `${alert.ruleName}: ${alert.source}/${alert.metric} = ${alert.value} (${alert.operator} ${alert.threshold})`,
//     ts:      Date.now(),
//   };
//   state.toasts = [toast, ...state.toasts].slice(0, 5);
//   notify();
//   setTimeout(() => {
//     state.toasts = state.toasts.filter((t) => t.id !== toast.id);
//     notify();
//   }, 6000);
// }

// // ─── Errors ──────────────────────────────────────────────────────────────────

// function pushError(msg) {
//   state.errors = [{ msg, ts: new Date().toISOString() }, ...state.errors].slice(0, MAX_ERRORS);
// }

// // ─── Subscription ────────────────────────────────────────────────────────────

// export function subscribe(fn) {
//   _listeners.push(fn);
//   return () => { _listeners = _listeners.filter((l) => l !== fn); };
// }

// function notify() {
//   const snap = getState();
//   _listeners.forEach((fn) => fn(snap));
// }

// export function getState() {
//   return { ...state, rules: [...state.rules] };
// }


/**
 * store.js
 * Lightweight reactive store. Holds all app state; components subscribe to slices.
 */

import { validateEvent, getMatchingRules, buildAlert, validateRule } from "./ruleEngine.js";
import { SSEClient, SSE_STATE } from "./sseClient.js";
import { DemoStreamClient } from "./demoStream.js";

const DEFAULT_SSE_URL = "http://localhost:4000/events";
const MAX_EVENTS      = 100;
const MAX_ALERTS      = 200;
const MAX_ERRORS      = 50;

// ─── State ───────────────────────────────────────────────────────────────────

const state = {
  sseUrl:    localStorage.getItem("sseUrl") || DEFAULT_SSE_URL,
  sseState:  SSE_STATE.IDLE,
  mode:      "real",   // "real" | "demo"
  rules:     loadRules(),
  events:    [],
  alerts:    [],
  errors:    [],
  toasts:    [],
};

let _listeners = [];

// ─── Persistence ─────────────────────────────────────────────────────────────

function loadRules() {
  try {
    const raw = localStorage.getItem("alertRules");
    return raw ? JSON.parse(raw) : defaultRules();
  } catch {
    return defaultRules();
  }
}

function saveRules() {
  localStorage.setItem("alertRules", JSON.stringify(state.rules));
}

function defaultRules() {
  return [
    {
      id:              crypto.randomUUID(),
      name:            "Checkout high error rate",
      source:          "checkout-api",
      metric:          "error_rate",
      operator:        ">",
      threshold:       5,
      cooldownSeconds: 60,
      enabled:         true,
      lastTriggeredAt: null,
    },
    {
      id:              crypto.randomUUID(),
      name:            "Any service high latency",
      source:          "",
      metric:          "latency_ms",
      operator:        ">=",
      threshold:       1000,
      cooldownSeconds: 30,
      enabled:         true,
      lastTriggeredAt: null,
    },
    {
      id:              crypto.randomUUID(),
      name:            "Payment worker queue depth",
      source:          "payment-worker",
      metric:          "queue_depth",
      operator:        ">",
      threshold:       500,
      cooldownSeconds: 60,
      enabled:         true,
      lastTriggeredAt: null,
    },
  ];
}

// ─── Shared event processing (used by BOTH real SSE and demo mode) ──────────

function processIncomingEvent(raw) {
  const result = validateEvent(raw);
  if (!result.valid) {
    pushError(result.error);
    notify();
    return;
  }
  const event = result.event;

  const now     = new Date();
  const matched = getMatchingRules(state.rules, event, now);
  event._matched = matched.length > 0;

  state.events = [event, ...state.events].slice(0, MAX_EVENTS);

  matched.forEach((rule) => {
    const alert = buildAlert(rule, event, now);
    state.alerts = [alert, ...state.alerts].slice(0, MAX_ALERTS);
    rule.lastTriggeredAt = now.toISOString();
    showToast(alert);
  });

  if (matched.length) saveRules();
  notify();
}

// ─── SSE client (real) ────────────────────────────────────────────────────

const sseClient = new SSEClient({
  url: state.sseUrl,
  onStateChange: (s) => {
    state.sseState = s;
    notify();
  },
  onEvent: processIncomingEvent,
  onParseError: (msg) => {
    pushError(msg);
    notify();
  },
});

// ─── Demo client (simulated, browser-only) ──────────────────────────────────

const demoClient = new DemoStreamClient({
  onStateChange: (s) => {
    state.sseState = s;
    notify();
  },
  onEvent: processIncomingEvent,
});

// ─── Mutations ───────────────────────────────────────────────────────────────

export function connectSSE(url) {
  if (url) {
    state.sseUrl = url;
    localStorage.setItem("sseUrl", url);
  }
  state.mode = "real";
  sseClient.connect(state.sseUrl);
  notify();
}

export function connectDemo() {
  state.mode = "demo";
  demoClient.connect();
  notify();
}

export function disconnectSSE() {
  if (state.mode === "demo") {
    demoClient.disconnect();
  } else {
    sseClient.disconnect();
  }
  notify();
}

export function addRule(fields) {
  const errors = validateRule(fields);
  if (errors.length) return { ok: false, errors };

  state.rules = [
    ...state.rules,
    {
      id:              crypto.randomUUID(),
      name:            fields.name.trim(),
      source:          fields.source?.trim() ?? "",
      metric:          fields.metric.trim(),
      operator:        fields.operator,
      threshold:       Number(fields.threshold),
      cooldownSeconds: Number(fields.cooldownSeconds ?? 60),
      enabled:         true,
      lastTriggeredAt: null,
    },
  ];
  saveRules();
  notify();
  return { ok: true };
}

export function toggleRule(id) {
  state.rules = state.rules.map((r) =>
    r.id === id ? { ...r, enabled: !r.enabled } : r
  );
  saveRules();
  notify();
}

export function deleteRule(id) {
  state.rules = state.rules.filter((r) => r.id !== id);
  saveRules();
  notify();
}

export function importRules(json) {
  let parsed;
  try { parsed = JSON.parse(json); } catch { return { ok: false, errors: ["Invalid JSON"] }; }
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  const errors = [];
  const valid  = [];
  arr.forEach((r, i) => {
    const errs = validateRule(r);
    if (errs.length) errors.push(`Rule ${i + 1}: ${errs.join(", ")}`);
    else valid.push({
      ...r,
      id:              crypto.randomUUID(),
      enabled:         r.enabled ?? true,
      lastTriggeredAt: null,
    });
  });
  if (valid.length) {
    state.rules = [...state.rules, ...valid];
    saveRules();
    notify();
  }
  return { ok: errors.length === 0, errors, imported: valid.length };
}

export function exportRules() {
  return JSON.stringify(state.rules.map(({ lastTriggeredAt, ...r }) => r), null, 2);
}

export function acknowledgeAlert(id) {
  state.alerts = state.alerts.map((a) =>
    a.id === id ? { ...a, acknowledged: true } : a
  );
  notify();
}

export function clearAlerts() {
  state.alerts = [];
  notify();
}

export function dismissError(i) {
  state.errors = state.errors.filter((_, idx) => idx !== i);
  notify();
}

// ─── Toasts ──────────────────────────────────────────────────────────────────

function showToast(alert) {
  const toast = {
    id:      crypto.randomUUID(),
    message: `${alert.ruleName}: ${alert.source}/${alert.metric} = ${alert.value} (${alert.operator} ${alert.threshold})`,
    ts:      Date.now(),
  };
  state.toasts = [toast, ...state.toasts].slice(0, 5);
  notify();
  setTimeout(() => {
    state.toasts = state.toasts.filter((t) => t.id !== toast.id);
    notify();
  }, 6000);
}

// ─── Errors ──────────────────────────────────────────────────────────────────

function pushError(msg) {
  state.errors = [{ msg, ts: new Date().toISOString() }, ...state.errors].slice(0, MAX_ERRORS);
}

// ─── Subscription ────────────────────────────────────────────────────────────

export function subscribe(fn) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter((l) => l !== fn); };
}

function notify() {
  const snap = getState();
  _listeners.forEach((fn) => fn(snap));
}

export function getState() {
  return { ...state, rules: [...state.rules] };
}