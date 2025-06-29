/*
  # Fix Authentication Flow and Database Schema

  1. Database Schema Updates
    - Ensure all required columns exist in profiles and donations tables
    - Fix foreign key constraints to reference correct tables
    - Add proper indexes for performance

  2. Security Policies
    - Update RLS policies to work with the correct table structure
    - Ensure proper access control for all user types

  3. Helper Functions
    - Create utility functions for timestamp management
    - Add helper function for getting current user ID
*/

-- Ensure all required columns exist in profiles table
DO $$
BEGIN
  -- Add phone column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone text;
  END IF;
END $$;

-- Ensure all required columns exist in donations table
DO $$
BEGIN
  -- Add pickup_coordinates column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'donations' AND column_name = 'pickup_coordinates'
  ) THEN
    ALTER TABLE donations ADD COLUMN pickup_coordinates text;
  END IF;

  -- Add volunteer_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'donations' AND column_name = 'volunteer_id'
  ) THEN
    ALTER TABLE donations ADD COLUMN volunteer_id uuid;
  END IF;

  -- Add accepted_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'donations' AND column_name = 'accepted_at'
  ) THEN
    ALTER TABLE donations ADD COLUMN accepted_at timestamptz;
  END IF;

  -- Add completed_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'donations' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE donations ADD COLUMN completed_at timestamptz;
  END IF;

  -- Add notes column if it doesn't exist
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

-- Create profiles policies
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

-- Create donations policies
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

-- Fix foreign key constraints
DO $$
BEGIN
  -- Fix donations foreign keys
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'donations_donor_id_fkey' 
    AND table_name = 'donations'
  ) THEN
    ALTER TABLE donations DROP CONSTRAINT donations_donor_id_fkey;
  END IF;

  -- Add correct foreign key constraint for donor_id (references auth.users)
  ALTER TABLE donations ADD CONSTRAINT donations_donor_id_fkey 
  FOREIGN KEY (donor_id) REFERENCES auth.users(id) ON DELETE CASCADE;

  -- Fix volunteer_id foreign key
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'donations_volunteer_id_fkey' 
    AND table_name = 'donations'
  ) THEN
    ALTER TABLE donations DROP CONSTRAINT donations_volunteer_id_fkey;
  END IF;

  ALTER TABLE donations ADD CONSTRAINT donations_volunteer_id_fkey 
  FOREIGN KEY (volunteer_id) REFERENCES profiles(id);

  -- Fix shelter_id foreign key
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'donations_shelter_id_fkey' 
    AND table_name = 'donations'
  ) THEN
    ALTER TABLE donations DROP CONSTRAINT donations_shelter_id_fkey;
  END IF;

  ALTER TABLE donations ADD CONSTRAINT donations_shelter_id_fkey 
  FOREIGN KEY (shelter_id) REFERENCES profiles(id);

  -- Fix profiles foreign key
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_id_fkey' 
    AND table_name = 'profiles'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_id_fkey;
  END IF;

  ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey 
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;