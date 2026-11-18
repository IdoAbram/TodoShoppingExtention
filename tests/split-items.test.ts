import { describe, expect, it } from "vitest";
import { splitItems } from "../components/AddItemBar";

describe("splitItems (pasting a list)", () => {
  it("splits lines and strips bullets, checkboxes and numbering", () => {
    const text = "- חלב\n• לחם\n1. ביצים\n2) עגבניות\n☐ במבה\n[ ] קפה\n\n   \n2 מלפפונים";
    expect(splitItems(text)).toEqual(["חלב", "לחם", "ביצים", "עגבניות", "במבה", "קפה", "2 מלפפונים"]);
  });

  it("handles Windows line endings", () => {
    expect(splitItems("חלב\r\nלחם\r\n")).toEqual(["חלב", "לחם"]);
  });
});
