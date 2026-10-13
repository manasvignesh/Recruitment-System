import { describe, it, expect } from "vitest";
import {
  canTransition,
  defaultStages,
  jobTransitions,
  offerTransitions,
  stageAllowed,
  overlaps,
} from "../../src/server/rules";
describe("Pipeline integrity", () => {
  it.each(
    defaultStages
      .slice(0, -2)
      .map((stage, index) => [stage, defaultStages[index + 1]]),
  )("permits the adjacent transition %s → %s", (from, to) =>
    expect(stageAllowed(from, to, defaultStages)).toBe(true),
  );
  it("rejects skipping stages", () =>
    expect(stageAllowed("Applied", "Offer", defaultStages)).toBe(false));
  it("rejects completing a hire by a stage change", () =>
    expect(stageAllowed("Offer", "Hired", defaultStages)).toBe(false));
  it("rejects an unknown stage", () =>
    expect(stageAllowed("Applied", "Unknown", defaultStages)).toBe(false));
  it("rejects an unknown source stage", () =>
    expect(stageAllowed("Unknown", "Applied", defaultStages)).toBe(false));
  it("supports configurable stages", () =>
    expect(
      stageAllowed("Applied", "Portfolio review", [
        "Applied",
        "Portfolio review",
        "Offer",
        "Hired",
      ]),
    ).toBe(true));
});
describe("Requisition lifecycle", () => {
  it.each([
    ["draft", "pending"],
    ["pending", "approved"],
    ["approved", "published"],
    ["published", "approved"],
    ["published", "closed"],
    ["closed", "approved"],
    ["closed", "archived"],
  ])("allows %s → %s", (from, to) =>
    expect(canTransition(jobTransitions, from, to)).toBe(true),
  );
  it.each([
    ["draft", "published"],
    ["pending", "published"],
    ["archived", "published"],
    ["draft", "closed"],
  ])("rejects %s → %s", (from, to) =>
    expect(canTransition(jobTransitions, from, to)).toBe(false),
  );
});
describe("Offer lifecycle", () => {
  it.each([
    ["draft", "pending"],
    ["pending", "approved"],
    ["approved", "available"],
    ["available", "accepted"],
    ["available", "declined"],
    ["available", "expired"],
  ])("allows %s → %s", (from, to) =>
    expect(canTransition(offerTransitions, from, to)).toBe(true),
  );
  it.each([
    ["draft", "accepted"],
    ["pending", "available"],
    ["approved", "accepted"],
    ["accepted", "declined"],
    ["declined", "accepted"],
  ])("rejects %s → %s", (from, to) =>
    expect(canTransition(offerTransitions, from, to)).toBe(false),
  );
});
describe("Interview time handling", () => {
  const start = new Date("2026-10-15T10:00:00Z");
  it("detects overlapping intervals", () =>
    expect(overlaps(start, 60, new Date("2026-10-15T10:30:00Z"), 30)).toBe(
      true,
    ));
  it("permits adjacent interviews", () =>
    expect(overlaps(start, 60, new Date("2026-10-15T11:00:00Z"), 30)).toBe(
      false,
    ));
  it("compares timezone offsets as instants", () =>
    expect(overlaps(start, 60, new Date("2026-10-15T15:30:00+05:30"), 30)).toBe(
      true,
    ));
});
