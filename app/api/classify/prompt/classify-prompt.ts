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

