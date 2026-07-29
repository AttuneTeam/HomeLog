/**
 * The rental-property section of a tax-agent questionnaire, pre-answered from
 * recorded data.
 *
 * The pack is deliberately scoped to property. Personal sections of a return —
 * work-related deductions, offsets, other investments, business income — are
 * supplied by the taxpayer separately and merged with this pack; reproducing
 * them here as sixteen blank questions would pad an agent-facing document
 * without answering anything.
 *
 * What is retained is a single statement of scope. An omission the reader
 * cannot see reads as "nothing to declare", which is the one interpretation
 * that could make a return wrong; naming the boundary once prevents that
 * without the clutter.
 */

export type AnswerStatus =
  /** Answered from recorded data. */
  | "answered"
  /** Answered from data, but resting on an assumption the user should check. */
  | "check"
  /** Outside what the product tracks; the user must answer it. */
  | "not_tracked";

export interface QuestionnaireItem {
  question: string;
  answer: string | null;
  status: AnswerStatus;
}

export interface QuestionnaireSection {
  title: string;
  items: QuestionnaireItem[];
}

export interface QuestionnaireInput {
  financialYearLabel: string;
  properties: Array<{
    address: string;
    grossRent: number;
    netResult: number;
    isLoss: boolean;
    incomeSource: "actual" | "accrued" | null;
    ownershipPct: number;
    assumedSoleOwnership: boolean;
    hasConfirmedInterest: boolean;
    hasDepreciationSchedule: boolean;
    purchaseDate: string | null;
    /** True for a primary residence, which has no rental schedule. */
    excluded: boolean;
  }>;
  /** Properties bought during the year, derived from purchase dates. */
  purchasedDuringYear: string[];
}

/** Areas of a return this pack does not cover, named so the gap is visible. */
const OUT_OF_SCOPE = [
  "work-related deductions (motor vehicle, travel, clothing and laundry, self-education, tools, union fees, working from home)",
  "offsets and rebates (private health insurance, spouse and dependants, zone offsets)",
  "other investments (shares, managed funds, cryptocurrency and their capital gains)",
  "business or sole trader income",
  "HELP/HECS and other study loans",
].join("; ");

function money(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Build the questionnaire for a financial year.
 *
 * The rental section is answered from the pack's own figures. A closing
 * section names what the pack does not cover, so the boundary is stated rather
 * than left to be inferred from an absence.
 */
export function buildQuestionnaire(
  input: QuestionnaireInput,
): QuestionnaireSection[] {
  const rental = input.properties.filter((p) => !p.excluded);
  const items: QuestionnaireItem[] = [];

  items.push({
    question: "Did you own or have an interest in any rental properties?",
    answer:
      rental.length > 0
        ? `Yes — ${rental.length} ${rental.length === 1 ? "property" : "properties"}: ${rental
            .map((p) => p.address)
            .join("; ")}`
        : "No rental properties recorded for this year.",
    status: rental.length > 0 ? "answered" : "check",
  });

  for (const property of rental) {
    items.push({
      question: `${property.address} — annual rental income`,
      answer: `${money(property.grossRent)} gross${
        property.incomeSource === "accrued"
          ? " (estimated from tenancy terms — no payment records for this year)"
          : " (from recorded payments)"
      }. Net ${property.isLoss ? "loss" : "income"} ${money(
        Math.abs(property.netResult),
      )}.`,
      status: property.incomeSource === "accrued" ? "check" : "answered",
    });

    if (property.ownershipPct !== 100) {
      items.push({
        question: `${property.address} — ownership share`,
        answer: `${property.ownershipPct}% — figures in this pack are your share.`,
        status: property.assumedSoleOwnership ? "check" : "answered",
      });
    } else if (property.assumedSoleOwnership) {
      items.push({
        question: `${property.address} — ownership share`,
        answer:
          "Assumed 100% (sole ownership). Not recorded — please confirm.",
        status: "check",
      });
    }

    if (!property.hasConfirmedInterest) {
      items.push({
        question: `${property.address} — loan interest`,
        answer:
          "No lender statement recorded, so no interest is claimed in this pack. If the property is geared, please provide the annual loan statement.",
        status: "check",
      });
    }

    if (!property.hasDepreciationSchedule) {
      items.push({
        question: `${property.address} — depreciation (Division 40 and 43)`,
        answer:
          "Not tracked. Plant and equipment depends on effective lives and the second-hand asset rules — please provide the quantity surveyor's schedule.",
        status: "not_tracked",
      });
    }
  }

  items.push({
    question: "Property purchased or sold during the year?",
    answer:
      input.purchasedDuringYear.length > 0
        ? `Purchased: ${input.purchasedDuringYear.join("; ")}. Disposals are not tracked — please confirm whether any property was sold.`
        : "No purchases recorded this year. Disposals are not tracked — please confirm whether any property was sold.",
    status: "check",
  });

  return [
    { title: `Rental properties — ${input.financialYearLabel}`, items },
    {
      title: "Not covered by this pack",
      items: [
        {
          question: "Everything outside the rental property section",
          answer: `This pack covers rental property only. It does not cover ${OUT_OF_SCOPE}. The taxpayer supplies those separately.`,
          status: "not_tracked",
        },
      ],
    },
  ];
}

/** Human-readable label for a status, used in the rendered pack. */
export function statusLabel(status: AnswerStatus): string {
  if (status === "answered") return "From your records";
  if (status === "check") return "Please confirm";
  return "Supplied separately by the taxpayer";
}
