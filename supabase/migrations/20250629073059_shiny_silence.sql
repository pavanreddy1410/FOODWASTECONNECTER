/*
  # Fix Profile RLS Policies

  1. Security Updates
    - Drop existing policies with incorrect uid() references
    - Create new policies using correct auth.uid() function
    - Ensure authenticated users can read, create, and update their own profiles

  2. Policy Changes
    - "Users can read own profile" - allows SELECT for authenticated users on their own profile
    - "Users can create own profile" - allows INSERT for authenticated users creating their own profile  
    - "Users can update own profile" - allows UPDATE for authenticated users on their own profile

  This fixes the profile fetch timeout by ensuring RLS policies work correctly.
*/

-- Drop existing policies that use incorrect uid() function
DROP POLICY IF EXISTS "Users can create own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create corrected policies using auth.uid()
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can create own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);