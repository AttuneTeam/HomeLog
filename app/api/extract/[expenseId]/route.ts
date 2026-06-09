import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
    .select('id, invoice_path, description, category, supplier, amount, expense_date, raw_text')
    .eq('id', expenseId)
    .single()

  if (!expense) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
  }

  // Skip if embeddings already exist for this expense
  const { count: embeddingCount } = await supabase
    .from('expense_embeddings')
    .select('id', { count: 'exact', head: true })
    .eq('expense_id', expenseId)

  if (embeddingCount && embeddingCount > 0) {
    return NextResponse.json({ ok: true, cached: true })
  }

  // Use already-extracted text if present (no vision pass); otherwise extract from the file
  let rawText = expense.raw_text ?? ''

  if (!rawText) {
    if (!expense.invoice_path) {
      return NextResponse.json({ error: 'No invoice attached to this expense' }, { status: 400 })
    }

    // Download invoice file from storage
    const { data: fileData, error: fileError } = await supabase.storage
      .from('invoices')
      .download(expense.invoice_path)

    if (fileError || !fileData) {
      return NextResponse.json({ error: `Storage download failed: ${fileError?.message}` }, { status: 500 })
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const mimeType = mimeTypeFromPath(expense.invoice_path)

    // Extract text from invoice (fallback vision pass for legacy expenses)
    try {
      rawText = await extractTextFromBuffer(buffer, mimeType)
    } catch (err) {
      return NextResponse.json({ error: `Text extraction failed: ${(err as Error).message}` }, { status: 500 })
    }

    if (!rawText) {
      return NextResponse.json({ error: 'Could not extract any text from invoice' }, { status: 422 })
    }

    // Store raw text on the expense record
    await supabase
      .from('expenses')
      .update({ raw_text: rawText })
      .eq('id', expenseId)
  }

  // Chunk and embed
  const chunks = chunkText(rawText)

  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: chunks,
  })

  // Delete existing embeddings for idempotency
  await supabase
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

  const { error: insertError } = await supabase
    .from('expense_embeddings')
    .insert(rows)

  if (insertError) {
    return NextResponse.json({ error: `Failed to store embeddings: ${insertError.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, chunks: chunks.length })
}
