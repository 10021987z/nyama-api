-- AlterTable User : first login code for approved partners
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "firstLoginCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "firstLoginUsed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable PartnershipRequest : bcrypt hash of the access code generated at approval
ALTER TABLE "PartnershipRequest" ADD COLUMN IF NOT EXISTS "accessCodeHash" TEXT;
