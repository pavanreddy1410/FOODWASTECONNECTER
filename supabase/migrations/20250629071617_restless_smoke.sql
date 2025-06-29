/*
  # Add uid() function for RLS policies

  1. New Functions
    - `uid()` - Returns the current authenticated user's ID
    - This function is required for Row Level Security policies to work properly

  2. Security
    - Function is marked as SECURITY DEFINER to ensure proper access
    - Returns null for unauthenticated users
    - Returns the authenticated user's ID for authenticated users

  3. Purpose
    - Fixes the "Profile fetch timeout" error by ensuring RLS policies can evaluate properly
    - Enables the existing RLS policies on the profiles table to function correctly
*/

-- Create the uid() function that returns the current user's ID
CREATE OR REPLACE FUNCTION uid() 
RETURNS uuid 
LANGUAGE sql 
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    auth.uid(),
    (current_setting('request.jwt.claims', true)::json ->> 'sub')::uuid
  );
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION uid() TO authenticated;
GRANT EXECUTE ON FUNCTION uid() TO anon;