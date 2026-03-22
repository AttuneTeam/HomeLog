/**
 * Splits text into overlapping chunks suitable for embedding.
 * Splits on paragraph boundaries first, then sentence boundaries if needed.
 */
export function chunkText(text: string, maxChars = 800, overlap = 100): string[] {
  if (!text || text.trim().length === 0) return []
  if (text.length <= maxChars) return [text.trim()]

  const chunks: string[] = []
  const paragraphs = text.split(/\n\n+/)
  let current = ''

  for (const para of paragraphs) {
    const candidate = current ? current + '\n\n' + para : para

    if (candidate.length <= maxChars) {
      current = candidate
    } else {
      // Flush current chunk if non-empty
      if (current.trim()) {
        chunks.push(current.trim())
        // Carry overlap from end of current into next chunk
        current = current.slice(-overlap) + '\n\n' + para
      } else {
        // Single paragraph exceeds maxChars - split at sentence boundaries
        const sentences = para.split(/(?<=\.)\s+/)
        let sentChunk = ''
        for (const sentence of sentences) {
          const sentCandidate = sentChunk ? sentChunk + ' ' + sentence : sentence
          if (sentCandidate.length <= maxChars) {
            sentChunk = sentCandidate
          } else {
            if (sentChunk.trim()) {
              chunks.push(sentChunk.trim())
              sentChunk = sentChunk.slice(-overlap) + ' ' + sentence
            } else {
              // Single sentence longer than maxChars - hard cut
              chunks.push(sentence.slice(0, maxChars).trim())
              sentChunk = sentence.slice(maxChars - overlap)
            }
          }
        }
        if (sentChunk.trim()) current = sentChunk
      }
    }
  }

  if (current.trim()) chunks.push(current.trim())

  return chunks.filter(c => c.length > 0)
}
