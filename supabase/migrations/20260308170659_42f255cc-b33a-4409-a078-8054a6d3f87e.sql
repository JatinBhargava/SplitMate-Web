
-- Add linked_expense_ids to budgets for explicit expense linking
ALTER TABLE public.budgets ADD COLUMN linked_expense_ids uuid[] NOT NULL DEFAULT '{}';

-- Add update policy for budgets (already has insert/select/delete)
-- Already exists, skip

-- Add update policy for income_entries
CREATE POLICY "Anyone can update income entries" ON public.income_entries FOR UPDATE USING (true);
