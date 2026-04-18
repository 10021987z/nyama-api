-- Pro upgrade: rush mode on CookProfile, unavailableReason on MenuItem, OrderMessage table

-- CookProfile: rush mode fields
ALTER TABLE "CookProfile"
  ADD COLUMN IF NOT EXISTS "isRush"        BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "rushReason"    TEXT,
  ADD COLUMN IF NOT EXISTS "rushStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rushUntil"     TIMESTAMP(3);

-- MenuItem: unavailable reason
ALTER TABLE "MenuItem"
  ADD COLUMN IF NOT EXISTS "unavailableReason" TEXT;

-- OrderMessage: chat cuisinière ↔ livreur
CREATE TABLE IF NOT EXISTS "OrderMessage" (
  "id"         TEXT        NOT NULL,
  "orderId"    TEXT        NOT NULL,
  "senderId"   TEXT        NOT NULL,
  "senderRole" TEXT        NOT NULL,
  "text"       TEXT        NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrderMessage_orderId_createdAt_idx"
  ON "OrderMessage" ("orderId", "createdAt");

ALTER TABLE "OrderMessage"
  DROP CONSTRAINT IF EXISTS "OrderMessage_orderId_fkey";

ALTER TABLE "OrderMessage"
  ADD CONSTRAINT "OrderMessage_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
