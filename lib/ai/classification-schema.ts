import { z } from 'zod'

export const aiClassificationSchema = z.object({
  classification: z.enum([
    'Immediate Deduction',
    'Capital Works (Div 43)',
    'Plant & Equipment (Div 40)',
  ]),
  deduction_strategy: z.string().min(10),
  legal_citation: z.string().min(5),
  environmental_flag: z.boolean(),
  confidence_score: z.number().min(0).max(1),
})

export type AiClassificationResult = z.infer<typeof aiClassificationSchema>
