-- Realtime cross-device: habilita publicação para tabelas do app
ALTER PUBLICATION supabase_realtime ADD TABLE public.briefings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.videos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.batches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.translations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_avatars;
ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_voices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- Garante REPLICA IDENTITY FULL para receber payloads completos de UPDATE/DELETE
ALTER TABLE public.briefings REPLICA IDENTITY FULL;
ALTER TABLE public.videos REPLICA IDENTITY FULL;
ALTER TABLE public.batches REPLICA IDENTITY FULL;
ALTER TABLE public.translations REPLICA IDENTITY FULL;
ALTER TABLE public.custom_avatars REPLICA IDENTITY FULL;
ALTER TABLE public.custom_voices REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;