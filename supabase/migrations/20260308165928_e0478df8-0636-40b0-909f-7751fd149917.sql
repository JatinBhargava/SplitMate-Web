
-- Create budgets table
CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.expense_groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.group_members(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'personal' CHECK (type IN ('personal', 'group')),
  name text NOT NULL DEFAULT '',
  budget_limit numeric,
  member_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view budgets" ON public.budgets FOR SELECT USING (true);
CREATE POLICY "Anyone can create budgets" ON public.budgets FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update budgets" ON public.budgets FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete budgets" ON public.budgets FOR DELETE USING (true);

-- Create income_entries table
CREATE TABLE public.income_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  added_by uuid NOT NULL REFERENCES public.group_members(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.income_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view income entries" ON public.income_entries FOR SELECT USING (true);
CREATE POLICY "Anyone can create income entries" ON public.income_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete income entries" ON public.income_entries FOR DELETE USING (true);
