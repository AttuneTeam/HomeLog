/**
 * The tax-agent questionnaire, pre-answered where Home Base holds the data.
 *
 * A standard agent checklist covers a whole return; this product covers one
 * section of it. The pack answers the rental-property section from recorded
 * data and marks every other section **not tracked**, so the investor answers
 * a handful of personal questions instead of assembling the lot.
 *
 * Stating what is NOT tracked is the point. A section silently omitted reads
 * as "nothing to declare", which is the one interpretation that could cause a
 * return to be wrong.
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

const NOT_TRACKED_SECTIONS: Array<{ title: string; questions: string[] }> = [
  {
    title: "Work-related deductions",
    questions: [
      "Motor vehicle expenses — method claimed, work-use percentage, total kilometres, running costs",
      "Travel expenses — flights, accommodation, meals, incidentals, and any employer reimbursement",
      "Clothing, laundry and protective equipment",
      "Self-education — course fees, textbooks, stationery, travel",
      "Other work-related expenses — tools, union fees, professional memberships, subscriptions, seminars",
      "Working from home — average weekly hours",
    ],
  },
  {
    title: "Offsets and rebates",
    questions: [
      "Private health insurance — annual statement from your fund",
      "Spouse and dependants during the year",
      "Zone or remote area offsets",
    ],
  },
  {
    title: "Other investments",
    questions: [
      "Shares, managed funds or cryptocurrency bought, sold or disposed of",
      "Capital gains or losses, transaction summaries and annual tax statements",
    ],
  },
  {
    title: "Business income",
    questions: [
      "Sole trader or other business income",
      "Profit and loss statement, income and expenses summary",
      "Asset purchases or disposals",
    ],
  },
  {
    title: "Other",
    questions: [
      "HELP/HECS debt or Trade Support Loan",
      "Changes in circumstances — employment, marriage, separation, dependants",
    ],
  },
];

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
 * The rental section is answered from the pack's own figures; everything else
 * is returned as an explicit "not tracked" prompt rather than omitted.
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

  const sections: QuestionnaireSection[] = [
    { title: `Rental properties — ${input.financialYearLabel}`, items },
  ];

  for (const section of NOT_TRACKED_SECTIONS) {
    sections.push({
      title: section.title,
      items: section.questions.map((question) => ({
        question,
        answer: null,
        status: "not_tracked" as const,
      })),
    });
  }

  return sections;
}

/** Human-readable label for a status, used in the rendered pack. */
export function statusLabel(status: AnswerStatus): string {
  if (status === "answered") return "From your records";
  if (status === "check") return "Please confirm";
  return "Not tracked in Home Base — please answer";
}
