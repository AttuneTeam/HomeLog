import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { embed } from "ai";
import { embeddingModel } from "@/lib/ai/openai-client";
import { aiClassificationSchema } from "@/lib/ai/classification-schema";
import { derivePropertyStatus } from "@/app/api/classify/prompt/classify-prompt";
import OpenAI from "openai";

interface RouteParams {
  params: Promise<{ expenseId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { expenseId } = await params;

  // Auth: validate user session and ownership via RLS
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch expense + context through RLS
  const { data: expense } = await supabase
    .from("expenses")
    .select(
      `
      id, description, category, supplier, amount, expense_date, raw_text, context_notes,
      renovations (
        name, classification,
        properties ( address, suburb, state, purchase_date )
      )
    `,
    )
    .eq("id", expenseId)
    .single();

  if (!expense) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  const renovation = Array.isArray(expense.renovations)
    ? expense.renovations[0]
    : expense.renovations;
  const property = renovation
    ? Array.isArray(renovation.properties)
      ? renovation.properties[0]
      : renovation.properties
    : null;

  // Build query string for ATO similarity search
  const queryParts = [
    expense.description ?? "",
    expense.category ?? "",
    expense.supplier ?? "",
    expense.raw_text ? expense.raw_text.slice(0, 500) : "",
  ].filter(Boolean);
  const queryString = queryParts.join(" ");

  // Embed the query
  const { embedding: queryEmbedding } = await embed({
    model: embeddingModel,
    value: queryString,
  });

  // Retrieve relevant ATO rulings
  const { data: rulings } = await supabase.rpc("match_ato_rulings", {
    query_embedding: queryEmbedding,
    match_count: 5,
    match_threshold: 0.3,
  });

  const rulingsContext = (rulings ?? [])
    .map(
      (r: { ruling_ref: string; chunk_text: string }) =>
        `[${r.ruling_ref}]\n${r.chunk_text}`,
    )
    .join("\n\n");

  const propertyStatus = derivePropertyStatus(
    property?.purchase_date ?? null,
    expense.expense_date,
  );
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Generate structured classification via stored prompt
  let classificationResult;
  try {
    const response = await openai.responses.create({
      prompt: {
        id: "pmpt_69c7aec3bcb88190a78cb8b271723b870d77dbec02ce5c56",
        version: "6",
        variables: {
          rulings:
            rulingsContext ||
            "No specific rulings retrieved — use general ATO principles.",
          expensedescription: expense.description ?? "(not provided)",
          supplier: expense.supplier ?? "(not provided)",
          amount: String(expense.amount),
          address: property
            ? `${property.address}, ${property.suburb ?? ""} ${property.state ?? ""}`.trim()
            : "(unknown)",
          expensedate: expense.expense_date,
          property_status: propertyStatus,
          purchase_date: property?.purchase_date ?? "(unknown)",
          expense_context: expense.context_notes ?? "",
          expense_raw_text: expense.raw_text ?? "",
        },
      },
      text: {
        format: {
          type: "json_schema",
          name: "expense_classification",
          strict: true,
          schema: {
            type: "object",
            properties: {
              classification: {
                type: "string",
                enum: [
                  "Immediate Deduction",
                  "Capital Works (Div 43)",
                  "Plant & Equipment (Div 40)",
                ],
              },
              deduction_strategy: { type: "string" },
              legal_citation: { type: "string" },
              environmental_flag: { type: "boolean" },
              confidence_score: { type: "number" },
            },
            required: [
              "classification",
              "deduction_strategy",
              "legal_citation",
              "environmental_flag",
              "confidence_score",
            ],
            additionalProperties: false,
          },
        },
      },
    });
    classificationResult = aiClassificationSchema.parse(
      JSON.parse(response.output_text),
    );
  } catch (err) {
    return NextResponse.json(
      { error: `Classification failed: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  // Upsert classification result (delete + insert for idempotency)
  await supabase
    .from("expense_ai_classifications")
    .delete()
    .eq("expense_id", expenseId);

  const { error: insertError } = await supabase
    .from("expense_ai_classifications")
    .insert({
      expense_id: expenseId,
      classification: classificationResult.classification,
      deduction_strategy: classificationResult.deduction_strategy,
      legal_citation: classificationResult.legal_citation,
      environmental_flag: classificationResult.environmental_flag,
      confidence_score: classificationResult.confidence_score,
      raw_response: classificationResult,
      model_used: "gpt-5.5",
      ato_chunks_used: (rulings ?? []).map(
        (r: { ruling_ref: string }) => r.ruling_ref,
      ),
    });

  if (insertError) {
    return NextResponse.json(
      { error: `Failed to store classification: ${insertError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ classification: classificationResult });
}
