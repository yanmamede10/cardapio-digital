-- A password handed out by the super admin (sign-up or reset) is provisional: until it's replaced, the API
-- only lets that login change it.
ALTER TABLE "StaffMember" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
