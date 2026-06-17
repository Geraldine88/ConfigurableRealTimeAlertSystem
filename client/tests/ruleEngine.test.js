/**
 * ruleEngine.test.js
 *
 * Mirrors the exact "Example Test Cases" section from the assessment doc:
 * rule matching, all 5 operators, cooldown, invalid events.
 */

import { describe, it, expect } from "vitest";
import {
  validateEvent,
  evaluate,
  ruleMatchesEvent,
  isInCooldown,
  getMatchingRules,
  buildAlert,
  validateRule,
} from "../src/lib/ruleEngine.js";

// ── Fixtures ─────────────────────────────────────────────────────────────

const rule = (overrides = {}) => ({
  id:              "r1",
  name:            "High error rate",
  source:          "checkout-api",
  metric:          "error_rate",
  operator:        ">",
  threshold:       5,
  cooldownSeconds: 60,
  enabled:         true,
  lastTriggeredAt: null,
  ...overrides,
});

const event = (overrides = {}) => ({
  id:        "evt-001",
  source:    "checkout-api",
  metric:    "error_rate",
  value:     7.5,
  timestamp: "2026-06-15T18:30:00Z",
  ...overrides,
});

// ── Rule matching (spec section: "Rule matching") ───────────────────────

describe("Rule matching", () => {
  it("event triggers rule when metric, source, operator, and threshold match", () => {
    expect(ruleMatchesEvent(rule(), event())).toBe(true);
  });

  it("event does not trigger rule when metric differs", () => {
    expect(ruleMatchesEvent(rule({ metric: "latency_ms" }), event())).toBe(false);
  });

  it("event does not trigger rule when source differs", () => {
    expect(ruleMatchesEvent(rule(), event({ source: "payment-worker" }))).toBe(false);
  });

  it("rule with empty source applies to all sources for the same metric", () => {
    const r = rule({ source: "" });
    expect(ruleMatchesEvent(r, event({ source: "any-other-service" }))).toBe(true);
  });

  it("disabled rule does not trigger", () => {
    expect(ruleMatchesEvent(rule({ enabled: false }), event())).toBe(false);
  });
});

// ── Operators (spec section: "Operators") ───────────────────────────────

describe("Operators", () => {
  it("value > threshold", () => {
    expect(evaluate(6, ">", 5)).toBe(true);
    expect(evaluate(5, ">", 5)).toBe(false);
    expect(evaluate(4, ">", 5)).toBe(false);
  });

  it("value >= threshold", () => {
    expect(evaluate(5, ">=", 5)).toBe(true);
    expect(evaluate(6, ">=", 5)).toBe(true);
    expect(evaluate(4, ">=", 5)).toBe(false);
  });

  it("value < threshold", () => {
    expect(evaluate(4, "<", 5)).toBe(true);
    expect(evaluate(5, "<", 5)).toBe(false);
  });

  it("value <= threshold", () => {
    expect(evaluate(5, "<=", 5)).toBe(true);
    expect(evaluate(6, "<=", 5)).toBe(false);
  });

  it("value = threshold (exact numeric equality)", () => {
    expect(evaluate(5, "=", 5)).toBe(true);
    expect(evaluate(5.01, "=", 5)).toBe(false);
  });
});

// ── Cooldown (spec section: "Cooldown") ──────────────────────────────────

describe("Cooldown", () => {
  it("first matching event triggers alert", () => {
    const r = rule({ lastTriggeredAt: null });
    expect(getMatchingRules([r], event())).toHaveLength(1);
  });

  it("second matching event inside cooldown does not trigger a duplicate alert", () => {
    const now = new Date();
    const r = rule({ lastTriggeredAt: new Date(now - 10_000).toISOString() }); // 10s ago, cooldown 60s
    expect(getMatchingRules([r], event(), now)).toHaveLength(0);
  });

  it("matching event after cooldown triggers another alert", () => {
    const now = new Date();
    const r = rule({ lastTriggeredAt: new Date(now - 70_000).toISOString() }); // 70s ago, cooldown 60s
    expect(getMatchingRules([r], event(), now)).toHaveLength(1);
  });
});

// ── Invalid events (spec section: "Invalid events") ──────────────────────

describe("Invalid events", () => {
  it("malformed JSON-like input (non-object) is ignored and reported", () => {
    const result = validateEvent("not an object");
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("missing metric is ignored and reported", () => {
    const result = validateEvent(event({ metric: undefined }));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/metric/i);
  });

  it("missing value is ignored and reported", () => {
    const result = validateEvent(event({ value: undefined }));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/value/i);
  });

  it("non-numeric value is ignored and reported", () => {
    const result = validateEvent(event({ value: "abc" }));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/non-numeric/i);
  });

  it("numeric strings ARE accepted and coerced (not all strings are invalid)", () => {
    const result = validateEvent(event({ value: "7.5" }));
    expect(result.valid).toBe(true);
    expect(result.event.value).toBe(7.5);
  });
});

// ── Additional coverage beyond the spec's example list ────────────────────

describe("Additional rule matching coverage", () => {
  it("does not trigger rules for a different metric or source (combined check)", () => {
    const r = rule({ source: "checkout-api", metric: "error_rate" });
    expect(ruleMatchesEvent(r, event({ source: "checkout-api", metric: "latency_ms" }))).toBe(false);
    expect(ruleMatchesEvent(r, event({ source: "payment-worker", metric: "error_rate" }))).toBe(false);
  });

  it("wildcard '*' source behaves the same as empty source", () => {
    const r = rule({ source: "*" });
    expect(ruleMatchesEvent(r, event({ source: "inventory-svc" }))).toBe(true);
  });

  it("multiple rules can match the same event independently", () => {
    const rules = [
      rule({ id: "r1", source: "", threshold: 5 }),
      rule({ id: "r2", source: "checkout-api", threshold: 7 }),
    ];
    expect(getMatchingRules(rules, event())).toHaveLength(2); // value is 7.5, beats both
  });
});

describe("buildAlert", () => {
  it("includes all fields required by the spec", () => {
    const alert = buildAlert(rule(), event());
    expect(alert).toMatchObject({
      ruleName:  "High error rate",
      source:    "checkout-api",
      metric:    "error_rate",
      value:     7.5,
      operator:  ">",
      threshold: 5,
    });
    expect(alert.eventTimestamp).toBe("2026-06-15T18:30:00Z");
    expect(alert.triggeredAt).toBeTruthy();
  });
});

describe("validateRule", () => {
  it("accepts a fully valid rule", () => {
    expect(validateRule(rule())).toHaveLength(0);
  });

  it("rejects a rule missing required fields", () => {
    const errors = validateRule({ name: "", metric: "", operator: "!=", threshold: "" });
    expect(errors.length).toBeGreaterThan(0);
  });
});