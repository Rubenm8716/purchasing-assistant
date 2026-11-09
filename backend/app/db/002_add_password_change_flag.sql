-- 002_add_password_change_flag.sql
-- Require new employees to change temporary passwords

ALTER TABLE users
ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT TRUE;