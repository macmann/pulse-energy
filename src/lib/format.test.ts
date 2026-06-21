import { describe, expect, it } from "vitest";
import { formatEventPeriod } from "./format";

describe("formatEventPeriod", () => {
  it("formats same-month date ranges compactly", () => {
    expect(formatEventPeriod("2025-02-10..2025-02-17")).toBe(
      "Feb 10-17, 2025",
    );
  });

  it("formats month periods compactly", () => {
    expect(formatEventPeriod("2025-08")).toBe("Aug 2025");
  });

  it("formats recurring periods as a label", () => {
    expect(formatEventPeriod("recurring")).toBe("Recurring");
  });

  it("passes unknown periods through unchanged", () => {
    expect(formatEventPeriod("last winter")).toBe("last winter");
  });
});
