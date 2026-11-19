export type Availability = "available" | "sold_out";

export function deriveProductAvailability(quantities: number[]): Availability {
  return quantities.some((quantity) => quantity > 0) ? "available" : "sold_out";
}
