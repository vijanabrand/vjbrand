
REVOKE ALL ON FUNCTION public.notify_on_like() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_comment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_follow() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_play_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_play_count(uuid) TO authenticated;
