-- sa_taxonomies: reference-data lists managed by superadmins.
-- Used for genres, sub-genres, languages, moods, and other enum-like fields
-- that shouldn't require a code deploy to update.
--
-- Sub-genres use parent_id to link back to their parent genre.

CREATE TABLE IF NOT EXISTS public.sa_taxonomies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,          -- 'genre' | 'sub_genre' | 'language' | 'mood' | 'credit_role' | 'tag'
  value       TEXT NOT NULL,          -- machine key (e.g. 'hip_hop')
  label       TEXT NOT NULL,          -- display name (e.g. 'Hip-Hop')
  parent_id   UUID REFERENCES public.sa_taxonomies(id) ON DELETE SET NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sa_taxonomies_type_value_unique UNIQUE (type, value)
);

CREATE INDEX IF NOT EXISTS idx_sa_taxonomies_type_active_sort
  ON public.sa_taxonomies (type, active, sort_order);
CREATE INDEX IF NOT EXISTS idx_sa_taxonomies_parent
  ON public.sa_taxonomies (parent_id);

-- RLS: any authenticated user can read active taxonomies (needed for CMS + mobile app).
ALTER TABLE public.sa_taxonomies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sa_taxonomies_read ON public.sa_taxonomies;
CREATE POLICY sa_taxonomies_read
  ON public.sa_taxonomies
  FOR SELECT
  TO authenticated
  USING (active = TRUE);

-- ── Seed data ───────────────────────────────────────────────────────────────

-- Genres (top-level families)
INSERT INTO public.sa_taxonomies (type, value, label, sort_order) VALUES
  ('genre', 'pop',                'Pop',                 10),
  ('genre', 'rock',               'Rock',                20),
  ('genre', 'hip_hop',            'Hip-Hop / Rap',       30),
  ('genre', 'electronic',         'Electronic / EDM',    40),
  ('genre', 'rnb_soul',           'R&B / Soul',          50),
  ('genre', 'jazz',               'Jazz',                60),
  ('genre', 'classical',          'Classical',           70),
  ('genre', 'country',            'Country',             80),
  ('genre', 'latin',              'Latin',               90),
  ('genre', 'reggae',             'Reggae / Dancehall', 100),
  ('genre', 'blues',              'Blues',              110),
  ('genre', 'folk',               'Folk / Acoustic',    120),
  ('genre', 'metal',              'Metal',              130),
  ('genre', 'punk',               'Punk',               140),
  ('genre', 'indie',              'Indie / Alternative',150),
  ('genre', 'world',              'World / Regional',   160),
  ('genre', 'gospel',             'Gospel / Christian', 170),
  ('genre', 'soundtracks',        'Soundtracks / Scores',180),
  ('genre', 'experimental',       'Experimental / Avant-garde', 190),
  ('genre', 'instrumental',       'Instrumental',       200)
ON CONFLICT (type, value) DO NOTHING;

