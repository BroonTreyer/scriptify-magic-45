
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  briefings_count bigint,
  videos_count bigint,
  batches_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    COALESCE((SELECT COUNT(*) FROM public.batches ba WHERE ba.user_id = u.id), 0) AS batches_count
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
