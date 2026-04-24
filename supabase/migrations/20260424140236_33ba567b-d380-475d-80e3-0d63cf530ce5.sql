
-- ============ ENUM DE ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "user_roles_select_own" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============ TRIGGER updated_at GENÉRICO ============
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ HANDLE NEW USER (cria profile no signup) ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ BRIEFINGS ============
CREATE TABLE public.briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  scripts JSONB,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "briefings_select_own" ON public.briefings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "briefings_insert_own" ON public.briefings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "briefings_update_own" ON public.briefings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "briefings_delete_own" ON public.briefings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX briefings_user_id_created_at_idx ON public.briefings (user_id, created_at DESC);

CREATE TRIGGER briefings_set_updated_at
  BEFORE UPDATE ON public.briefings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ VIDEOS ============
CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  briefing_id UUID REFERENCES public.briefings(id) ON DELETE SET NULL,
  script_hash TEXT NOT NULL,
  video_id TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "videos_select_own" ON public.videos
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "videos_insert_own" ON public.videos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "videos_update_own" ON public.videos
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "videos_delete_own" ON public.videos
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX videos_user_id_created_at_idx ON public.videos (user_id, created_at DESC);
CREATE INDEX videos_user_script_hash_idx ON public.videos (user_id, script_hash);

-- ============ TRANSLATIONS ============
CREATE TABLE public.translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  briefing_id UUID REFERENCES public.briefings(id) ON DELETE SET NULL,
  script_hash TEXT NOT NULL,
  language TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, script_hash, language)
);
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "translations_select_own" ON public.translations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "translations_insert_own" ON public.translations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "translations_update_own" ON public.translations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "translations_delete_own" ON public.translations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX translations_user_script_hash_idx ON public.translations (user_id, script_hash);

-- ============ CUSTOM AVATARS ============
CREATE TABLE public.custom_avatars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_id TEXT NOT NULL,
  avatar_name TEXT NOT NULL,
  preview_image_url TEXT,
  group_id TEXT,
  status TEXT NOT NULL DEFAULT 'training',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, avatar_id)
);
ALTER TABLE public.custom_avatars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_avatars_select_own" ON public.custom_avatars
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "custom_avatars_insert_own" ON public.custom_avatars
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "custom_avatars_update_own" ON public.custom_avatars
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "custom_avatars_delete_own" ON public.custom_avatars
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER custom_avatars_set_updated_at
  BEFORE UPDATE ON public.custom_avatars
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ CUSTOM VOICES ============
CREATE TABLE public.custom_voices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_id TEXT NOT NULL,
  name TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT 'Outro',
  provider TEXT NOT NULL DEFAULT 'elevenlabs',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, voice_id)
);
ALTER TABLE public.custom_voices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_voices_select_own" ON public.custom_voices
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "custom_voices_insert_own" ON public.custom_voices
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "custom_voices_update_own" ON public.custom_voices
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "custom_voices_delete_own" ON public.custom_voices
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ BATCHES ============
CREATE TABLE public.batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  briefing_id UUID REFERENCES public.briefings(id) ON DELETE SET NULL,
  matrix JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "batches_select_own" ON public.batches
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "batches_insert_own" ON public.batches
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "batches_update_own" ON public.batches
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "batches_delete_own" ON public.batches
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX batches_user_id_created_at_idx ON public.batches (user_id, created_at DESC);

CREATE TRIGGER batches_set_updated_at
  BEFORE UPDATE ON public.batches
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
