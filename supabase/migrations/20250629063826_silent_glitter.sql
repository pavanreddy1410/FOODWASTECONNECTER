/*
  # Fix Database Schema for FoodWasteConnector

  1. Database Structure
    - Ensure profiles table has all required columns
    - Ensure donations table has all required columns
    - Fix foreign key references
    - Update RLS policies to match application code

  2. Security
    - Enable RLS on all tables
    - Create proper policies for each user type
    - Ensure data isolation between users

  3. Performance
    - Add necessary indexes
    - Optimize query performance
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

-- Fix foreign key constraints
DO $$
BEGIN
  -- Drop existing foreign key constraints that might reference wrong tables
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'donations_donor_id_fkey' 
    AND table_name = 'donations'
  ) THEN
    ALTER TABLE donations DROP CONSTRAINT donations_donor_id_fkey;
  END IF;

  -- Add correct foreign key constraint for donor_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'donations_donor_id_fkey' 
    AND table_name = 'donations'
  ) THEN
    ALTER TABLE donations ADD CONSTRAINT donations_donor_id_fkey 
    FOREIGN KEY (donor_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- Add foreign key constraint for volunteer_id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'donations_volunteer_id_fkey' 
    AND table_name = 'donations'
  ) THEN
    ALTER TABLE donations DROP CONSTRAINT donations_volunteer_id_fkey;
  END IF;

  ALTER TABLE donations ADD CONSTRAINT donations_volunteer_id_fkey 
  FOREIGN KEY (volunteer_id) REFERENCES profiles(id);
END $$;

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

-- Create helper function to get user ID from auth
CREATE OR REPLACE FUNCTION uid() RETURNS uuid AS $$
  SELECT auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Drop existing policies to avoid conflicts
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