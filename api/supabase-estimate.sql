-- Run in Supabase SQL editor. Allowed values 1,2,3,5,8 are enforced by the API.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimate smallint;
