import { describe, expect, it } from "vitest";
import { formatPrice } from "./utils";

describe("formatPrice", () => {
  it("formats MXN with two decimals", () => {
    expect(formatPrice(499)).toContain("499.00");
  });
});
