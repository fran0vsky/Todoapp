-- Run this in the Supabase SQL editor (or via migration) before using task assignment.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_email text;
