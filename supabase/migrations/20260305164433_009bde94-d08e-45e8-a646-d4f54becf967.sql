
-- Add created_by to expense_groups to track group creator
ALTER TABLE public.expense_groups ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Set user_id on group_members when they join (ensure it links to auth user)
-- user_id column already exists, just needs to be used properly

-- Allow group creator to delete the group
CREATE POLICY "Creator can delete group"
ON public.expense_groups FOR DELETE
USING (auth.uid() = created_by);

-- Allow group creator to delete members
CREATE POLICY "Creator can delete members"
ON public.group_members FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.expense_groups
    WHERE id = group_members.group_id AND created_by = auth.uid()
  )
);

-- Allow group creator to update members
CREATE POLICY "Creator can update members"
ON public.group_members FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.expense_groups
    WHERE id = group_members.group_id AND created_by = auth.uid()
  )
);

-- Enable realtime for group_members too
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
