interface ExpenseData {
  expense_date: string;
  description: string | null;
  category: string;
  supplier: string | null;
  amount: number;
  raw_text: string | null;
  context_notes: string | null;
}

interface PropertyData {
  address: string;
  suburb: string | null;
  state: string | null;
  purchase_date: string | null;
}

export function derivePropertyStatus(
  purchaseDate: string | null,
  expenseDate: string,
): string {
  if (!purchaseDate) return "established investment property";
  const purchase = new Date(purchaseDate);
  const expense = new Date(expenseDate);
  const monthsDiff =
    (expense.getTime() - purchase.getTime()) / (1000 * 60 * 60 * 24 * 30);
  return monthsDiff <= 12
    ? "recently acquired (potential initial repair — TR 97/23 applies)"
    : "established investment property";
}

export function getClassifyPrompt({
  expense,
  property,
  rulingsContext,
}: {
  expense: ExpenseData;
  property: PropertyData | null;
  rulingsContext: string;
}): string {
  const propertyStatus = derivePropertyStatus(
    property?.purchase_date ?? null,
    expense.expense_date,
  );

  return `You are a Property Tax Intelligence Engine specialising in Australian ATO compliance. Classify the property expenditure below.

RETRIEVED ATO RULINGS (use these as your primary authority):
${rulingsContext || "No specific rulings retrieved — use general ATO principles."}

EXPENSE DATA:
- Date: ${expense.expense_date}
- Description: ${expense.description ?? "(not provided)"}
- Category: ${expense.category}
- Supplier: ${expense.supplier ?? "(not provided)"}
- Amount: $${expense.amount}
- Property: ${property ? `${property.address}, ${property.suburb ?? ""} ${property.state ?? ""}`.trim() : "(unknown)"}
- Property purchased: ${property?.purchase_date ?? "(unknown)"}
- Expense date: ${expense.expense_date}
- Property status: ${propertyStatus}
${expense.context_notes ? `- Additional context (provided by owner): ${expense.context_notes}` : ""}
${expense.raw_text ? `- Extracted invoice text:\n${expense.raw_text.slice(0, 1000)}` : ""}

TASK:
1. Apply the Entirety Test: does the work restore the item to its former state, or does it improve/extend it?
2. Check for environmental protection activities (s 40-755 ITAA 1997) if relevant.
3. Classify as one of: "Immediate Deduction", "Capital Works (Div 43)", or "Plant & Equipment (Div 40)".
4. Provide a concise deduction strategy and cite the specific ruling reference.
5. Set environmental_flag true only if the work involves environmental protection (asbestos, contamination, etc.).
6. Set confidence_score between 0 and 1.`;
}
