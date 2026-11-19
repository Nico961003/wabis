import { describe, expect, it } from "vitest";
import { deriveProductAvailability } from "./availability.js";

describe("deriveProductAvailability", () => {
  it("marks a product sold out when every combination is zero", () => {
    expect(deriveProductAvailability([0, 0])).toBe("sold_out");
  });

  it("keeps a product available when at least one combination has stock", () => {
    expect(deriveProductAvailability([0, 3, 0])).toBe("available");
  });

  it("treats a product without inventory as sold out", () => {
    expect(deriveProductAvailability([])).toBe("sold_out");
  });
});
