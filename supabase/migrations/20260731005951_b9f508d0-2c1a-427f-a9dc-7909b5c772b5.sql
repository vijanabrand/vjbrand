-- 1. GUEST PLAYBACK: allow public read of song audio objects
DROP POLICY IF EXISTS "Songs owner read" ON storage.objects;
CREATE POLICY "Songs public read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'songs');
CREATE POLICY "Songs owner manage read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'songs');

-- 2. PERMANENT SUPER ADMIN PROTECTION
CREATE OR REPLACE FUNCTION public.protect_super_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'super_admin' THEN
      RAISE EXCEPTION 'The permanent super admin role cannot be removed';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.role = 'super_admin' AND NEW.role <> 'super_admin' THEN
    RAISE EXCEPTION 'The permanent super admin role cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_super_admin_role ON public.user_roles;
CREATE TRIGGER trg_protect_super_admin_role
BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin_role();

CREATE OR REPLACE FUNCTION public.protect_super_admin_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'super_admin') THEN
    IF NEW.is_suspended THEN
      RAISE EXCEPTION 'The permanent super admin account cannot be suspended';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_super_admin_profile ON public.profiles;
CREATE TRIGGER trg_protect_super_admin_profile
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin_profile();

-- 3. Unique usernames (case-insensitive) so username login resolves to exactly one account
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key ON public.profiles (lower(username));

REVOKE ALL ON FUNCTION public.protect_super_admin_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_super_admin_profile() FROM PUBLIC, anon, authenticated;