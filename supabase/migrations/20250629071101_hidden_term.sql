/*
  # Comprehensive Database Fix for FoodWasteConnector

  1. Database Structure
    - Ensure all tables exist with correct structure
    - Fix all foreign key relationships
    - Add missing columns and constraints

  2. Security
    - Enable RLS on all tables
    - Create comprehensive policies for all user types
    - Ensure proper data isolation

  3. Performance
    - Add necessary indexes
    - Optimize query performance
*/

-- Create auth schema if it doesn't exist (for local development)
CREATE SCHEMA IF NOT EXISTS auth;

-- Ensure profiles table exists with all required columns
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  user_type text NOT NULL CHECK (user_type IN ('donor', 'shelter', 'volunteer')),
  phone text,
  created_at timestamptz DEFAULT now()
);

-- Ensure donations table exists with all required columns
CREATE TABLE IF NOT EXISTS donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_name text NOT NULL,
  food_type text NOT NULL,
  quantity text NOT NULL,
  pickup_location text NOT NULL,
  pickup_coordinates text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'cancelled')),
  shelter_id uuid REFERENCES profiles(id),
  donor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  volunteer_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  notes text
);

-- Add missing columns to existing tables
DO $$
BEGIN
  -- Add missing columns to profiles table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone text;
  END IF;

  -- Add missing columns to donations table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'donations' AND column_name = 'pickup_coordinates'
  ) THEN
    ALTER TABLE donations ADD COLUMN pickup_coordinates text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'donations' AND column_name = 'volunteer_id'
  ) THEN
    ALTER TABLE donations ADD COLUMN volunteer_id uuid REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'donations' AND column_name = 'accepted_at'
  ) THEN
    ALTER TABLE donations ADD COLUMN accepted_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'donations' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE donations ADD COLUMN completed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'donations' AND column_name = 'notes'
  ) THEN
    ALTER TABLE donations ADD COLUMN notes text;
  END IF;
END $$;

-- Create helper function to get current user ID
CREATE OR REPLACE FUNCTION uid() RETURNS uuid AS $$
  SELECT auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Create or replace the timestamp update function
CREATE OR REPLACE FUNCTION update_donation_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    NEW.accepted_at = now();
  END IF;
  
  IF NEW.status = 'completed' AND OLD.status = 'accepted' THEN
    NEW.completed_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS donation_status_timestamps ON donations;
CREATE TRIGGER donation_status_timestamps
  BEFORE UPDATE ON donations
  FOR EACH ROW
  EXECUTE FUNCTION update_donation_timestamps();

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can create own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Donors can create donations" ON donations;
DROP POLICY IF EXISTS "Donors can read own donations" ON donations;
DROP POLICY IF EXISTS "Shelters can read pending donations" ON donations;
DROP POLICY IF EXISTS "Shelters can update donations to accepted" ON donations;
DROP POLICY IF EXISTS "Volunteers can read accepted donations" ON donations;
DROP POLICY IF EXISTS "Volunteers can update donations to completed" ON donations;

-- Create comprehensive profiles policies
CREATE POLICY "Users can create own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (uid() = id);

CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (uid() = id)
  WITH CHECK (uid() = id);

-- Create comprehensive donations policies
CREATE POLICY "Donors can create donations"
  ON donations
  FOR INSERT
  TO authenticated
  WITH CHECK (uid() = donor_id);

CREATE POLICY "Donors can read own donations"
  ON donations
  FOR SELECT
  TO authenticated
  USING (uid() = donor_id);

CREATE POLICY "Shelters can read pending donations"
  ON donations
  FOR SELECT
  TO authenticated
  USING (
    (status = 'pending'::text) OR 
    ((shelter_id IS NOT NULL) AND (shelter_id IN (
      SELECT profiles.id FROM profiles 
      WHERE ((profiles.id = uid()) AND (profiles.user_type = 'shelter'::text))
    )))
  );

CREATE POLICY "Shelters can update donations to accepted"
  ON donations
  FOR UPDATE
  TO authenticated
  USING (
    (status = 'pending'::text) AND 
    (uid() IN (
      SELECT profiles.id FROM profiles 
      WHERE (profiles.user_type = 'shelter'::text)
    ))
  )
  WITH CHECK (
    (status = 'accepted'::text) AND 
    (shelter_id = uid())
  );

CREATE POLICY "Volunteers can read accepted donations"
  ON donations
  FOR SELECT
  TO authenticated
  USING (
    (status = ANY (ARRAY['accepted'::text, 'completed'::text])) AND 
    (uid() IN (
      SELECT profiles.id FROM profiles 
      WHERE (profiles.user_type = 'volunteer'::text)
    ))
  );

CREATE POLICY "Volunteers can update donations to completed"
  ON donations
  FOR UPDATE
  TO authenticated
  USING (
    (status = 'accepted'::text) AND 
    (uid() IN (
      SELECT profiles.id FROM profiles 
      WHERE (profiles.user_type = 'volunteer'::text)
    ))
  )
  WITH CHECK (status = 'completed'::text);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_donor_id ON donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_donations_shelter_id ON donations(shelter_id);
CREATE INDEX IF NOT EXISTS idx_donations_volunteer_id ON donations(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON profiles(user_type);

-- Add constraints if they don't exist
DO $$
BEGIN
  -- Add user_type constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_user_type_check' 
    AND table_name = 'profiles'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_user_type_check 
    CHECK (user_type = ANY (ARRAY['donor'::text, 'shelter'::text, 'volunteer'::text]));
  END IF;

  -- Add status constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'donations_status_check' 
    AND table_name = 'donations'
  ) THEN
    ALTER TABLE donations ADD CONSTRAINT donations_status_check 
    CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'completed'::text, 'cancelled'::text]));
  END IF;
END $$;