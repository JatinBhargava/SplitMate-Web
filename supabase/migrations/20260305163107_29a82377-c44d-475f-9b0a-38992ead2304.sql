
-- Allow anyone to update expense_groups (for share_password setting)
CREATE POLICY "Anyone can update groups" ON public.expense_groups FOR UPDATE USING (true) WITH CHECK (true);
