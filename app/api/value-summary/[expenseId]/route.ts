import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { classificationModel } from "@/lib/ai/openai-client";
import { generateText } from "ai";

const MODEL = "gpt-5.5";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ expenseId: string }> },
) {
  const { expenseId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch expense with renovation and property context
  const { data: expense } = await supabase
    .from("expenses")
    .select(
      "id, description, amount, supplier, category, raw_text, renovation_id, renovations(name, property_id, properties(address))",
    )
    .eq("id", expenseId)
    .single();

  if (!expense) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  // Verify user owns this expense
  const renovation = expense.renovations as {
    name: string;
    property_id: string;
    properties: { address: string } | null;
  } | null;

  if (!renovation) {
    return NextResponse.json({ error: "Renovation not found" }, { status: 404 });
  }

  const propertyAddress = renovation.properties?.address ?? "the property";
  const renovationName = renovation.name;
  const supplier = expense.supplier ?? "the contractor";
  const description = expense.description ?? renovationName;
  const amount = Number(expense.amount);
  const category = expense.category ?? "work";

  const contextHint = expense.raw_text
    ? `\n\nAdditional context from the invoice:\n${expense.raw_text.slice(0, 600)}`
    : "";

  const prompt = `You are writing concise records for a property investment portfolio. Given the details below, write 2–3 sentences describing what work was completed and the specific value it adds to the property. Be concrete and specific — mention the type of work, what was improved, and why it matters for the property. Do not mention dollar amounts or prices.

Property: ${propertyAddress}
Renovation project: ${renovationName}
Work description: ${description}
Category: ${category}
Supplier: ${supplier}${contextHint}

Write the summary now:`;

  const { text } = await generateText({
    model: classificationModel,
    prompt,
  });

  const summary = text.trim();

  // Upsert into expense_value_summaries
  const { error } = await supabase
    .from("expense_value_summaries")
    .upsert(
      {
        expense_id: expenseId,
        summary_text: summary,
        model_used: MODEL,
        is_edited: false,
      },
      { onConflict: "expense_id" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ summary_text: summary });
}
