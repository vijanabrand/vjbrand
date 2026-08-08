
-- Tighten SECURITY DEFINER functions per linter
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_like_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_download_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

-- =========== STORAGE POLICIES ===========

-- Avatars: public read, owner writes to /{user_id}/...
CREATE POLICY "Avatars public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Avatars owner insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Avatars owner update" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Avatars owner delete" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Covers: same shape
CREATE POLICY "Covers public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'covers');
CREATE POLICY "Covers owner insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Covers owner update" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Covers owner delete" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Processed songs: public streaming, owner or admin writes
CREATE POLICY "Processed songs public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'processed_songs');
CREATE POLICY "Processed songs owner insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'processed_songs' AND (
      auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid())
    )
  );
CREATE POLICY "Processed songs owner update" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'processed_songs' AND (
      auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid())
    )
  );
CREATE POLICY "Processed songs owner delete" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'processed_songs' AND (
      auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid())
    )
  );

-- Songs (private originals): owner or admin only
CREATE POLICY "Songs owner read" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'songs' AND (
      auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid())
    )
  );
CREATE POLICY "Songs owner insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'songs' AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Songs owner delete" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'songs' AND (
      auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid())
    )
  );
