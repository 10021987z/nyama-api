-- Rider online status: lastSeenAt + lastLocationLat/Lng on RiderProfile
-- isOnline existe déjà. On ajoute le reste pour POST /rider/status.

ALTER TABLE "RiderProfile"
  ADD COLUMN IF NOT EXISTS "lastSeenAt"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastLocationLat"  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "lastLocationLng"  DOUBLE PRECISION;
