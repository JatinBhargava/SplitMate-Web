-- Add expense creator tracking so users can edit/delete expenses they created
ALTER TABLE public.expenses
  ADD COLUMN created_by UUID;

UPDATE public.expenses
  SET created_by = paid_by
  WHERE created_by IS NULL;

ALTER TABLE public.expenses
  ALTER COLUMN created_by SET NOT NULL;

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.group_members(id) ON DELETE CASCADE;
