import { describe, expect, it } from "vitest";
import { calcAusTax, marginalRateForIncome } from "@/lib/tax-utils";

// This smoke test exists to prove the runner is wired up correctly. It imports
// through the "@/*" alias deliberately: if alias resolution regresses, every
// other test in the suite fails with an opaque module-not-found error, so it is
// worth asserting here where the cause is obvious.
describe("test runner setup", () => {
  it("resolves modules through the @/* path alias", () => {
    expect(typeof calcAusTax).toBe("function");
  });

  it("runs assertions against a pure domain module", () => {
    // Below the tax-free threshold only the 2% Medicare levy applies.
    expect(calcAusTax(18_200)).toBeCloseTo(364, 6);
    expect(calcAusTax(0)).toBe(0);
    expect(marginalRateForIncome(0)).toBe(0);
    expect(marginalRateForIncome(200_000)).toBe(45);
  });
});
