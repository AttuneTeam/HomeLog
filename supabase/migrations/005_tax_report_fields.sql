-- Add initial_repair as a classification option
ALTER TYPE public.classification ADD VALUE IF NOT EXISTS 'initial_repair';

-- Add ABN and GST amount fields to expenses
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS abn text;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS gst_amount numeric(12, 2);
