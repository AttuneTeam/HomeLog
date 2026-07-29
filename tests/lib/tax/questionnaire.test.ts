import { describe, expect, it } from "vitest";
import { buildQuestionnaire, statusLabel } from "@/lib/tax/questionnaire";

const property = (over: Record<string, unknown> = {}) => ({
  address: "56 Forbes St",
  grossRent: 33_800,
  netResult: 12_000,
  isLoss: false,
  incomeSource: "actual" as const,
  ownershipPct: 100,
  assumedSoleOwnership: false,
  hasConfirmedInterest: true,
  hasDepreciationSchedule: true,
  purchaseDate: null,
  excluded: false,
  ...over,
});

const input = (over: Record<string, unknown> = {}) => ({
  financialYearLabel: "2025–26",
  properties: [property()],
  purchasedDuringYear: [],
  ...over,
});

function allItems(sections: ReturnType<typeof buildQuestionnaire>) {
  return sections.flatMap((s) => s.items);
}

describe("buildQuestionnaire", () => {
  it("covers rental property and nothing else", () => {
    // Scoped deliberately: personal sections of a return are supplied by the
    // taxpayer separately and merged with this pack.
    const titles = buildQuestionnaire(input()).map((s) => s.title);
    expect(titles).toEqual([
      "Rental properties — 2025–26",
      "Not covered by this pack",
    ]);
  });

  it("states the boundary rather than leaving it to be inferred", () => {
    // An omission the reader cannot see reads as "nothing to declare".
    const scope = buildQuestionnaire(input()).find(
      (s) => s.title === "Not covered by this pack",
    )!;
    expect(scope.items).toHaveLength(1);
    const answer = scope.items[0].answer!.toLowerCase();
    for (const area of [
      "work-related",
      "working from home",
      "private health",
      "cryptocurrency",
      "business",
      "help/hecs",
    ]) {
      expect(answer).toContain(area);
    }
    expect(answer).toContain("supplies those separately");
    expect(scope.items[0].status).toBe("not_tracked");
  });

  it("does not pad the pack with blank personal questions", () => {
    const items = allItems(buildQuestionnaire(input()));
    // Every item must carry an answer; a bare unanswered prompt belongs in the
    // taxpayer's own checklist, not in an agent-facing property pack.
    expect(items.every((i) => i.answer != null)).toBe(true);
  });

  it("answers the ownership question from recorded data", () => {
    const items = allItems(buildQuestionnaire(input()));
    const owned = items.find((i) =>
      i.question.includes("own or have an interest"),
    )!;
    expect(owned.status).toBe("answered");
    expect(owned.answer).toContain("56 Forbes St");
  });

  it("flags accrued income as needing confirmation", () => {
    const items = allItems(
      buildQuestionnaire(
        input({ properties: [property({ incomeSource: "accrued" })] }),
      ),
    );
    const income = items.find((i) => i.question.includes("annual rental income"))!;
    expect(income.status).toBe("check");
    expect(income.answer).toContain("estimated from tenancy terms");
  });

  it("treats recorded payments as answered", () => {
    const items = allItems(buildQuestionnaire(input()));
    const income = items.find((i) => i.question.includes("annual rental income"))!;
    expect(income.status).toBe("answered");
    expect(income.answer).toContain("from recorded payments");
  });

  it("describes a loss as a loss", () => {
    const items = allItems(
      buildQuestionnaire(
        input({
          properties: [property({ netResult: -8_000, isLoss: true })],
        }),
      ),
    );
    const income = items.find((i) => i.question.includes("annual rental income"))!;
    expect(income.answer).toContain("Net loss");
  });

  it("asks the user to confirm an assumed ownership share", () => {
    const items = allItems(
      buildQuestionnaire(
        input({ properties: [property({ assumedSoleOwnership: true })] }),
      ),
    );
    const ownership = items.find((i) => i.question.includes("ownership share"))!;
    expect(ownership.status).toBe("check");
    expect(ownership.answer).toContain("Assumed 100%");
  });

  it("states a part share without asking for confirmation when recorded", () => {
    const items = allItems(
      buildQuestionnaire(
        input({ properties: [property({ ownershipPct: 50 })] }),
      ),
    );
    const ownership = items.find((i) => i.question.includes("ownership share"))!;
    expect(ownership.status).toBe("answered");
    expect(ownership.answer).toContain("50%");
  });

  it("asks for a loan statement when none is confirmed", () => {
    const items = allItems(
      buildQuestionnaire(
        input({ properties: [property({ hasConfirmedInterest: false })] }),
      ),
    );
    const interest = items.find((i) => i.question.includes("loan interest"))!;
    expect(interest.answer).toContain("no interest is claimed");
    expect(interest.status).toBe("check");
  });

  it("omits the interest prompt when a statement is confirmed", () => {
    const items = allItems(buildQuestionnaire(input()));
    expect(items.find((i) => i.question.includes("loan interest"))).toBeUndefined();
  });

  it("asks for a QS schedule when depreciation is not recorded", () => {
    const items = allItems(
      buildQuestionnaire(
        input({ properties: [property({ hasDepreciationSchedule: false })] }),
      ),
    );
    const dep = items.find((i) => i.question.includes("depreciation"))!;
    expect(dep.status).toBe("not_tracked");
    expect(dep.answer).toContain("quantity surveyor");
  });

  it("excludes a primary residence from the rental answers", () => {
    const items = allItems(
      buildQuestionnaire(
        input({
          properties: [
            property(),
            property({ address: "Unit 72 28 Gower St", excluded: true }),
          ],
        }),
      ),
    );
    const owned = items.find((i) =>
      i.question.includes("own or have an interest"),
    )!;
    expect(owned.answer).toContain("1 property");
    expect(owned.answer).not.toContain("Gower");
  });

  it("always raises disposals, since they are not tracked", () => {
    const items = allItems(buildQuestionnaire(input()));
    const sale = items.find((i) => i.question.includes("purchased or sold"))!;
    expect(sale.status).toBe("check");
    expect(sale.answer).toContain("Disposals are not tracked");
  });

  it("names properties purchased during the year", () => {
    const items = allItems(
      buildQuestionnaire(input({ purchasedDuringYear: ["56 Forbes St"] })),
    );
    const sale = items.find((i) => i.question.includes("purchased or sold"))!;
    expect(sale.answer).toContain("Purchased: 56 Forbes St");
  });

  it("handles a year with no rental properties without claiming none exist", () => {
    const items = allItems(buildQuestionnaire(input({ properties: [] })));
    const owned = items.find((i) =>
      i.question.includes("own or have an interest"),
    )!;
    expect(owned.status).toBe("check");
  });
});

describe("statusLabel", () => {
  it("names where an unanswered item comes from", () => {
    expect(statusLabel("not_tracked")).toContain("Supplied separately");
    expect(statusLabel("check")).toBe("Please confirm");
    expect(statusLabel("answered")).toBe("From your records");
  });
});
