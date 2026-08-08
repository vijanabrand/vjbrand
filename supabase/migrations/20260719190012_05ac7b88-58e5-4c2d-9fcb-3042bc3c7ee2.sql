
-- Play count RPC (any authenticated user can bump)
CREATE OR REPLACE FUNCTION public.increment_play_count(_song_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.songs SET play_count = play_count + 1 WHERE id = _song_id;
$$;
REVOKE ALL ON FUNCTION public.increment_play_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_play_count(uuid) TO authenticated, anon;

-- Notification helpers/triggers
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _singer uuid; _title text; _liker text;
BEGIN
  SELECT singer_id, title INTO _singer, _title FROM public.songs WHERE id = NEW.song_id;
  IF _singer IS NULL OR _singer = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(full_name, username) INTO _liker FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications(user_id, type, title, body, link)
  VALUES (_singer, 'like', 'New like', COALESCE(_liker,'Someone') || ' liked "' || _title || '"', '/song/' || NEW.song_id);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _singer uuid; _title text; _commenter text; _parent_user uuid;
BEGIN
  SELECT singer_id, title INTO _singer, _title FROM public.songs WHERE id = NEW.song_id;
  SELECT COALESCE(full_name, username) INTO _commenter FROM public.profiles WHERE id = NEW.user_id;
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO _parent_user FROM public.comments WHERE id = NEW.parent_id;
    IF _parent_user IS NOT NULL AND _parent_user <> NEW.user_id THEN
      INSERT INTO public.notifications(user_id, type, title, body, link)
      VALUES (_parent_user, 'reply', 'New reply', COALESCE(_commenter,'Someone') || ' replied to your comment', '/song/' || NEW.song_id);
    END IF;
  END IF;
  IF _singer IS NOT NULL AND _singer <> NEW.user_id AND (NEW.parent_id IS NULL OR _singer <> _parent_user) THEN
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (_singer, 'comment', 'New comment', COALESCE(_commenter,'Someone') || ' commented on "' || _title || '"', '/song/' || NEW.song_id);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _follower text;
BEGIN
  IF NEW.follower_id = NEW.following_id THEN RETURN NEW; END IF;
  SELECT COALESCE(full_name, username) INTO _follower FROM public.profiles WHERE id = NEW.follower_id;
  INSERT INTO public.notifications(user_id, type, title, body, link)
  VALUES (NEW.following_id, 'follow', 'New follower', COALESCE(_follower,'Someone') || ' started following you', '/artist/' || NEW.follower_id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_like ON public.song_likes;
CREATE TRIGGER trg_notify_like AFTER INSERT ON public.song_likes
FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();

DROP TRIGGER IF EXISTS trg_notify_comment ON public.comments;
CREATE TRIGGER trg_notify_comment AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

DROP TRIGGER IF EXISTS trg_notify_follow ON public.followers;
CREATE TRIGGER trg_notify_follow AFTER INSERT ON public.followers
FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

-- Ensure like/download count triggers exist (idempotent)
DROP TRIGGER IF EXISTS trg_bump_like ON public.song_likes;
CREATE TRIGGER trg_bump_like AFTER INSERT OR DELETE ON public.song_likes
FOR EACH ROW EXECUTE FUNCTION public.bump_like_count();

DROP TRIGGER IF EXISTS trg_bump_download ON public.downloads;
CREATE TRIGGER trg_bump_download AFTER INSERT ON public.downloads
FOR EACH ROW EXECUTE FUNCTION public.bump_download_count();

-- Allow authenticated users to view basic profile info (needed for lookups)
-- Already exists likely; skip.
