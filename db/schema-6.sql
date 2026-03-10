-- Migration: Add reviewer_comment column to releases table
ALTER TABLE releases ADD COLUMN IF NOT EXISTS reviewer_comment TEXT;