-- Sub-genres linked to their parent genre via parent_id
-- We use a CTE to look up parent IDs by (type, value) after inserting the genres above.
WITH parents AS (
  SELECT id, value FROM public.sa_taxonomies WHERE type = 'genre'
)
INSERT INTO public.sa_taxonomies (type, value, label, parent_id, sort_order)
SELECT 'sub_genre', sub.value, sub.label, parents.id, sub.sort_order
FROM (VALUES
  -- Pop
  ('pop', 'dance_pop',       'Dance Pop',       10),
  ('pop', 'synth_pop',       'Synth Pop',       20),
  ('pop', 'electropop',      'Electropop',      30),
  ('pop', 'indie_pop',       'Indie Pop',       40),
  ('pop', 'teen_pop',        'Teen Pop',        50),
  ('pop', 'k_pop',           'K-Pop',           60),
  ('pop', 'j_pop',           'J-Pop',           70),
  ('pop', 'bedroom_pop',     'Bedroom Pop',     80),
  ('pop', 'hyperpop',        'Hyperpop',        90),
  -- Rock
  ('rock', 'classic_rock',       'Classic Rock',       10),
  ('rock', 'hard_rock',          'Hard Rock',          20),
  ('rock', 'alternative_rock',   'Alternative Rock',   30),
  ('rock', 'indie_rock',         'Indie Rock',         40),
  ('rock', 'psychedelic_rock',   'Psychedelic Rock',   50),
  ('rock', 'progressive_rock',   'Progressive Rock',   60),
  ('rock', 'garage_rock',        'Garage Rock',        70),
  ('rock', 'blues_rock',         'Blues Rock',         80),
  -- Hip-Hop
  ('hip_hop', 'trap',            'Trap',            10),
  ('hip_hop', 'boom_bap',        'Boom Bap',        20),
  ('hip_hop', 'drill',           'Drill',           30),
  ('hip_hop', 'gangsta_rap',     'Gangsta Rap',     40),
  ('hip_hop', 'conscious_rap',   'Conscious Rap',   50),
  ('hip_hop', 'lofi_hiphop',     'Lo-fi Hip-Hop',   60),
  ('hip_hop', 'cloud_rap',       'Cloud Rap',       70),
  -- Electronic / EDM
  ('electronic', 'house',               'House',               10),
  ('electronic', 'deep_house',          'Deep House',          20),
  ('electronic', 'tech_house',          'Tech House',          30),
  ('electronic', 'progressive_house',   'Progressive House',   40),
  ('electronic', 'techno',              'Techno',              50),
  ('electronic', 'trance',              'Trance',              60),
  ('electronic', 'dubstep',             'Dubstep',             70),
  ('electronic', 'drum_and_bass',       'Drum & Bass',         80),
  ('electronic', 'future_bass',         'Future Bass',         90),
  ('electronic', 'ambient',             'Ambient',             100),
  ('electronic', 'idm',                 'IDM',                 110),
  ('electronic', 'synthwave',           'Synthwave',           120),
  -- R&B / Soul
  ('rnb_soul', 'contemporary_rnb', 'Contemporary R&B', 10),
  ('rnb_soul', 'neo_soul',         'Neo Soul',         20),
  ('rnb_soul', 'funk',             'Funk',             30),
  ('rnb_soul', 'motown',           'Motown',           40),
  ('rnb_soul', 'quiet_storm',      'Quiet Storm',      50),
  -- Jazz
  ('jazz', 'smooth_jazz', 'Smooth Jazz', 10),
  ('jazz', 'bebop',       'Bebop',       20),
  ('jazz', 'swing',       'Swing',       30),
  ('jazz', 'fusion',      'Fusion',      40),
  ('jazz', 'free_jazz',   'Free Jazz',   50),
  ('jazz', 'latin_jazz',  'Latin Jazz',  60),
  -- Classical
  ('classical', 'baroque',           'Baroque',           10),
  ('classical', 'romantic',          'Romantic',          20),
  ('classical', 'modern_classical',  'Modern Classical',  30),
  ('classical', 'opera',             'Opera',             40),
  ('classical', 'chamber_music',     'Chamber Music',     50),
  ('classical', 'orchestral',        'Orchestral',        60),
  -- Country
  ('country', 'classic_country', 'Classic Country', 10),
  ('country', 'country_pop',     'Country Pop',     20),
  ('country', 'country_rock',    'Country Rock',    30),
  ('country', 'bluegrass',       'Bluegrass',       40),
  ('country', 'americana',       'Americana',       50),
  -- Latin
  ('latin', 'reggaeton',   'Reggaeton',   10),
  ('latin', 'bachata',     'Bachata',     20),
  ('latin', 'salsa',       'Salsa',       30),
  ('latin', 'merengue',    'Merengue',    40),
  ('latin', 'latin_pop',   'Latin Pop',   50),
  ('latin', 'latin_trap',  'Latin Trap',  60),
  -- Reggae / Dancehall
  ('reggae', 'roots_reggae', 'Roots Reggae', 10),
  ('reggae', 'dub',          'Dub',          20),
  ('reggae', 'dancehall',    'Dancehall',    30),
  ('reggae', 'ska',          'Ska',          40),
  -- Metal
  ('metal', 'heavy_metal',  'Heavy Metal',  10),
  ('metal', 'death_metal',  'Death Metal',  20),
  ('metal', 'black_metal',  'Black Metal',  30),
  ('metal', 'thrash_metal', 'Thrash Metal', 40),
  ('metal', 'doom_metal',   'Doom Metal',   50),
  ('metal', 'metalcore',    'Metalcore',    60),
  ('metal', 'djent',        'Djent',        70),
  -- Punk
  ('punk', 'punk_rock',      'Punk Rock',      10),
  ('punk', 'pop_punk',       'Pop Punk',       20),
  ('punk', 'hardcore_punk',  'Hardcore Punk',  30),
  ('punk', 'post_punk',      'Post-Punk',      40),
  -- Indie / Alternative
  ('indie', 'indie_folk', 'Indie Folk', 10),
  ('indie', 'indie_pop',  'Indie Pop',  20),
  ('indie', 'shoegaze',   'Shoegaze',   30),
  ('indie', 'dream_pop',  'Dream Pop',  40),
  ('indie', 'post_rock',  'Post-Rock',  50),
  -- World / Regional
  ('world', 'afrobeats',         'Afrobeats',         10),
  ('world', 'indian_classical',  'Indian Classical',  20),
  ('world', 'carnatic',          'Carnatic',          30),
  ('world', 'hindustani',        'Hindustani',        40),
  ('world', 'tamil_pop',         'Tamil Pop',         50),
  ('world', 'punjabi_pop',       'Punjabi Pop',       60),
  ('world', 'bollywood',         'Bollywood',         70),
  ('world', 'arabic_pop',        'Arabic Pop',        80),
  ('world', 'latin_folk',        'Latin Folk',        90),
  ('world', 'balkan_music',      'Balkan Music',      100),
  -- Folk
  ('folk', 'contemporary_folk', 'Contemporary Folk', 10),
  ('folk', 'indie_folk',        'Indie Folk',        20),
  ('folk', 'traditional_folk',  'Traditional Folk',  30),
  -- Blues
  ('blues', 'delta_blues',    'Delta Blues',    10),
  ('blues', 'chicago_blues',  'Chicago Blues',  20),
  ('blues', 'electric_blues', 'Electric Blues', 30),
  -- Experimental
  ('experimental', 'vaporwave',      'Vaporwave',      10),
  ('experimental', 'witch_house',    'Witch House',    20),
  ('experimental', 'glitchcore',     'Glitchcore',     30),
  ('experimental', 'noise',          'Noise',          40),
  ('experimental', 'dark_ambient',   'Dark Ambient',   50),
  ('experimental', 'drone',          'Drone',          60),
  ('experimental', 'plunderphonics', 'Plunderphonics', 70)
) AS sub (parent_value, value, label, sort_order)
JOIN parents ON parents.value = sub.parent_value
ON CONFLICT (type, value) DO NOTHING;

