/**
 * main.js
 * Renders the full UI and wires store → DOM.
 */

import {
  connectSSE, disconnectSSE,
  addRule, toggleRule, deleteRule,
  importRules, exportRules,
  acknowledgeAlert, clearAlerts,
  dismissError,
  subscribe, getState,
} from "./lib/store.js";
import { SSE_STATE } from "./lib/sseClient.js";
import { OPERATORS } from "./lib/ruleEngine.js";

// ─── Styles ──────────────────────────────────────────────────────────────────

const style = document.createElement("style");
style.textContent = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:         #0f1117;
  --bg2:        #181c26;
  --bg3:        #1e2333;
  --border:     #2a2f42;
  --text:       #e2e8f0;
  --muted:      #8892a4;
  --accent:     #3b82f6;
  --accent-dk:  #1d4ed8;
  --green:      #22c55e;
  --red:        #ef4444;
  --yellow:     #f59e0b;
  --radius:     8px;
  --font:       'Inter', system-ui, sans-serif;
}

body { background: var(--bg); color: var(--text); font-family: var(--font); font-size: 14px; line-height: 1.5; }

/* ── Layout ── */
#app { display: grid; grid-template-rows: 56px 1fr; min-height: 100vh; }
header { display: flex; align-items: center; gap: 12px; padding: 0 20px; background: var(--bg2); border-bottom: 1px solid var(--border); }
header h1 { font-size: 16px; font-weight: 600; }
header .spacer { flex: 1; }
main { display: grid; grid-template-columns: 340px 1fr; grid-template-rows: auto 1fr; gap: 0; overflow: hidden; height: calc(100vh - 56px); }

/* ── Panels ── */
.panel { display: flex; flex-direction: column; border-right: 1px solid var(--border); overflow: hidden; }
.panel:last-child { border-right: none; }
.panel-header { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--border); background: var(--bg2); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); flex-shrink: 0; }
.panel-header .count { margin-left: auto; background: var(--bg3); border: 1px solid var(--border); border-radius: 20px; padding: 1px 8px; font-size: 11px; color: var(--text); }
.panel-body { flex: 1; overflow-y: auto; }
.panel-footer { border-top: 1px solid var(--border); padding: 10px 14px; background: var(--bg2); flex-shrink: 0; }

/* ── Right side split ── */
.right-col { display: grid; grid-template-rows: 1fr 1fr; overflow: hidden; }
.right-col .panel { border-right: none; border-bottom: 1px solid var(--border); }
.right-col .panel:last-child { border-bottom: none; }

/* ── SSE bar ── */
.sse-bar { grid-column: 1/-1; display: flex; align-items: center; gap: 10px; padding: 8px 14px; background: var(--bg2); border-bottom: 1px solid var(--border); flex-shrink: 0; }
.sse-url { flex: 1; background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius); padding: 5px 10px; color: var(--text); font-size: 13px; }
.sse-url:focus { outline: none; border-color: var(--accent); }
.state-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.state-dot.idle         { background: var(--muted); }
.state-dot.connecting   { background: var(--yellow); animation: blink 1s infinite; }
.state-dot.connected    { background: var(--green); }
.state-dot.error        { background: var(--red); animation: blink .7s infinite; }
.state-dot.disconnected { background: var(--muted); }
.state-label { font-size: 12px; color: var(--muted); }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }

