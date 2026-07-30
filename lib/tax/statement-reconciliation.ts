/**
 * Does an agent's rental statement account for itself?
 *
 *   (gross rent + other income) − agent fees − third-party outgoings
 *     = the amount disbursed
 *
 * A statement that ties is evidence: every figure on it has been read, and the
 * result matches what reached the bank. A statement that does not tie usually
 * means a line was missed rather than that any single figure is wrong, so this
 * reports the gap and leaves the judgement to a human.
 *
 * ADVISORY ONLY. It never blocks a save. A balance brought forward from the
 * previous statement legitimately breaks the identity, and treating that as user
 * error would train people to ignore the warning — which is worse than not
 * having it.
 */

/**
 * Discrepancy below which the statement is treated as tying.
 *
 * Agent fees are GST-inclusive and rounded per line, so a cent or two of drift
 * is normal. A dollar is loose enough to absorb that and tight enough that a
 * missed fee line — the smallest real one seen is a $4.40 bank charge — still
 * fails.
 */
export const RECONCILIATION_TOLERANCE = 1.0;

export interface ReconcilableStatement {
  /** GROSS rent. */
  amount: number;
  management_fees: number | null;
  letting_fees: number | null;
  lease_fees: number | null;
  sundry_fees: number | null;
  /** Paid by the agent to third parties. Not a deduction here. */
  other_outgoings: number | null;
  /** Assessable income that is not rent, e.g. a tenant water recovery. */
  other_income: number | null;
  /** What the agent disbursed. Null means there is nothing to check against. */
  net_received: number | null;
}

export interface ReconciliationResult {
  /**
   * False when there is nothing to reconcile — no disbursed figure, or no
   * statement detail at all. Distinct from a failed check.
   */
  applicable: boolean;
  ties: boolean;
  totalMoneyIn: number;
  totalFees: number;
  otherOutgoings: number;
  /** What the components imply was disbursed. */
  computedNet: number;
  /** computedNet − net_received. Positive means the statement disbursed less. */
  difference: number;
}

const NOT_APPLICABLE: Omit<ReconciliationResult, "applicable" | "ties"> = {
  totalMoneyIn: 0,
  totalFees: 0,
  otherOutgoings: 0,
  computedNet: 0,
  difference: 0,
};

export function reconcileStatement(
  statement: ReconcilableStatement,
): ReconciliationResult {
  const fees =
    Number(statement.management_fees ?? 0) +
    Number(statement.letting_fees ?? 0) +
    Number(statement.lease_fees ?? 0) +
    Number(statement.sundry_fees ?? 0);
  const outgoings = Number(statement.other_outgoings ?? 0);

  // No disbursed figure means nothing to check against. A bare row with no
  // statement detail has nothing to check either — both are unknown, not wrong.
  const hasDetail =
    statement.management_fees != null ||
    statement.letting_fees != null ||
    statement.lease_fees != null ||
    statement.sundry_fees != null ||
    statement.other_outgoings != null ||
    statement.other_income != null;

  if (statement.net_received == null || !hasDetail) {
    return { applicable: false, ties: false, ...NOT_APPLICABLE };
  }

  // Other income is money IN alongside rent, not a reduction in fees. Omitting
  // it leaves the identity short by exactly the reimbursement.
  const moneyIn = Number(statement.amount) + Number(statement.other_income ?? 0);
  const computedNet = moneyIn - fees - outgoings;
  const difference = computedNet - Number(statement.net_received);

  return {
    applicable: true,
    ties: Math.abs(difference) <= RECONCILIATION_TOLERANCE,
    totalMoneyIn: moneyIn,
    totalFees: fees,
    otherOutgoings: outgoings,
    computedNet,
    difference,
  };
}
