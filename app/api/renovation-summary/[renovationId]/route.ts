import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { classificationModel } from "@/lib/ai/openai-client";
import { generateText } from "ai";

const MODEL = "gpt-5.5";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ renovationId: string }> },
) {
  const { renovationId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch renovation with property and all expenses
  const { data: renovation } = await supabase
    .from("renovations")
    .select(
      "id, name, description, classification, properties(address), expenses(description, amount, supplier, category, raw_text)",
    )
    .eq("id", renovationId)
    .single();

  if (!renovation) {
    return NextResponse.json({ error: "Renovation not found" }, { status: 404 });
  }

  const property = renovation.properties as { address: string } | null;
  const propertyAddress = property?.address ?? "the property";

  type ExpenseRow = {
    description: string | null;
    amount: number;
    supplier: string | null;
    category: string;
    raw_text: string | null;
  };
  const expenses = (renovation.expenses ?? []) as ExpenseRow[];

  if (expenses.length === 0) {
    return NextResponse.json(
      { error: "No expenses to summarise" },
      { status: 422 },
    );
  }

  // Build expense breakdown for the prompt
  const expenseLines = expenses
    .map((e) => {
      const parts = [
        `- ${e.description ?? e.category}`,
        e.supplier ? `(${e.supplier})` : null,
        `$${Number(e.amount).toFixed(0)}`,
      ].filter(Boolean);
      return parts.join(" ");
    })
    .join("\n");

  // Include raw invoice text from the largest expense (most detail-rich)
  const richestExpense = [...expenses].sort(
    (a, b) => Number(b.amount) - Number(a.amount),
  )[0];
  const invoiceContext =
    richestExpense?.raw_text
      ? `\n\nInvoice excerpt (largest item):\n${richestExpense.raw_text.slice(0, 500)}`
      : "";

  const prompt = `You are writing property investment records. Given the renovation details below, write a 3–4 sentence summary describing what was done and the overall value this renovation adds to the property. Cover the scope of work, quality of the outcome, and why it matters as an investment. Be concrete and specific. Do not mention total cost or individual prices.

Property: ${propertyAddress}
Renovation: ${renovation.name}${renovation.description ? `\nDescription: ${renovation.description}` : ""}
Classification: ${renovation.classification}

Work completed:
${expenseLines}${invoiceContext}

Write the summary now:`;

  const { text } = await generateText({
    model: classificationModel,
    prompt,
  });

  const summary = text.trim();

  const { error } = await supabase
    .from("renovation_summaries")
    .upsert(
      {
        renovation_id: renovationId,
        summary_text: summary,
        model_used: MODEL,
        is_edited: false,
      },
      { onConflict: "renovation_id" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ summary_text: summary });
}
