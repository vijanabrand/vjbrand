
DROP POLICY IF EXISTS "Super admins manage roles" ON public.user_roles;
CREATE POLICY "Super admins manage all roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins manage listener and singer roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND role IN ('listener','singer'))
  WITH CHECK (public.is_admin(auth.uid()) AND role IN ('listener','singer'));
