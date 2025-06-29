/*
  # Fix FoodWasteConnector Schema

  1. New Tables and Updates
    - Add missing columns to existing tables
    - Create missing indexes and functions
    - Add any missing policies safely

  2. Security
    - Ensure RLS is enabled
    - Add any missing policies with IF NOT EXISTS equivalent
*/

-- First, let's safely add any missing columns to existing tables
DO $$
BEGIN
  -- Add missing columns to donations table if they don't exist
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

  -- Add missing columns to profiles table if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone text;
  END IF;
END $$;

-- Update foreign key constraints to reference profiles instead of users
DO $$
BEGIN
  -- Drop existing foreign key if it references users table
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'donations_volunteer_id_fkey' 
    AND table_name = 'donations'
  ) THEN
    ALTER TABLE donations DROP CONSTRAINT donations_volunteer_id_fkey;
  END IF;

  -- Add foreign key constraint to reference profiles
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'donations_volunteer_id_fkey' 
    AND table_name = 'donations'
  ) THEN
    ALTER TABLE donations ADD CONSTRAINT donations_volunteer_id_fkey 
    FOREIGN KEY (volunteer_id) REFERENCES profiles(id);
  END IF;
END $$;

-- Create or replace function to update timestamps
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

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS donation_status_timestamps ON donations;
CREATE TRIGGER donation_status_timestamps
  BEFORE UPDATE ON donations
  FOR EACH ROW
  EXECUTE FUNCTION update_donation_timestamps();

-- Add missing policies safely
DO $$
BEGIN
  -- Add volunteer policies if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'donations' 
    AND policyname = 'Volunteers can update donations to completed'
  ) THEN
    CREATE POLICY "Volunteers can update donations to completed"
      ON donations
      FOR UPDATE
      TO authenticated
      USING (
        status = 'accepted' AND
        auth.uid() IN (
          SELECT id FROM profiles WHERE user_type = 'volunteer'
        )
      )
      WITH CHECK (status = 'completed');
  END IF;

  -- Update existing volunteer read policy to be more comprehensive
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'donations' 
    AND policyname = 'Volunteers can read accepted donations'
  ) THEN
    DROP POLICY "Volunteers can read accepted donations" ON donations;
  END IF;

  CREATE POLICY "Volunteers can read accepted donations"
    ON donations
    FOR SELECT
    TO authenticated
    USING (
      (status = ANY (ARRAY['accepted'::text, 'completed'::text])) AND 
      (auth.uid() IN (
        SELECT profiles.id FROM profiles 
        WHERE (profiles.user_type = 'volunteer'::text)
      ))
    );
END $$;

-- Create indexes for better performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_donor_id ON donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_donations_shelter_id ON donations(shelter_id);
CREATE INDEX IF NOT EXISTS idx_donations_volunteer_id ON donations(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON profiles(user_type);

-- Ensure RLS is enabled on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;