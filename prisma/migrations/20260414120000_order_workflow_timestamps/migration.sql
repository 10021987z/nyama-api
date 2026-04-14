-- Add ASSIGNED status to OrderStatus enum (Postgres)
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'ASSIGNED' BEFORE 'PICKED_UP';

-- Add workflow timestamp columns to Order
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "acceptedAt"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "readyAt"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "assignedAt"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pickedUpAt"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
