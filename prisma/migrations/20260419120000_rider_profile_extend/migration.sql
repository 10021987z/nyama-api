-- Extend RiderProfile with vehicle, insurance, license, documents, banking fields.
ALTER TABLE "RiderProfile"
  ADD COLUMN IF NOT EXISTS "vehicleBrand"    TEXT,
  ADD COLUMN IF NOT EXISTS "vehicleYear"     INTEGER,
  ADD COLUMN IF NOT EXISTS "vehicleKm"       INTEGER,
  ADD COLUMN IF NOT EXISTS "insuranceNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "insuranceExpiry" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "licenseNumber"   TEXT,
  ADD COLUMN IF NOT EXISTS "licenseExpiry"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "licenseUrl"      TEXT,
  ADD COLUMN IF NOT EXISTS "registrationUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "insuranceUrl"    TEXT,
  ADD COLUMN IF NOT EXISTS "iban"            TEXT,
  ADD COLUMN IF NOT EXISTS "address"         TEXT,
  ADD COLUMN IF NOT EXISTS "onlineSinceAt"   TIMESTAMP(3);