-- Languages
INSERT INTO public.sa_taxonomies (type, value, label, sort_order) VALUES
  ('language', 'english',       'English',            10),
  ('language', 'hindi',         'Hindi',              20),
  ('language', 'instrumental',  'Instrumental',       30),
  ('language', 'spanish',       'Spanish',            40),
  ('language', 'french',        'French',             50),
  ('language', 'german',        'German',             60),
  ('language', 'italian',       'Italian',            70),
  ('language', 'portuguese',    'Portuguese',         80),
  ('language', 'mandarin',      'Mandarin (Chinese)', 90),
  ('language', 'japanese',      'Japanese',           100),
  ('language', 'korean',        'Korean',             110),
  ('language', 'arabic',        'Arabic',             120),
  ('language', 'russian',       'Russian',            130),
  ('language', 'tamil',         'Tamil',              140),
  ('language', 'telugu',        'Telugu',             150),
  ('language', 'kannada',       'Kannada',            160),
  ('language', 'malayalam',     'Malayalam',          170),
  ('language', 'punjabi',       'Punjabi',            180),
  ('language', 'marathi',       'Marathi',            190),
  ('language', 'bengali',       'Bengali',            200),
  ('language', 'gujarati',      'Gujarati',           210),
  ('language', 'urdu',          'Urdu',               220)
ON CONFLICT (type, value) DO NOTHING;

-- Moods
INSERT INTO public.sa_taxonomies (type, value, label, sort_order) VALUES
  ('mood', 'dreamy',        'Dreamy',         10),
  ('mood', 'energetic',     'Energetic',      20),
  ('mood', 'chill',         'Chill',          30),
  ('mood', 'dark',          'Dark',           40),
  ('mood', 'uplifting',     'Uplifting',      50),
  ('mood', 'melancholic',   'Melancholic',    60),
  ('mood', 'aggressive',    'Aggressive',     70),
  ('mood', 'romantic',      'Romantic',       80),
  ('mood', 'nocturnal',     'Nocturnal',      90),
  ('mood', 'euphoric',      'Euphoric',       100),
  ('mood', 'nostalgic',     'Nostalgic',      110),
  ('mood', 'ethereal',      'Ethereal',       120),
  ('mood', 'groovy',        'Groovy',         130),
  ('mood', 'introspective', 'Introspective',  140),
  ('mood', 'hypnotic',      'Hypnotic',       150)
ON CONFLICT (type, value) DO NOTHING;
