-- Add Devotional as a top-level genre with common sub-genres.
-- This covers Indian (Bhajan, Kirtan, Qawwali, Shabad), Christian gospel,
-- and other religious/spiritual music that doesn't fit cleanly under
-- existing genres like World/Regional or Gospel/Christian.

INSERT INTO public.sa_taxonomies (type, value, label, sort_order) VALUES
  ('genre', 'devotional', 'Devotional / Spiritual', 165)
ON CONFLICT (type, value) DO NOTHING;

WITH parents AS (
  SELECT id, value FROM public.sa_taxonomies WHERE type = 'genre'
)
INSERT INTO public.sa_taxonomies (type, value, label, parent_id, sort_order)
SELECT 'sub_genre', sub.value, sub.label, parents.id, sub.sort_order
FROM (VALUES
  -- Hindu devotional
  ('devotional', 'bhajan',          'Bhajan',          10),
  ('devotional', 'kirtan',           'Kirtan',          20),
  ('devotional', 'aarti',            'Aarti',           30),
  ('devotional', 'mantra_chant',     'Mantra / Chant',  40),
  -- Sikh devotional
  ('devotional', 'shabad',           'Shabad',          50),
  ('devotional', 'gurbani',          'Gurbani',         60),
  -- Islamic devotional
  ('devotional', 'qawwali',          'Qawwali',         70),
  ('devotional', 'naat',             'Naat',            80),
  ('devotional', 'nasheed',          'Nasheed',         90),
  -- Christian devotional
  ('devotional', 'hymns',            'Hymns',           100),
  ('devotional', 'worship',          'Contemporary Worship', 110),
  ('devotional', 'gospel_devotional','Gospel (Devotional)', 120),
  -- Buddhist / other
  ('devotional', 'buddhist_chant',   'Buddhist Chant',  130),
  -- Cross-tradition
  ('devotional', 'meditation',       'Meditation',      140),
  ('devotional', 'spiritual_folk',   'Spiritual Folk',  150)
) AS sub (parent_value, value, label, sort_order)
JOIN parents ON parents.value = sub.parent_value
ON CONFLICT (type, value) DO NOTHING;
