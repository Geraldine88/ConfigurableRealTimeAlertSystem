# Test Plan — SSE & UI Behavior

Automated unit tests cover rule evaluation logic (`npm test` inside `client/`).
This document covers SSE connection state and UI behavior that requires manual
testing, since these depend on a live browser environment and a running stream.

---

## 1. SSE connection state

### TC-SSE-01: App shows CONNECTING state
**Steps:** Open app, click Connect.
**Expected:** State dot turns yellow, label reads "Connecting…" before the first event arrives.

### TC-SSE-02: App shows CONNECTED state
**Steps:** Start the mock server, click Connect.
**Expected:** State dot turns green, label reads "Connected" within 1-2 seconds.

### TC-SSE-03: App shows ERROR state on bad URL
**Steps:** Enter an unreachable URL (e.g. `http://localhost:9999/events`), click Connect.
**Expected:** State dot turns red, label reads "Error — retrying". Browser retries automatically.

### TC-SSE-04: App shows DISCONNECTED after manual disconnect
**Steps:** Connect successfully, then click Disconnect.
**Expected:** State dot turns grey, label reads "Disconnected". No further events arrive.

### TC-SSE-05: Recovery after server restart
**Steps:** Connect, stop the mock server, wait for error state, restart the server.
**Expected:** Browser reconnects automatically via EventSource's built-in retry.
State returns to Connected.
**Known limitation:** Retry interval is browser-controlled; there's no manual retry
button. Documented in DESIGN.md.

---

## 2. Event stream display

### TC-UI-01: Events appear in the feed
**Steps:** Connect to the mock server.
**Expected:** Event rows appear in the stream panel, newest at top, roughly 1 per second.

### TC-UI-02: Triggered events are visually highlighted
**Steps:** Connect with "Checkout high error rate" rule enabled.
**Expected:** `checkout-api error_rate 7.5` row is highlighted; `checkout-api error_rate 2.1` is not.

### TC-UI-03: Malformed JSON is shown in the error panel
**Steps:** Temporarily modify the mock server to emit a non-JSON `data:` line, reconnect.
**Expected:** Error panel shows "Malformed JSON: ...". The malformed event does not
appear in the event feed.

### TC-UI-04: Missing fields are shown in the error panel
**Steps:** Emit an event missing the `metric` field.
**Expected:** Error panel shows a message referencing the missing field. Event is skipped.

---

## 3. Rule management

### TC-RULE-01: Add rule via form
**Steps:** Fill in name, metric, operator, threshold, click Add rule.
**Expected:** Rule appears in the list with an ON badge and an enabled toggle.

### TC-RULE-02: Toggle rule off
**Steps:** Click the toggle on an enabled rule.
**Expected:** Badge changes to OFF. Rule no longer triggers alerts even on matching events.

### TC-RULE-03: Toggle rule back on
**Steps:** Click the toggle on a disabled rule.
**Expected:** Badge returns to ON. Rule fires again on the next matching event.

### TC-RULE-04: Delete rule
**Steps:** Click the trash icon on a rule.
**Expected:** Rule is removed from the list immediately. No further alerts for that rule.

### TC-RULE-05: Form validation
**Steps:** Click Add rule with required fields empty.
**Expected:** Inline error message appears. Rule is not added.

### TC-RULE-06: Form error clears on correction
**Steps:** Trigger the validation error above, then start typing in any field.
**Expected:** The error message clears immediately, without needing to resubmit.

---

## 4. Alert log

### TC-ALERT-01: Alert includes all required fields
**Steps:** Trigger an alert by connecting with a matching rule enabled.
**Expected:** Alert entry shows rule name, source, metric, actual value,
operator+threshold, event timestamp, and triggered-at time.

### TC-ALERT-02: Acknowledge an alert
**Steps:** Click Ack on an unacknowledged alert.
**Expected:** Alert row dims, the Ack button disappears, the status dot turns grey.

### TC-ALERT-03: Clear alerts
**Steps:** Click the Clear button.
**Expected:** Alert log empties. Count resets to 0.

---

## 5. Cooldown

### TC-COOL-01: Second matching event inside cooldown does not re-trigger
**Steps:** Use the default 60s cooldown rule. Connect. Wait for the first alert to fire.
Watch subsequent matching events arrive within the next 60 seconds.
**Expected:** Alert count does not increase again until 60 seconds have passed.

### TC-COOL-02: Alert fires again after cooldown expires
**Steps:** Wait until 60+ seconds have passed since the first alert, and a matching
event arrives.
**Expected:** A new alert entry appears for that rule.

---

## 6. Import / Export

### TC-IO-01: Export downloads a JSON file
**Steps:** Click Export rules.
**Expected:** Browser downloads `alert-rules.json` containing the current rule set as a JSON array.

### TC-IO-02: Import valid JSON adds rules
**Steps:** Click Import rules, paste a valid rule JSON array, click Import.
**Expected:** New rules appear in the list without removing existing ones.

### TC-IO-03: Import invalid JSON shows an error
**Steps:** Click Import rules, paste malformed JSON (e.g. `{bad json`), click Import.
**Expected:** An error message appears inside the modal. No rules are added.