-- CreateTable
CREATE TABLE "AdminMessage" (
    "id" TEXT NOT NULL,
    "fromAdminId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "recipientRole" "UserRole" NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'inapp',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "AdminMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminMessage_recipientId_idx" ON "AdminMessage"("recipientId");

-- CreateIndex
CREATE INDEX "AdminMessage_fromAdminId_idx" ON "AdminMessage"("fromAdminId");

-- CreateIndex
CREATE INDEX "AdminMessage_sentAt_idx" ON "AdminMessage"("sentAt");
