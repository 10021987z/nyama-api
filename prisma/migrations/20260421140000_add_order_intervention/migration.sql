-- CreateTable
CREATE TABLE "OrderIntervention" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "payload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderIntervention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderIntervention_orderId_idx" ON "OrderIntervention"("orderId");

-- CreateIndex
CREATE INDEX "OrderIntervention_adminId_idx" ON "OrderIntervention"("adminId");

-- CreateIndex
CREATE INDEX "OrderIntervention_createdAt_idx" ON "OrderIntervention"("createdAt");
