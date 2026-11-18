import { describe, expect, it } from "vitest";
import { normalizeTitle } from "../lib/normalize";

describe("normalizeTitle", () => {
  it.each([
    ["חלב", "חלב"],
    ["  חלב  ", "חלב"],
    ["חלב 3%", "חלב"],
    ["2 חלב", "חלב"],
    ["חלב x2", "חלב"],
    ["3x חלב", "חלב"],
    ["תפוחי אדמה 1 ק\"ג", "תפוחי אדמה"],
    ["תפוחי אדמה 2ק״ג", "תפוחי אדמה"],
    ["קולה זירו 1.5 ליטר", "קולה זירו"],
    ["מים מינרלים x6", "מים מינרלים"],
    ["קוטג' 5%", "קוטג"],
    ["קוטג׳", "קוטג"],
    ["גבינה (צהובה)", "גבינה צהובה"],
    ["ביצים - 12 יח'", "ביצים"],
    ["Milk 2L", "milk"],
    ["Bananas", "bananas"],
    ["7up", "7up"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeTitle(input)).toBe(expected);
  });

  it("never returns an empty key", () => {
    expect(normalizeTitle("2")).toBe("2");
    expect(normalizeTitle("500 גרם")).toBe("500 גרם");
  });

  it("groups quantity variants under one key", () => {
    const keys = new Set(["חלב", "2 חלב", "חלב 3%", "חלב x3"].map(normalizeTitle));
    expect(keys.size).toBe(1);
  });
});
