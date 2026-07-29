import { describe, expect, it } from "vitest";
import {
  isDeductibleNow,
  resolveTaxClassification,
} from "@/lib/tax/classification";

describe("resolveTaxClassification", () => {
  describe("inheriting from the renovation", () => {
    // These are the cases the old comparison got wrong. The renovation enum
    // and the tax enum use different vocabularies, so comparing the inherited
    // value against the tax vocabulary never matched and everything fell
    // through to "Repair" — deducting capital spend in the current year.
    it("maps capital_improvement to Capital Works", () => {
      expect(resolveTaxClassification(null, "capital_improvement")).toBe(
        "Capital Works",
      );
    });

    it("maps initial_repair to Immediate Repair", () => {
      expect(resolveTaxClassification(null, "initial_repair")).toBe(
        "Immediate Repair",
      );
    });

    it("maps repair to Repair", () => {
      expect(resolveTaxClassification(null, "repair")).toBe("Repair");
    });

    it("treats undefined the same as null", () => {
      expect(resolveTaxClassification(undefined, "capital_improvement")).toBe(
        "Capital Works",
      );
    });
  });

  describe("manual override", () => {
    it("wins over the renovation classification", () => {
      expect(resolveTaxClassification("Repair", "capital_improvement")).toBe(
        "Repair",
      );
      expect(resolveTaxClassification("Capital Works", "repair")).toBe(
        "Capital Works",
      );
      expect(resolveTaxClassification("Immediate Repair", "repair")).toBe(
        "Immediate Repair",
      );
    });
  });

  it("never returns a renovation-vocabulary value", () => {
    const renovationVocabulary = [
      "repair",
      "capital_improvement",
      "initial_repair",
    ] as const;
    const taxVocabulary = ["Repair", "Capital Works", "Immediate Repair"];

    for (const value of renovationVocabulary) {
      expect(taxVocabulary).toContain(resolveTaxClassification(null, value));
    }
  });
});

describe("isDeductibleNow", () => {
  it("treats only a plain repair as immediately deductible", () => {
    expect(isDeductibleNow("Repair")).toBe(true);
  });

  it("excludes capital works", () => {
    expect(isDeductibleNow("Capital Works")).toBe(false);
  });

  it("excludes initial repairs despite the label", () => {
    // "Immediate Repair" names an initial repair at purchase. Despite reading
    // like the opposite, it is NOT deductible in the current year — it is
    // capital and belongs in the CGT cost base.
    expect(isDeductibleNow("Immediate Repair")).toBe(false);
  });
});
