-- ═══════════════════════════════════════════════════════════════
-- Migration: Financial Analytics & Transaction Tracking
-- ═══════════════════════════════════════════════════════════════

-- 1. Create financial_transactions table
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  category text NOT NULL CHECK (category IN (
    'quota_purchase', 'ad_revenue', 'sponsorship',
    'salary', 'hosting', 'operational',
    'misc_income', 'misc_expense'
  )),
  amount numeric NOT NULL CHECK (amount > 0),
  description text,
  reference_id uuid,  -- optional FK to quota_requests, ad_sponsors, etc.
  recorded_by uuid REFERENCES auth.users(id),
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- 3. Admin/Dev can view all transactions
CREATE POLICY "Admin and Dev can view financial transactions"
  ON public.financial_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dev')
    )
  );

-- 4. Admin/Dev can insert transactions
CREATE POLICY "Admin and Dev can insert financial transactions"
  ON public.financial_transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dev')
    )
  );

-- 5. Admin/Dev can update transactions
CREATE POLICY "Admin and Dev can update financial transactions"
  ON public.financial_transactions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dev')
    )
  );

-- 6. Admin/Dev can delete transactions
CREATE POLICY "Admin and Dev can delete financial transactions"
  ON public.financial_transactions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'dev')
    )
  );

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_financial_tx_date ON public.financial_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_tx_type ON public.financial_transactions(type);
CREATE INDEX IF NOT EXISTS idx_financial_tx_category ON public.financial_transactions(category);
