import { NextRequest, NextResponse } from "next/server";
import { upsertContractorFromExpense } from "@/app/actions/contractors";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { expenseId, ...contractorInput } = body;
    if (!expenseId || !contractorInput.name) {
      return NextResponse.json({ error: "expenseId and name required" }, { status: 400 });
    }
    await upsertContractorFromExpense(expenseId, contractorInput);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
