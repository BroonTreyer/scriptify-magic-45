
-- METRICS TABLE
CREATE TABLE IF NOT EXISTS public.metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  briefing_id uuid,
  script_hash text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, briefing_id, script_hash)
);

ALTER TABLE public.metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS metrics_select_own ON public.metrics;
DROP POLICY IF EXISTS metrics_insert_own ON public.metrics;
DROP POLICY IF EXISTS metrics_update_own ON public.metrics;
DROP POLICY IF EXISTS metrics_delete_own ON public.metrics;

CREATE POLICY metrics_select_own ON public.metrics
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY metrics_insert_own ON public.metrics
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY metrics_update_own ON public.metrics
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY metrics_delete_own ON public.metrics
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS metrics_set_updated_at ON public.metrics;
CREATE TRIGGER metrics_set_updated_at
  BEFORE UPDATE ON public.metrics
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.metrics REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'metrics'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.metrics';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS metrics_user_briefing_idx
  ON public.metrics (user_id, briefing_id);

-- handle_new_user com trim/NULLIF
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')), ''),
    NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')), '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- admin_list_users com is_admin (drop pra mudar tipo de retorno)
DROP FUNCTION IF EXISTS public.admin_list_users();

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  briefings_count bigint,
  videos_count bigint,
  batches_count bigint,
  is_admin boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::text AS email,
    p.full_name,
    u.created_at,
    COALESCE((SELECT COUNT(*) FROM public.briefings b WHERE b.user_id = u.id), 0) AS briefings_count,
    COALESCE((SELECT COUNT(*) FROM public.videos v WHERE v.user_id = u.id), 0) AS videos_count,
    COALESCE((SELECT COUNT(*) FROM public.batches ba WHERE ba.user_id = u.id), 0) AS batches_count,
    EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role = 'admin') AS is_admin
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$function$;

-- admin_set_role
CREATE OR REPLACE FUNCTION public.admin_set_role(
  _target uuid,
  _role app_role,
  _grant boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF _target = auth.uid() AND _role = 'admin' AND _grant = false THEN
    RAISE EXCEPTION 'cannot remove admin role from yourself' USING ERRCODE = '42501';
  END IF;

  IF _grant THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_target, _role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = _target AND role = _role;
  END IF;
END;
$function$;
