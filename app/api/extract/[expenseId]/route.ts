import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { embedMany } from 'ai'
import { embeddingModel } from '@/lib/ai/openai-client'
import { extractTextFromBuffer, mimeTypeFromPath } from '@/lib/ai/extract-text'
import { chunkText } from '@/lib/ai/chunk-text'

interface RouteParams {
  params: Promise<{ expenseId: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { expenseId } = await params

  // Auth: validate user session and ownership via RLS
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch expense through RLS — returns null if not owned by user
  const { data: expense } = await supabase
    .from('expenses')
    .select('id, invoice_path, description, category, supplier, amount, expense_date')
    .eq('id', expenseId)
    .single()

  if (!expense) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
  }

  if (!expense.invoice_path) {
    return NextResponse.json({ error: 'No invoice attached to this expense' }, { status: 400 })
  }

  // Service role client for storage access and DB writes
  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Download invoice file from storage
  const { data: fileData, error: fileError } = await admin.storage
    .from('invoices')
    .download(expense.invoice_path)

  if (fileError || !fileData) {
    return NextResponse.json({ error: `Storage download failed: ${fileError?.message}` }, { status: 500 })
  }

  const arrayBuffer = await fileData.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const mimeType = mimeTypeFromPath(expense.invoice_path)

  // Extract text from invoice
  let rawText: string
  try {
    rawText = await extractTextFromBuffer(buffer, mimeType)
  } catch (err) {
    return NextResponse.json({ error: `Text extraction failed: ${(err as Error).message}` }, { status: 500 })
  }

  if (!rawText) {
    return NextResponse.json({ error: 'Could not extract any text from invoice' }, { status: 422 })
  }

  // Store raw text on the expense record
  await admin
    .from('expenses')
    .update({ raw_text: rawText })
    .eq('id', expenseId)

  // Chunk and embed
  const chunks = chunkText(rawText)

  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: chunks,
  })

  // Delete existing embeddings for idempotency
  await admin
    .from('expense_embeddings')
    .delete()
    .eq('expense_id', expenseId)

  // Insert new embeddings
  const rows = chunks.map((chunk_text, i) => ({
    expense_id: expenseId,
    chunk_index: i,
    chunk_text,
    embedding: embeddings[i],
  }))

  const { error: insertError } = await admin
    .from('expense_embeddings')
    .insert(rows)

  if (insertError) {
    return NextResponse.json({ error: `Failed to store embeddings: ${insertError.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, chunks: chunks.length })
}
