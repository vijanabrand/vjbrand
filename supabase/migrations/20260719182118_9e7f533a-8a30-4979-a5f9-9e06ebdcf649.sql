
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'singer', 'listener');
CREATE TYPE public.song_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.watermark_status AS ENUM ('pending', 'processing', 'done', 'skipped', 'failed');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  bio TEXT,
  phone TEXT,
  website TEXT,
  social_links JSONB DEFAULT '{}'::jsonb,
  is_suspended BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'super_admin')
  );
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Super admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins update any profile" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- Auto-create profile + assign listener role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _username TEXT;
  _full_name TEXT;
BEGIN
  _username := COALESCE(
    NEW.raw_user_meta_data ->> 'username',
    split_part(NEW.email, '@', 1)
  );
  _full_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', _username);

  -- ensure unique username
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = _username) LOOP
    _username := _username || floor(random() * 10000)::text;
  END LOOP;

  INSERT INTO public.profiles (id, username, full_name, phone)
  VALUES (NEW.id, _username, _full_name, NEW.raw_user_meta_data ->> 'phone');

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'listener');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ GENRES ============
CREATE TABLE public.genres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  cover_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.genres TO anon, authenticated;
GRANT ALL ON public.genres TO service_role;
ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Genres viewable by everyone" ON public.genres FOR SELECT USING (true);
CREATE POLICY "Admins manage genres" ON public.genres FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.genres (name, slug) VALUES
  ('Afrobeats','afrobeats'),('Bongo Flava','bongo-flava'),('Amapiano','amapiano'),
  ('Hip Hop','hip-hop'),('R&B','rnb'),('Gospel','gospel'),('Reggae','reggae'),
  ('Pop','pop'),('Traditional','traditional'),('Other','other');

-- ============ SONGS ============
CREATE TABLE public.songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  -- audio pipeline: original private, processed public (future watermarking)
  original_audio_path TEXT NOT NULL,       -- path in 'songs' private bucket
  processed_audio_path TEXT,               -- path in 'processed_songs' public bucket
  audio_mime TEXT,
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  genre_id UUID REFERENCES public.genres(id) ON DELETE SET NULL,
  language TEXT,
  album TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  release_date DATE,
  status public.song_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  watermark_status public.watermark_status NOT NULL DEFAULT 'pending',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  play_count INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_songs_status ON public.songs(status);
CREATE INDEX idx_songs_singer ON public.songs(singer_id);
CREATE INDEX idx_songs_genre ON public.songs(genre_id);
CREATE INDEX idx_songs_created ON public.songs(created_at DESC);

GRANT SELECT ON public.songs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.songs TO authenticated;
GRANT ALL ON public.songs TO service_role;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved visible songs viewable by everyone" ON public.songs
  FOR SELECT USING (status = 'approved' AND is_hidden = false);
CREATE POLICY "Owners can view own songs" ON public.songs
  FOR SELECT TO authenticated USING (auth.uid() = singer_id);
CREATE POLICY "Admins can view all songs" ON public.songs
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Singers can insert own songs" ON public.songs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = singer_id);
CREATE POLICY "Owners update own songs" ON public.songs
  FOR UPDATE TO authenticated USING (auth.uid() = singer_id);
CREATE POLICY "Admins update any song" ON public.songs
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Owners delete own songs" ON public.songs
  FOR DELETE TO authenticated USING (auth.uid() = singer_id);
CREATE POLICY "Admins delete any song" ON public.songs
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER songs_updated_at BEFORE UPDATE ON public.songs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SONG LIKES ============
CREATE TABLE public.song_likes (
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (song_id, user_id)
);
GRANT SELECT ON public.song_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.song_likes TO authenticated;
GRANT ALL ON public.song_likes TO service_role;
ALTER TABLE public.song_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes viewable by everyone" ON public.song_likes FOR SELECT USING (true);
CREATE POLICY "Users can like" ON public.song_likes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike own" ON public.song_likes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.bump_like_count()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.songs SET like_count = like_count + 1 WHERE id = NEW.song_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.songs SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.song_id;
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER song_likes_count AFTER INSERT OR DELETE ON public.song_likes
  FOR EACH ROW EXECUTE FUNCTION public.bump_like_count();

-- ============ COMMENTS ============
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_song ON public.comments(song_id);
GRANT SELECT ON public.comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments viewable by everyone" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Auth users comment" ON public.comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users edit own comment" ON public.comments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own comment" ON public.comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins delete comments" ON public.comments
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER comments_updated_at BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ DOWNLOADS ============
CREATE TABLE public.downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_downloads_song ON public.downloads(song_id);
GRANT SELECT, INSERT ON public.downloads TO authenticated;
GRANT ALL ON public.downloads TO service_role;
ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own downloads" ON public.downloads
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins see all downloads" ON public.downloads
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Users record own downloads" ON public.downloads
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.bump_download_count()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.songs SET download_count = download_count + 1 WHERE id = NEW.song_id;
  RETURN NULL;
END; $$;
CREATE TRIGGER downloads_count AFTER INSERT ON public.downloads
  FOR EACH ROW EXECUTE FUNCTION public.bump_download_count();

-- ============ FOLLOWERS ============
CREATE TABLE public.followers (
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
GRANT SELECT ON public.followers TO anon;
GRANT SELECT, INSERT, DELETE ON public.followers TO authenticated;
GRANT ALL ON public.followers TO service_role;
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Follows viewable by everyone" ON public.followers FOR SELECT USING (true);
CREATE POLICY "Users can follow" ON public.followers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON public.followers
  FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- ============ FAVORITES ============
CREATE TABLE public.favorites (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, song_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own favorites" ON public.favorites
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users add favorites" ON public.favorites
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove favorites" ON public.favorites
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ PLAYLISTS ============
CREATE TABLE public.playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.playlists TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlists TO authenticated;
GRANT ALL ON public.playlists TO service_role;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public playlists viewable" ON public.playlists FOR SELECT USING (is_public = true);
CREATE POLICY "Owner sees own playlists" ON public.playlists
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owner manages playlists" ON public.playlists
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER playlists_updated_at BEFORE UPDATE ON public.playlists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.playlist_songs (
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (playlist_id, song_id)
);
GRANT SELECT ON public.playlist_songs TO anon;
GRANT SELECT, INSERT, DELETE, UPDATE ON public.playlist_songs TO authenticated;
GRANT ALL ON public.playlist_songs TO service_role;
ALTER TABLE public.playlist_songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Playlist songs follow playlist visibility" ON public.playlist_songs
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.playlists p
    WHERE p.id = playlist_id AND (p.is_public OR p.user_id = auth.uid())
  ));
CREATE POLICY "Owner manages playlist songs" ON public.playlist_songs
  FOR ALL TO authenticated USING (EXISTS (
    SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.user_id = auth.uid()
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.user_id = auth.uid()
  ));

-- ============ REPORTS ============
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id UUID REFERENCES public.songs(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users create reports" ON public.reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users see own reports" ON public.reports
  FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
CREATE POLICY "Admins manage reports" ON public.reports
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users mark own read" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
