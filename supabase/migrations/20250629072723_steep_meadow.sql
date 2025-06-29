/*
  # Fix RLS policies for profiles table

  1. Changes
    - Drop existing RLS policies that use incorrect `uid()` function
    - Create new RLS policies using correct `auth.uid()` function
    - Ensure all CRUD operations work properly for authenticated users

  2. Security
    - Users can only read, update, and insert their own profile data
    - Maintains data isolation between users
*/

-- Drop existing policies that use incorrect uid() function
DROP POLICY IF EXISTS "Users can create own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create new policies with correct auth.uid() function
CREATE POLICY "Users can create own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);