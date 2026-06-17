/**
 * ruleEngine.js
 * Pure functions for rule evaluation. No side effects — easy to test.
 */

export const OPERATORS = [">", ">=", "<", "<=", "="];

/**
 * Validate a raw event object.
 * Returns { valid: true, event } or { valid: false, error: string }.
 */
export function validateEvent(raw) {
  if (typeof raw !== "object" || raw === null) {
    return { valid: false, error: "Event is not an object" };
  }

  const { id, source, metric, value, timestamp } = raw;

  if (!source || typeof source !== "string") {
    return { valid: false, error: `Missing or non-string 'source': ${JSON.stringify(raw)}` };
  }
  if (!metric || typeof metric !== "string") {
    return { valid: false, error: `Missing or non-string 'metric': ${JSON.stringify(raw)}` };
  }
  if (value === undefined || value === null) {
    return { valid: false, error: `Missing 'value' in event from ${source}/${metric}` };
  }
  const numVal = Number(value);
  if (!isFinite(numVal)) {
    return { valid: false, error: `Non-numeric 'value' (${value}) in event from ${source}/${metric}` };
  }

  return {
    valid: true,
    event: {
      id:        id ?? null,
      source,
      metric,
      value:     numVal,
      timestamp: timestamp ?? new Date().toISOString(),
    },
  };
}

/**
 * Evaluate a single comparison.
 * @param {number} value
 * @param {string} operator  one of > >= < <= =
 * @param {number} threshold
 * @returns {boolean}
 */
export function evaluate(value, operator, threshold) {
  switch (operator) {
    case ">":  return value > threshold;
    case ">=": return value >= threshold;
    case "<":  return value < threshold;
    case "<=": return value <= threshold;
    case "=":  return value === threshold;
    default:   return false;
  }
}

/**
 * Test whether a rule matches a validated event, ignoring cooldown.
 * @param {object} rule  - { enabled, source?, metric, operator, threshold }
 * @param {object} event - { source, metric, value }
 * @returns {boolean}
 */
export function ruleMatchesEvent(rule, event) {
  if (!rule.enabled) return false;

  // Source check: empty/null/undefined source means "any source"
  const sourceOk =
    !rule.source ||
    rule.source.trim() === "" ||
    rule.source === "*" ||
    rule.source === event.source;

  if (!sourceOk) return false;
  if (rule.metric !== event.metric) return false;

  return evaluate(event.value, rule.operator, rule.threshold);
}

/**
 * Check whether a rule is currently in cooldown.
 * @param {object} rule        - { cooldownSeconds, lastTriggeredAt? }
 * @param {Date}   now
 * @returns {boolean}
 */
export function isInCooldown(rule, now = new Date()) {
  if (!rule.lastTriggeredAt) return false;
  const elapsedMs = now - new Date(rule.lastTriggeredAt);
  return elapsedMs < (rule.cooldownSeconds ?? 0) * 1000;
}

/**
 * Given a list of rules and one validated event, return which rules fire.
 * Rules in cooldown are skipped.
 *
 * @param {object[]} rules
 * @param {object}   event
 * @param {Date}     now
 * @returns {object[]} rules that should fire
 */
export function getMatchingRules(rules, event, now = new Date()) {
  return rules.filter(
    (rule) => ruleMatchesEvent(rule, event) && !isInCooldown(rule, now)
  );
}

/**
 * Build an alert record from a rule + event.
 * @returns {object}
 */
export function buildAlert(rule, event, now = new Date()) {
  return {
    id:             crypto.randomUUID(),
    ruleName:       rule.name,
    ruleId:         rule.id,
    source:         event.source,
    metric:         event.metric,
    value:          event.value,
    operator:       rule.operator,
    threshold:      rule.threshold,
    eventTimestamp: event.timestamp,
    triggeredAt:    now.toISOString(),
    acknowledged:   false,
  };
}

/**
 * Validate a rule object. Returns an array of error strings (empty = valid).
 */
export function validateRule(rule) {
  const errors = [];
  if (!rule.name?.trim())        errors.push("Name is required");
  if (!rule.metric?.trim())      errors.push("Metric is required");
  if (!OPERATORS.includes(rule.operator)) errors.push(`Operator must be one of: ${OPERATORS.join(", ")}`);
  if (rule.threshold === "" || rule.threshold === undefined || rule.threshold === null) {
    errors.push("Threshold is required");
  } else if (!isFinite(Number(rule.threshold))) {
    errors.push("Threshold must be a number");
  }
  if (rule.cooldownSeconds !== undefined && rule.cooldownSeconds !== "") {
    const c = Number(rule.cooldownSeconds);
    if (!isFinite(c) || c < 0) errors.push("Cooldown must be a non-negative number");
  }
  return errors;
}
