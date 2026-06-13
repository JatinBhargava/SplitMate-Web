
-- Add profiles table linked to auth.users
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', 'User'));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add user_id to group_members to link to auth
ALTER TABLE public.group_members ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add share_password to expense_groups (optional sharing)
ALTER TABLE public.expense_groups ADD COLUMN share_password text;

-- Add category to expenses (optional)
ALTER TABLE public.expenses ADD COLUMN category text;

-- Make description nullable with a default
ALTER TABLE public.expenses ALTER COLUMN description SET DEFAULT '';

-- Enable realtime for expenses
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
