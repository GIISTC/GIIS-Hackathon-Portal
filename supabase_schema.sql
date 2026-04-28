-- 1. Create teams table
CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name text NOT NULL UNIQUE,
  team_code text NOT NULL UNIQUE,
  project_name text,
  track text,
  created_at timestamptz DEFAULT now()
);

-- 2. Create participants table
CREATE TABLE participants (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  grade text NOT NULL,
  is_team_leader boolean DEFAULT false,
  qr_token text NOT NULL UNIQUE,
  checked_in boolean DEFAULT false,
  checked_in_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 3. Create submissions table
CREATE TABLE submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE UNIQUE,
  project_name text NOT NULL,
  description text NOT NULL,
  github_url text NOT NULL,
  drive_url text,
  demo_url text,
  submitted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Create judges table
CREATE TABLE judges (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 5. Create scores table
CREATE TABLE scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  judge_id uuid REFERENCES judges(id) ON DELETE CASCADE,
  innovation int NOT NULL CHECK (innovation BETWEEN 1 AND 10),
  technical int NOT NULL CHECK (technical BETWEEN 1 AND 10),
  design int NOT NULL CHECK (design BETWEEN 1 AND 10),
  impact int NOT NULL CHECK (impact BETWEEN 1 AND 10),
  presentation int NOT NULL CHECK (presentation BETWEEN 1 AND 10),
  notes text,
  scored_at timestamptz DEFAULT now(),
  UNIQUE(team_id, judge_id)
);

-- 6. Setup Row Level Security (RLS)

-- Enable RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE judges ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Teams: Public can insert (during registration), authenticated users can read their own team or all if admin
CREATE POLICY "Public can insert teams" ON teams FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Users can update their own team" ON teams FOR UPDATE USING (
  id IN (SELECT team_id FROM participants WHERE id = auth.uid())
);

-- Participants: Public can insert (during registration) if they just signed up, authenticated users can read their own/teammates
CREATE POLICY "Public can insert participants" ON participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can read participants in same team" ON participants FOR SELECT USING (
  team_id = get_my_team_id() OR 
  EXISTS (SELECT 1 FROM judges WHERE id = auth.uid())
);
CREATE POLICY "Admin can update participants" ON participants FOR UPDATE USING (
  EXISTS (SELECT 1 FROM judges WHERE id = auth.uid())
);

-- Submissions: Teams can insert/update their own, anyone can read
CREATE POLICY "Teams can insert submissions" ON submissions FOR INSERT WITH CHECK (
  team_id IN (SELECT team_id FROM participants WHERE id = auth.uid())
);
CREATE POLICY "Teams can update their submissions" ON submissions FOR UPDATE USING (
  team_id IN (SELECT team_id FROM participants WHERE id = auth.uid())
);
CREATE POLICY "Anyone can read submissions" ON submissions FOR SELECT USING (true);

-- Judges: Only admins can manage, anyone can read
CREATE POLICY "Anyone can read judges" ON judges FOR SELECT USING (true);

-- Scores: Judges can insert/update their own scores, anyone can read
CREATE POLICY "Judges can insert scores" ON scores FOR INSERT WITH CHECK (
  judge_id = auth.uid()
);
CREATE POLICY "Judges can update their own scores" ON scores FOR UPDATE USING (
  judge_id = auth.uid()
);
CREATE POLICY "Anyone can read scores" ON scores FOR SELECT USING (true);

-- 7. Realtime setup
alter publication supabase_realtime add table scores;
alter publication supabase_realtime add table participants;

-- 8. Helper Functions
-- Function to check for existing emails during registration (bypasses RLS)
CREATE OR REPLACE FUNCTION check_existing_emails(emails_to_check text[])
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN ARRAY(
    SELECT email FROM participants WHERE email = ANY(emails_to_check)
  );
END;
-- Function to get current user's team ID safely (bypasses RLS recursion)
CREATE OR REPLACE FUNCTION get_my_team_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT team_id FROM participants WHERE id = auth.uid();
$$;

-- 9. Gavel System Enhancements
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS elo_rating float DEFAULT 1200.0;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS matches_played int DEFAULT 0;

CREATE TABLE IF NOT EXISTS matchups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  judge_id uuid REFERENCES judges(id) ON DELETE CASCADE,
  winner_id uuid REFERENCES submissions(id) ON DELETE CASCADE,
  loser_id uuid REFERENCES submissions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- 10. System Settings (Toggles)
CREATE TABLE IF NOT EXISTS system_settings (
  key text PRIMARY KEY,
  value boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

-- Initial settings
INSERT INTO system_settings (key, value) VALUES 
('submissions_enabled', true),
('team_switching_enabled', true)
ON CONFLICT (key) DO NOTHING;
