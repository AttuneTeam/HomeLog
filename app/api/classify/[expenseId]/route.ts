import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { embed, generateObject } from 'ai'
import { embeddingModel } from '@/lib/ai/openai-client'
import { classificationModel } from '@/lib/ai/openai-client'
import { aiClassificationSchema } from '@/lib/ai/classification-schema'

interface RouteParams {
  params: Promise<{ expenseId: string }>
}

function derivePropertyStatus(purchaseDate: string | null, expenseDate: string): string {
  if (!purchaseDate) return 'established investment property'
  const purchase = new Date(purchaseDate)
  const expense = new Date(expenseDate)
  const monthsDiff = (expense.getTime() - purchase.getTime()) / (1000 * 60 * 60 * 24 * 30)
  return monthsDiff <= 12
    ? 'recently acquired (potential initial repair — TR 97/23 applies)'
    : 'established investment property'
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { expenseId } = await params

  // Auth: validate user session and ownership via RLS
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch expense + context through RLS
  const { data: expense } = await supabase
    .from('expenses')
    .select(`
      id, description, category, supplier, amount, expense_date, raw_text,
      renovations (
        name, classification,
        properties ( address, suburb, state, purchase_date )
      )
    `)
    .eq('id', expenseId)
    .single()

  if (!expense) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
  }

  const renovation = Array.isArray(expense.renovations) ? expense.renovations[0] : expense.renovations
  const property = renovation ? (Array.isArray(renovation.properties) ? renovation.properties[0] : renovation.properties) : null

  // Build query string for ATO similarity search
  const queryParts = [
    expense.description ?? '',
    expense.category ?? '',
    expense.supplier ?? '',
    expense.raw_text ? expense.raw_text.slice(0, 500) : '',
  ].filter(Boolean)
  const queryString = queryParts.join(' ')

  // Embed the query
  const { embedding: queryEmbedding } = await embed({
    model: embeddingModel,
    value: queryString,
  })

  // Retrieve relevant ATO rulings
  const { data: rulings } = await supabase.rpc('match_ato_rulings', {
    query_embedding: queryEmbedding,
    match_count: 5,
    match_threshold: 0.3,
  })

  const rulingsContext = (rulings ?? [])
    .map((r: { ruling_ref: string; chunk_text: string }) => `[${r.ruling_ref}]\n${r.chunk_text}`)
    .join('\n\n')

  const propertyStatus = derivePropertyStatus(
    property?.purchase_date ?? null,
    expense.expense_date
  )

  const prompt = `You are a Property Tax Intelligence Engine specialising in Australian ATO compliance. Classify the property expenditure below.

RETRIEVED ATO RULINGS (use these as your primary authority):
${rulingsContext || 'No specific rulings retrieved — use general ATO principles.'}

EXPENSE DATA:
- Date: ${expense.expense_date}
- Description: ${expense.description ?? '(not provided)'}
- Category: ${expense.category}
- Supplier: ${expense.supplier ?? '(not provided)'}
- Amount: $${expense.amount}
- Property: ${property ? `${property.address}, ${property.suburb ?? ''} ${property.state ?? ''}`.trim() : '(unknown)'}
- Property status: ${propertyStatus}
${expense.raw_text ? `- Extracted invoice text:\n${expense.raw_text.slice(0, 1000)}` : ''}

TASK:
1. Apply the Entirety Test: does the work restore the item to its former state, or does it improve/extend it?
2. Check for environmental protection activities (s 40-755 ITAA 1997) if relevant.
3. Classify as one of: "Immediate Deduction", "Capital Works (Div 43)", or "Plant & Equipment (Div 40)".
4. Provide a concise deduction strategy and cite the specific ruling reference.
5. Set environmental_flag true only if the work involves environmental protection (asbestos, contamination, etc.).
6. Set confidence_score between 0 and 1.`

  // Generate structured classification
  let classificationResult
  try {
    const { object } = await generateObject({
      model: classificationModel,
      schema: aiClassificationSchema,
      prompt,
    })
    classificationResult = object
  } catch (err) {
    return NextResponse.json({ error: `Classification failed: ${(err as Error).message}` }, { status: 500 })
  }

  // Service role client for DB writes
  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Upsert classification result (delete + insert for idempotency)
  await admin
    .from('expense_ai_classifications')
    .delete()
    .eq('expense_id', expenseId)

  const { error: insertError } = await admin
    .from('expense_ai_classifications')
    .insert({
      expense_id: expenseId,
      classification: classificationResult.classification,
      deduction_strategy: classificationResult.deduction_strategy,
      legal_citation: classificationResult.legal_citation,
      environmental_flag: classificationResult.environmental_flag,
      confidence_score: classificationResult.confidence_score,
      raw_response: classificationResult,
      model_used: 'gpt-4o-mini',
      ato_chunks_used: (rulings ?? []).map((r: { ruling_ref: string }) => r.ruling_ref),
    })

  if (insertError) {
    return NextResponse.json({ error: `Failed to store classification: ${insertError.message}` }, { status: 500 })
  }

  return NextResponse.json({ classification: classificationResult })
}
