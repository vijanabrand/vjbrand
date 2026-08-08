
-- 1. Change default status to 'approved' so new inserts auto-publish
ALTER TABLE public.songs ALTER COLUMN status SET DEFAULT 'approved'::song_status;

-- 2. Auto-publish any existing pending songs
UPDATE public.songs SET status = 'approved' WHERE status = 'pending';

-- 3. Replace the public-read policy: show every non-hidden, non-rejected song
DROP POLICY IF EXISTS "Approved visible songs viewable by everyone" ON public.songs;
CREATE POLICY "Public songs viewable by everyone"
  ON public.songs FOR SELECT
  USING (status <> 'rejected' AND is_hidden = false);

-- 4. Auto-grant singer role to all existing users and future signups
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'singer'::app_role FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _username TEXT;
  _full_name TEXT;
BEGIN
  _username := COALESCE(
    NEW.raw_user_meta_data ->> 'username',
    split_part(NEW.email, '@', 1)
  );
  _full_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', _username);

  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = _username) LOOP
    _username := _username || floor(random() * 10000)::text;
  END LOOP;

  INSERT INTO public.profiles (id, username, full_name, phone)
  VALUES (NEW.id, _username, _full_name, NEW.raw_user_meta_data ->> 'phone');

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'listener');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'singer');

  RETURN NEW;
END;
$function$;
