CREATE TABLE public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES expense_groups(id) ON DELETE CASCADE,
  from_member_id uuid NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
  to_member_id uuid NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  settled_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view settlements" ON public.settlements FOR SELECT USING (true);
CREATE POLICY "Anyone can create settlements" ON public.settlements FOR INSERT WITH CHECK (true);