-- ============================================================
-- 00025_realtime_feed.sql
--
-- Kampen var live, men ikke resten av appen: står du på Hjem mens noen
-- poster eller heier, skjer ingenting før du drar ned. 00020 la KUN
-- match_sessions + match_events i realtime-publiseringen.
--
-- Her legges resten til:
--   feed_posts     → nytt innlegg dukker opp av seg selv
--   reactions      → 👏-telleren beveger seg live (også ved un-heia)
--   comments       → kommentartelleren likeså
--   notifications  → ulest-badgen på Varsler tikker uten fanebytte
--
-- Realtime respekterer RLS, og alle fire har allerede en SELECT-policy
-- («Members can view …» / «Users view own notifications»), så ingen får
-- se noe de ikke kunne lest med en vanlig spørring.
--
-- ⚠️ Ingen av tabellene får REPLICA IDENTITY FULL. Vi trenger ikke
-- payloaden — klienten REFETCHER ved endring (samme valg som
-- subscribeToMatch i 3C: en refetch kan ikke komme ut av synk).
-- ============================================================
DO $$
DECLARE
  t text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH t IN ARRAY ARRAY['feed_posts','reactions','comments','notifications']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format(
        'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