/* ── Buttons ── */
button { cursor: pointer; border: none; border-radius: var(--radius); font-size: 13px; padding: 6px 12px; font-family: var(--font); transition: opacity .15s; }
button:hover { opacity: .85; }
.btn-primary   { background: var(--accent); color: #fff; }
.btn-danger    { background: var(--red); color: #fff; }
.btn-ghost     { background: var(--bg3); color: var(--text); border: 1px solid var(--border); }
.btn-sm        { padding: 3px 8px; font-size: 12px; }
.btn-icon      { background: transparent; color: var(--muted); padding: 4px 6px; }
.btn-icon:hover { color: var(--text); }

/* ── Forms ── */
input, select, textarea { background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius); color: var(--text); font-family: var(--font); font-size: 13px; padding: 6px 10px; width: 100%; }
input:focus, select:focus, textarea:focus { outline: none; border-color: var(--accent); }
select option { background: var(--bg2); }
label { font-size: 12px; color: var(--muted); display: block; margin-bottom: 3px; }
.field { margin-bottom: 8px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.form-err { font-size: 11px; color: var(--red); margin-top: 4px; }

/* ── Rule list ── */
.rule-item { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-bottom: 1px solid var(--border); }
.rule-item:hover { background: var(--bg2); }
.rule-toggle { position: relative; width: 32px; height: 18px; flex-shrink: 0; }
.rule-toggle input { opacity: 0; width: 0; height: 0; }
.rule-track { position: absolute; inset: 0; border-radius: 9px; background: var(--bg3); border: 1px solid var(--border); cursor: pointer; transition: background .2s; }
.rule-toggle input:checked + .rule-track { background: var(--green); border-color: var(--green); }
.rule-track::after { content: ''; position: absolute; left: 2px; top: 2px; width: 12px; height: 12px; border-radius: 50%; background: var(--muted); transition: left .2s, background .2s; }
.rule-toggle input:checked + .rule-track::after { left: 16px; background: #fff; }
.rule-info { flex: 1; min-width: 0; }
.rule-name { font-weight: 500; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rule-desc { font-size: 11px; color: var(--muted); margin-top: 1px; }
.rule-badge { font-size: 10px; padding: 1px 6px; border-radius: 20px; flex-shrink: 0; }
.rule-badge.on  { background: rgba(34,197,94,.15); color: var(--green); border: 1px solid rgba(34,197,94,.3); }
.rule-badge.off { background: var(--bg3); color: var(--muted); border: 1px solid var(--border); }

/* ── Event feed ── */
.event-row { display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-bottom: 1px solid var(--border); font-size: 12px; font-family: monospace; }
.event-row.hit { background: rgba(239,68,68,.07); }
.event-src    { color: var(--accent); min-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.event-metric { color: var(--muted); min-width: 90px; }
.event-val    { font-weight: 600; color: var(--text); min-width: 50px; }
.event-val.hit { color: var(--red); }
.event-ts     { margin-left: auto; color: var(--muted); font-size: 11px; }

/* ── Alert log ── */
.alert-item { padding: 10px 14px; border-bottom: 1px solid var(--border); }
.alert-item.acked { opacity: .5; }
.alert-item:hover { background: var(--bg2); }
.alert-top { display: flex; align-items: center; gap: 8px; }
.alert-rule { font-weight: 600; font-size: 13px; }
.alert-time { margin-left: auto; font-size: 11px; color: var(--muted); }
.alert-detail { font-size: 12px; color: var(--muted); margin-top: 3px; }
.alert-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--red); flex-shrink: 0; }
.alert-dot.acked { background: var(--muted); }

/* ── Errors ── */
.error-item { display: flex; align-items: flex-start; gap: 8px; padding: 7px 14px; border-bottom: 1px solid var(--border); font-size: 12px; color: var(--red); }
.error-msg { flex: 1; word-break: break-all; }

/* ── Empty states ── */
.empty { padding: 32px 16px; text-align: center; color: var(--muted); font-size: 13px; }

/* ── Toasts ── */
#toast-container { position: fixed; bottom: 20px; right: 20px; display: flex; flex-direction: column; gap: 8px; z-index: 1000; pointer-events: none; }
.toast { background: var(--bg2); border: 1px solid var(--red); border-left: 4px solid var(--red); border-radius: var(--radius); padding: 10px 14px; font-size: 13px; max-width: 360px; box-shadow: 0 4px 20px rgba(0,0,0,.5); animation: slideIn .25s ease; }
.toast-title { font-weight: 600; color: var(--red); font-size: 12px; margin-bottom: 2px; }
.toast-msg { color: var(--text); }
@keyframes slideIn { from { transform: translateX(30px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

/* ── Import modal ── */
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; z-index: 500; }
.modal { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; width: 480px; }
.modal h3 { margin-bottom: 12px; font-size: 15px; }
.modal textarea { height: 200px; font-family: monospace; font-size: 12px; resize: vertical; }
.modal-footer { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }

/* ── Scrollbar ── */
::-webkit-scrollbar { width: 5px; } 
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
`;
document.head.appendChild(style);

// ─── App render ──────────────────────────────────────────────────────────────

document.getElementById("app").innerHTML = `
<header>
  <i class="fa fa-bell" style="color:var(--accent);font-size:18px"></i>
  <h1>Alert System</h1>
  <span class="spacer"></span>
  <button class="btn-ghost btn-sm" id="btn-export"><i class="fa fa-download"></i> Export rules</button>
  <button class="btn-ghost btn-sm" id="btn-import"><i class="fa fa-upload"></i> Import rules</button>
</header>

<main>
  <!-- SSE bar spans full width -->
  <div class="sse-bar" style="grid-column:1/-1">
    <div class="state-dot idle" id="state-dot"></div>
    <span class="state-label" id="state-label">Idle</span>
    <input class="sse-url" id="sse-url" type="text" value="http://localhost:4000/events" placeholder="SSE URL" />
    <button class="btn-primary btn-sm" id="btn-connect">Connect</button>
    <button class="btn-ghost btn-sm" id="btn-disconnect">Disconnect</button>
  </div>

  <!-- Left: rules + add form -->
  <div class="panel">
    <div class="panel-header">
      <i class="fa fa-sliders"></i> Rules
      <span class="count" id="rule-count">0</span>
    </div>
    <div class="panel-body" id="rule-list"></div>
    <div class="panel-footer">
      <div id="rule-form-errors" class="form-err" style="margin-bottom:6px"></div>
      <div class="form-row">
        <div class="field">
          <label>Rule name</label>
          <input id="f-name" placeholder="High error rate" />
        </div>
        <div class="field">
          <label>Source (blank = any)</label>
          <input id="f-source" placeholder="checkout-api" />
        </div>
      </div>
      <div class="form-row">
        <div class="field">
          <label>Metric</label>
          <input id="f-metric" placeholder="error_rate" />
        </div>
        <div class="field">
          <label>Operator</label>
          <select id="f-op">
            ${OPERATORS.map(o => `<option value="${o}">${o}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="field">
          <label>Threshold</label>
          <input id="f-threshold" type="number" placeholder="5" />
        </div>
        <div class="field">
          <label>Cooldown (s)</label>
          <input id="f-cooldown" type="number" placeholder="60" value="60" />
        </div>
      </div>
      <button class="btn-primary" style="width:100%" id="btn-add-rule"><i class="fa fa-plus"></i> Add rule</button>
    </div>
  </div>

  <!-- Right col -->
  <div class="right-col">
    <!-- Event feed -->
    <div class="panel">
      <div class="panel-header">
        <i class="fa fa-rss"></i> Event stream
        <span class="count" id="event-count">0</span>
      </div>
      <div class="panel-body" id="event-feed"></div>
    </div>

    <!-- Alerts + errors tabs -->
    <div class="panel">
      <div class="panel-header" style="gap:0">
        <button class="btn-icon" id="tab-alerts" style="color:var(--text);padding:4px 10px"><i class="fa fa-bell"></i> Alerts <span id="alert-count-tab" style="margin-left:4px;background:var(--red);color:#fff;border-radius:10px;padding:0 6px;font-size:11px">0</span></button>
        <button class="btn-icon" id="tab-errors" style="padding:4px 10px"><i class="fa fa-triangle-exclamation"></i> Errors <span id="error-count-tab" style="margin-left:4px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:0 6px;font-size:11px">0</span></button>
        <span style="flex:1"></span>
        <button class="btn-ghost btn-sm" id="btn-clear-alerts">Clear</button>
      </div>
      <div class="panel-body" id="alert-log"></div>
      <div class="panel-body" id="error-log" style="display:none"></div>
    </div>
  </div>
</main>

<div id="toast-container"></div>
<div id="modal-container"></div>
`;

// ─── Tab logic ───────────────────────────────────────────────────────────────

let activeTab = "alerts";
function setTab(tab) {
  activeTab = tab;
  document.getElementById("alert-log").style.display  = tab === "alerts" ? "" : "none";
  document.getElementById("error-log").style.display  = tab === "errors" ? "" : "none";
  document.getElementById("tab-alerts").style.color = tab === "alerts" ? "var(--text)" : "var(--muted)";
  document.getElementById("tab-errors").style.color = tab === "errors" ? "var(--text)" : "var(--muted)";
}
document.getElementById("tab-alerts").onclick = () => setTab("alerts");
document.getElementById("tab-errors").onclick = () => setTab("errors");

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString();
}

// ─── Renderers ───────────────────────────────────────────────────────────────

function renderSSEState({ sseState, sseUrl }) {
  const dot   = document.getElementById("state-dot");
  const label = document.getElementById("state-label");
  const labels = {
    [SSE_STATE.IDLE]:         "Idle",
    [SSE_STATE.CONNECTING]:   "Connecting…",
    [SSE_STATE.CONNECTED]:    "Connected",
    [SSE_STATE.ERROR]:        "Error — retrying",
    [SSE_STATE.DISCONNECTED]: "Disconnected",
  };
  dot.className   = `state-dot ${sseState}`;
  label.textContent = labels[sseState] ?? sseState;
  document.getElementById("sse-url").value = sseUrl;
}

function renderRules({ rules }) {
  const list = document.getElementById("rule-list");
  document.getElementById("rule-count").textContent = rules.length;

  if (!rules.length) {
    list.innerHTML = `<div class="empty">No rules yet — add one below</div>`;
    return;
  }

  list.innerHTML = rules.map(r => {
    const src = r.source || "<em>any source</em>";
    return `
    <div class="rule-item">
      <label class="rule-toggle" title="${r.enabled ? "Disable" : "Enable"}">
        <input type="checkbox" ${r.enabled ? "checked" : ""} data-rule-toggle="${r.id}" />
        <span class="rule-track"></span>
      </label>
      <div class="rule-info">
        <div class="rule-name">${r.name}</div>
        <div class="rule-desc">${src} · ${r.metric} ${r.operator} ${r.threshold} · cooldown ${r.cooldownSeconds}s</div>
      </div>
      <span class="rule-badge ${r.enabled ? "on" : "off"}">${r.enabled ? "ON" : "OFF"}</span>
      <button class="btn-icon btn-sm" data-rule-delete="${r.id}" title="Delete rule"><i class="fa fa-trash"></i></button>
    </div>`;
  }).join("");
}

function renderEvents({ events }) {
  const feed = document.getElementById("event-feed");
  document.getElementById("event-count").textContent = events.length;

  if (!events.length) {
    feed.innerHTML = `<div class="empty">Waiting for events…</div>`;
    return;
  }

  feed.innerHTML = events.slice(0, 60).map(e => {
    const matched = e._matched;
    return `<div class="event-row ${matched ? "hit" : ""}">
      <span class="event-src">${e.source}</span>
      <span class="event-metric">${e.metric}</span>
      <span class="event-val ${matched ? "hit" : ""}">${e.value}</span>
      <span class="event-ts">${fmtTime(e.timestamp)}</span>
    </div>`;
  }).join("");
}

function renderAlerts({ alerts }) {
  const log = document.getElementById("alert-log");
  const unacked = alerts.filter(a => !a.acknowledged).length;
  document.getElementById("alert-count-tab").textContent = unacked;

  if (!alerts.length) {
    log.innerHTML = `<div class="empty">No alerts fired yet</div>`;
    return;
  }

  log.innerHTML = alerts.map(a => `
    <div class="alert-item ${a.acknowledged ? "acked" : ""}">
      <div class="alert-top">
        <div class="alert-dot ${a.acknowledged ? "acked" : ""}"></div>
        <div class="alert-rule">${a.ruleName}</div>
        <span class="alert-time">${fmtTime(a.triggeredAt)}</span>
        ${!a.acknowledged ? `<button class="btn-ghost btn-sm" data-ack="${a.id}">Ack</button>` : ""}
      </div>
      <div class="alert-detail">
        ${a.source} · ${a.metric} = <strong>${a.value}</strong> (${a.operator} ${a.threshold}) · event @ ${fmtTime(a.eventTimestamp)}
      </div>
    </div>`).join("");
}

function renderErrors({ errors }) {
  const log = document.getElementById("error-log");
  document.getElementById("error-count-tab").textContent = errors.length;

  if (!errors.length) {
    log.innerHTML = `<div class="empty">No errors</div>`;
    return;
  }

  log.innerHTML = errors.map((e, i) => `
    <div class="error-item">
      <i class="fa fa-triangle-exclamation"></i>
      <div class="error-msg">${e.msg}<br><span style="color:var(--muted);font-size:11px">${fmtTime(e.ts)}</span></div>
      <button class="btn-icon btn-sm" data-dismiss-error="${i}"><i class="fa fa-xmark"></i></button>
    </div>`).join("");
}

function renderToasts({ toasts }) {
  document.getElementById("toast-container").innerHTML = toasts.map(t => `
    <div class="toast">
      <div class="toast-title"><i class="fa fa-bell"></i> ALERT</div>
      <div class="toast-msg">${t.message}</div>
    </div>`).join("");
}

function render(state) {
  renderSSEState(state);
  renderRules(state);
  renderEvents(state);
  renderAlerts(state);
  renderErrors(state);
  renderToasts(state);
}

// ─── Event delegation ────────────────────────────────────────────────────────

document.addEventListener("change", (e) => {
  const id = e.target.dataset.ruleToggle;
  if (id) toggleRule(id);
});

document.addEventListener("click", (e) => {
  const delId = e.target.closest("[data-rule-delete]")?.dataset.ruleDelete;
  if (delId) { deleteRule(delId); return; }

  const ackId = e.target.closest("[data-ack]")?.dataset.ack;
  if (ackId) { acknowledgeAlert(ackId); return; }

  const errIdx = e.target.closest("[data-dismiss-error]")?.dataset.dismissError;
  if (errIdx !== undefined) { dismissError(Number(errIdx)); return; }
});

// ─── Control buttons ─────────────────────────────────────────────────────────

document.getElementById("btn-connect").onclick = () => {
  const url = document.getElementById("sse-url").value.trim();
  connectSSE(url);
};

document.getElementById("btn-disconnect").onclick = () => disconnectSSE();

document.getElementById("btn-clear-alerts").onclick = () => clearAlerts();

document.getElementById("btn-add-rule").onclick = () => {
  const result = addRule({
    name:            document.getElementById("f-name").value,
    source:          document.getElementById("f-source").value,
    metric:          document.getElementById("f-metric").value,
    operator:        document.getElementById("f-op").value,
    threshold:       document.getElementById("f-threshold").value,
    cooldownSeconds: document.getElementById("f-cooldown").value || "60",
  });
  const errEl = document.getElementById("rule-form-errors");
  if (result.ok) {
    errEl.textContent = "";
    ["f-name","f-source","f-metric","f-threshold"].forEach(id => {
      document.getElementById(id).value = "";
    });
    document.getElementById("f-cooldown").value = "60";
  } else {
    errEl.textContent = result.errors.join(" · ");
  }
};

// Clear the stale error message as soon as the user starts correcting the form —
// otherwise an old "X is required" message lingers even after they've typed a value.
["f-name", "f-source", "f-metric", "f-threshold", "f-cooldown"].forEach(id => {
  document.getElementById(id).addEventListener("input", () => {
    document.getElementById("rule-form-errors").textContent = "";
  });
});
document.getElementById("f-op").addEventListener("change", () => {
  document.getElementById("rule-form-errors").textContent = "";
});

document.getElementById("btn-export").onclick = () => {
  const json = exportRules();
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "alert-rules.json";
  a.click();
};

document.getElementById("btn-import").onclick = () => {
  const modal = document.getElementById("modal-container");
  modal.innerHTML = `
    <div class="modal-backdrop" id="modal-bd">
      <div class="modal">
        <h3><i class="fa fa-upload"></i> Import rules (JSON)</h3>
        <textarea id="import-text" placeholder='[{"name":"...","metric":"...","operator":">","threshold":5,"cooldownSeconds":60}]'></textarea>
        <div id="import-err" class="form-err"></div>
        <div class="modal-footer">
          <button class="btn-ghost" id="btn-cancel-import">Cancel</button>
          <button class="btn-primary" id="btn-do-import">Import</button>
        </div>
      </div>
    </div>`;

  document.getElementById("btn-cancel-import").onclick = () => { modal.innerHTML = ""; };
  document.getElementById("modal-bd").onclick = (e) => { if (e.target === e.currentTarget) modal.innerHTML = ""; };
  document.getElementById("btn-do-import").onclick = () => {
    const json = document.getElementById("import-text").value.trim();
    const result = importRules(json);
    if (result.ok) {
      modal.innerHTML = "";
    } else {
      document.getElementById("import-err").textContent =
        result.errors.join(" · ") + (result.imported ? ` (${result.imported} imported)` : "");
    }
  };
};

// ─── Boot ────────────────────────────────────────────────────────────────────

subscribe(render);
render(getState());
