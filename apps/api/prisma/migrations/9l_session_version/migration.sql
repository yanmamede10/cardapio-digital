-- F-2 (SEG-A06): each staff token carries the login's session version, and requireStaff (which already reads the staff member
-- on every request) refuses one that doesn't match. Changing or resetting the password bumps it: every session opened
-- before stops at its next request. 0 for everyone, so the tokens already out (no version: 0) keep working until then.
ALTER TABLE "StaffMember" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
